import * as dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { router } from './routes';
import { errorHandler } from './middleware/error-handler';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.API_PORT || '4000', 10);
const HOST = process.env.API_HOST || '0.0.0.0';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// API routes
app.use('/api/v1', router);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, HOST, () => {
  logger.info(`API server running on http://${HOST}:${PORT}`);
  logger.info(`Health check: http://${HOST}:${PORT}/health`);
  logger.info(`API base URL: http://${HOST}:${PORT}/api/v1`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

