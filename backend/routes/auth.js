/**
 * Auth Routes
 *
 * Production: Uses AWS Cognito for sign-up, sign-in, token refresh.
 *   POST /api/auth/register  — Cognito SignUp + create DynamoDB profile
 *   POST /api/auth/login     — Cognito InitiateAuth → returns Cognito tokens
 *   POST /api/auth/refresh   — Cognito token refresh
 *   POST /api/auth/logout    — Cognito GlobalSignOut
 *   GET  /api/auth/me        — Return user profile from DynamoDB
 *
 * Dev (COGNITO_DISABLED=true): Uses local bcrypt + HS256 JWT (no Cognito calls).
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authLimiter } = require('../middleware/rateLimiter');
const { protect } = require('../middleware/auth');
const UserModel = require('../models/User');
const jwt = require('jsonwebtoken');

const IS_DEV_AUTH = process.env.COGNITO_DISABLED === 'true' || process.env.NODE_ENV !== 'production';

// ─── Cognito client (production only) ───────────────────────────────────────
let cognitoClient;
if (!IS_DEV_AUTH) {
  const { CognitoIdentityProviderClient,
    SignUpCommand, ConfirmSignUpCommand,
    InitiateAuthCommand, GlobalSignOutCommand,
    ResendConfirmationCodeCommand,
  } = require('@aws-sdk/client-cognito-identity-provider');
  cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
}

function signDevToken(user) {
  return jwt.sign(
    { userId: user.userId, email: user.email, name: user.name },
    process.env.JWT_SECRET || 'dev_secret_change_me_32chars_min',
    { expiresIn: '7d' }
  );
}

// ─── POST /api/auth/register ─────────────────────────────────────────────────
router.post('/register',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
      .matches(/[0-9]/).withMessage('Password must contain a number'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const { name, email, password } = req.body;

    try {
      if (IS_DEV_AUTH) {
        // Dev: check for duplicate, create with bcrypt hash
        const existing = await UserModel.getByEmail(email);
        if (existing) return res.status(400).json({ success: false, message: 'Email already registered.' });
        const passwordHash = await UserModel.hashPassword(password);
        const user = await UserModel.create({ name, email, passwordHash });
        const token = signDevToken(user);
        return res.status(201).json({
          success: true,
          token,
          user: UserModel.sanitize(user),
          message: 'Account created successfully.',
        });
      }

      // Production: Cognito SignUp
      const { SignUpCommand } = require('@aws-sdk/client-cognito-identity-provider');
      const signUpResult = await cognitoClient.send(new SignUpCommand({
        ClientId: process.env.COGNITO_CLIENT_ID,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'name', Value: name },
        ],
      }));

      try {
        await UserModel.upsertCognitoProfile({
          name,
          email,
          cognitoSub: signUpResult.UserSub,
        });
      } catch (profileError) {
        console.error('Register profile sync error:', profileError);
      }

      res.status(201).json({
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
        requiresConfirmation: true,
      });
    } catch (err) {
      if (err.name === 'UsernameExistsException') {
        return res.status(400).json({ success: false, message: 'Email already registered.' });
      }
      if (err.name === 'ConditionalCheckFailedException') {
        return res.status(400).json({ success: false, message: 'Email already registered.' });
      }
      console.error('Register error:', err);
      res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
    }
  }
);

// ─── POST /api/auth/confirm (Cognito email verification) ─────────────────────
router.post('/confirm',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('code').notEmpty().withMessage('Confirmation code required'),
  ],
  async (req, res) => {
    if (IS_DEV_AUTH) return res.json({ success: true, message: 'No confirmation needed in dev mode.' });
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { email, code } = req.body;
    try {
      const { ConfirmSignUpCommand } = require('@aws-sdk/client-cognito-identity-provider');
      await cognitoClient.send(new ConfirmSignUpCommand({
        ClientId: process.env.COGNITO_CLIENT_ID,
        Username: email,
        ConfirmationCode: code,
      }));

      // Ensure DynamoDB profile exists on confirmation
      try {
        const existingUser = await UserModel.getByEmail(email);
        if (!existingUser) {
          await UserModel.create({ email, name: email.split('@')[0] });
        }
      } catch { /* profile may already exist */ }

      res.json({ success: true, message: 'Email confirmed. You can now sign in.' });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message || 'Confirmation failed.' });
    }
  }
);

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { email, password } = req.body;
    try {
      if (IS_DEV_AUTH) {
        const user = await UserModel.getByEmail(email);
        if (!user || !user.passwordHash) {
          return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }
        const valid = await UserModel.verifyPassword(password, user.passwordHash);
        if (!valid) return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        const token = signDevToken(user);
        return res.json({ success: true, token, user: UserModel.sanitize(user) });
      }

      // Production: Cognito USER_PASSWORD_AUTH
      const { InitiateAuthCommand } = require('@aws-sdk/client-cognito-identity-provider');
      const result = await cognitoClient.send(new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: process.env.COGNITO_CLIENT_ID,
        AuthParameters: { USERNAME: email, PASSWORD: password },
      }));

      const { IdToken, AccessToken, RefreshToken, ExpiresIn } = result.AuthenticationResult;

      // Ensure DynamoDB profile exists
      const jwt_decode = require('jsonwebtoken');
      const decoded = jwt_decode.decode(IdToken);
      const user = await UserModel.upsertCognitoProfile({
        name: decoded.name || email.split('@')[0],
        email,
        cognitoSub: decoded.sub,
      });

      res.json({
        success: true,
        token: IdToken,
        accessToken: AccessToken,
        refreshToken: RefreshToken,
        expiresIn: ExpiresIn,
        user: UserModel.sanitize(user),
      });
    } catch (err) {
      if (['NotAuthorizedException', 'UserNotFoundException'].includes(err.name)) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }
      if (err.name === 'UserNotConfirmedException') {
        return res.status(403).json({ success: false, message: 'Please verify your email before signing in.', requiresConfirmation: true });
      }
      console.error('Login error:', err);
      res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
    }
  }
);

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────
router.post('/refresh', authLimiter, async (req, res) => {
  if (IS_DEV_AUTH) return res.status(400).json({ success: false, message: 'Token refresh not applicable in dev mode.' });
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ success: false, message: 'Refresh token required.' });
  try {
    const { InitiateAuthCommand } = require('@aws-sdk/client-cognito-identity-provider');
    const result = await cognitoClient.send(new InitiateAuthCommand({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: process.env.COGNITO_CLIENT_ID,
      AuthParameters: { REFRESH_TOKEN: refreshToken },
    }));
    const { IdToken, AccessToken, ExpiresIn } = result.AuthenticationResult;
    res.json({ success: true, token: IdToken, accessToken: AccessToken, expiresIn: ExpiresIn });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Could not refresh token. Please sign in again.' });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', protect, async (req, res) => {
  if (IS_DEV_AUTH) return res.json({ success: true });
  try {
    const { GlobalSignOutCommand } = require('@aws-sdk/client-cognito-identity-provider');
    const authHeader = req.headers.authorization;
    const accessToken = req.body.accessToken || authHeader?.split(' ')[1];
    if (accessToken) {
      await cognitoClient.send(new GlobalSignOutCommand({ AccessToken: accessToken }));
    }
  } catch { /* best-effort */ }
  res.json({ success: true, message: 'Signed out successfully.' });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  try {
    const user = await UserModel.getById(req.user.userId)
      || await UserModel.getByCognitoSub(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, user: UserModel.sanitize(user) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
