require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const { apiLimiter } = require('./middleware/rateLimiter');
const authRoutes = require('./routes/auth');
const salesRoutes = require('./routes/sales');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Security headers (helmet) ────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://maps.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc: ["'self'", 'https://maps.googleapis.com'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Allow server-to-server (no origin) and whitelisted origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ─── Logging ──────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ─── Trust proxy (needed for rate limiter behind ALB / nginx) ─────────────────
app.set('trust proxy', 1);

// ─── Global rate limiter ──────────────────────────────────────────────────────
app.use('/api/', apiLimiter);

// ─── Static uploads (dev only) ────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/upload', uploadRoutes);

// ─── Health check (unauthenticated, used by ALB/CloudFormation) ───────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  // Don't leak stack traces in production
  const message = process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred.'
    : err.message;
  res.status(err.status || 500).json({ success: false, message });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`EstatesNearMe backend running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    console.log(`Auth mode: ${process.env.COGNITO_DISABLED === 'true' ? 'LOCAL JWT (dev)' : 'AWS Cognito (production)'}`);
    console.log(`DynamoDB tables: ${process.env.DYNAMODB_USERS_TABLE || 'enm-users'}, ${process.env.DYNAMODB_SALES_TABLE || 'enm-sales'}`);
  });
}

module.exports = app;
