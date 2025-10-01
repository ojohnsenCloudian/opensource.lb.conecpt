import * as dotenv from 'dotenv';
import { LoadBalancerEngine } from './engine';
import { ConfigManager } from './config-manager';
import { Logger } from './utils/logger';

dotenv.config();

const logger = new Logger('Main');

async function main() {
  logger.info('Starting Load Balancer Engine...');

  try {
    // Initialize configuration manager
    const configManager = new ConfigManager();
    await configManager.initialize();

    // Initialize load balancer engine
    const engine = new LoadBalancerEngine(configManager);
    await engine.start();

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      await engine.stop();
      await configManager.stop();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGHUP', async () => {
      logger.info('Received SIGHUP, reloading configuration...');
      await configManager.reload();
    });

    logger.info('Load Balancer Engine started successfully');
  } catch (error) {
    logger.error('Failed to start Load Balancer Engine:', error);
    process.exit(1);
  }
}

main();

