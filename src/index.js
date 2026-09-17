const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const prisma = require('./prisma');
const authRoutes = require('./routes/auth');
const jobRoutes = require('./routes/jobs');
const applicationRoutes = require('./routes/applications');
const adminRoutes = require('./routes/admin');
const candidateRoutes = require('./routes/candidate');
const employerRoutes = require('./routes/employer');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.disable('etag');

// API Request Logger Middleware
app.use((req, res, next) => {
  const start = Date.now();
  const { method, originalUrl } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const statusColor = status >= 400 ? '\x1b[31m' : status >= 300 ? '\x1b[33m' : '\x1b[32m';
    console.log(
      `[API] ${method} ${originalUrl} -> ${statusColor}${status}\x1b[0m (${duration}ms)`
    );
  });

  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/candidate', candidateRoutes);
app.use('/api/employer', employerRoutes);

const PORT = process.env.PORT || 5001;

const server = app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  try {
    await prisma.$connect();
    console.log('Database connection established successfully! [PostgreSQL Status: CONNECTED]');
  } catch (error) {
    console.error('Database connection failed:', error.message);
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\x1b[31m[ERROR] Port ${PORT} is already in use by another process. Kill it and restart.\x1b[0m`);
  } else {
    console.error('[ERROR] Server error:', err);
  }
});

process.on('SIGTERM', async () => {
  console.log('Shutting down server...');
  await prisma.$disconnect();
  server.close(() => process.exit(0));
});
