// server.js — Global Linkers Ltd API Server
require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const morgan   = require('morgan');
const path     = require('path');

const { testConnection } = require('./src/db/pool');
const routes = require('./src/routes/index');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Security & Middleware ─────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      // Allow inline event handlers (onclick, onsubmit, etc.) in the HTML frontend
      'script-src': ["'self'", "'unsafe-inline'"],
      'script-src-attr': ["'unsafe-inline'"],
    },
  },
}));

const allowedOrigins = [
  'https://yomisys.github.io',
  'http://localhost:3000',
  'http://localhost:4000',
  'http://127.0.0.1:4000',
  'http://127.0.0.1:5500',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('CORS: not allowed'));
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));


app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Serve static assets (logo, images) ───────────────────────
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// ── Serve uploaded CVs ────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Serve frontend ────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/app.js', (req, res) => res.sendFile(path.join(__dirname, 'app.js')));

// ── Health check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Global Linkers API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ────────────────────────────────────────────────
app.use('/api', routes);

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum 5MB.' });
  }
  if (err.message?.includes('Only PDF')) {
    return res.status(400).json({ error: err.message });
  }
  if (err.message?.includes('CORS')) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  console.error('Unhandled error:', err);

  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n🚀 Global Linkers API running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🔑 Admin login: POST http://localhost:${PORT}/api/auth/login\n`);
  await testConnection();
});

module.exports = app;
