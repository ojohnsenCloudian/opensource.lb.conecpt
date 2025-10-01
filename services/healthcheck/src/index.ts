import * as dotenv from 'dotenv';
import { HealthCheckService } from './health-check-service';
import { Logger } from './utils/logger';

dotenv.config();

const logger = new Logger('Main');

async function main() {
  logger.info('Starting Health Check Service...');

  try {
    const service = new HealthCheckService();
    await service.start();

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      await service.stop();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    logger.info('Health Check Service started successfully');
  } catch (error) {
    logger.error('Failed to start Health Check Service:', error);
    process.exit(1);
  }
}

main();

