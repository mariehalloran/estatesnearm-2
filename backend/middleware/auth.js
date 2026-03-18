/**
 * Authentication Middleware
 *
 * Production: Validates AWS Cognito JWT tokens via JWKS (RS256)
 * Development (COGNITO_DISABLED=true): Validates local HS256 JWT tokens
 *
 * Populates req.user = { userId, email, name }
 */

const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');

const IS_DEV_AUTH = process.env.COGNITO_DISABLED === 'true' || process.env.NODE_ENV !== 'production';

// Build JWKS client once for Cognito
let jwksClient;
if (!IS_DEV_AUTH && process.env.COGNITO_USER_POOL_ID && process.env.AWS_REGION) {
  jwksClient = jwksRsa({
    jwksUri: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
    cache: true,
    cacheMaxEntries: 5,
    cacheMaxAge: 600000,
    rateLimit: true,
  });
}

function getSigningKey(header, callback) {
  jwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

function verifyCognitoToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getSigningKey, {
      algorithms: ['RS256'],
      issuer: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`,
    }, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
}

function verifyDevToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_change_me_32chars_min');
}

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided. Please sign in.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    let decoded;
    if (IS_DEV_AUTH) {
      decoded = verifyDevToken(token);
      req.user = { userId: decoded.userId, email: decoded.email, name: decoded.name };
    } else {
      decoded = await verifyCognitoToken(token);
      req.user = {
        userId: decoded.sub,
        email: decoded.email || '',
        name: decoded.name || decoded['cognito:username'] || '',
      };
    }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired.' });
  }
};

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
  const token = authHeader.split(' ')[1];
  try {
    let decoded;
    if (IS_DEV_AUTH) {
      decoded = verifyDevToken(token);
      req.user = { userId: decoded.userId, email: decoded.email, name: decoded.name };
    } else {
      decoded = await verifyCognitoToken(token);
      req.user = { userId: decoded.sub, email: decoded.email || '', name: decoded.name || '' };
    }
  } catch { /* ignore invalid optional tokens */ }
  next();
};

module.exports = { protect, optionalAuth };
