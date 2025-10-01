import { prisma } from '@lb-app/database';
import { Logger } from './utils/logger';
import { HealthChecker } from './health-checker';

interface HealthCheckTask {
  healthCheckId: string;
  backendServerId: string;
  type: string;
  config: any;
}

export class HealthCheckService {
  private logger = new Logger('HealthCheckService');
  private checker = new HealthChecker();
  private tasks: HealthCheckTask[] = [];
  private intervals = new Map<string, NodeJS.Timeout>();
  private running = false;

  async start(): Promise<void> {
    this.logger.info('Initializing health check service...');
    this.running = true;

    await this.loadHealthChecks();

    // Periodically reload health check configurations
    setInterval(() => {
      this.loadHealthChecks().catch((error) => {
        this.logger.error('Failed to reload health checks:', error);
      });
    }, 60000); // Reload every minute
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping health check service...');
    this.running = false;

    // Clear all intervals
    for (const [key, interval] of this.intervals) {
      clearInterval(interval);
      this.intervals.delete(key);
    }
  }

  private async loadHealthChecks(): Promise<void> {
    try {
      // Get all load balancers with health checks
      const loadBalancers = await prisma.loadBalancer.findMany({
        where: {
          enabled: true,
          healthCheckId: { not: null },
        },
        include: {
          healthCheck: true,
          serverPool: {
            include: {
              servers: {
                where: { enabled: true },
              },
            },
          },
        },
      });

      // Clear existing tasks
      this.tasks = [];

      // Create health check tasks
      for (const lb of loadBalancers) {
        if (!lb.healthCheck) continue;

        for (const server of lb.serverPool.servers) {
          const taskKey = `${lb.healthCheck.id}-${server.id}`;

          // Create or update task
          const task: HealthCheckTask = {
            healthCheckId: lb.healthCheck.id,
            backendServerId: server.id,
            type: lb.healthCheck.type,
            config: {
              host: server.ipAddress,
              port: server.port,
              path: lb.healthCheck.path,
              timeout: lb.healthCheck.timeout * 1000,
              expectedStatus: lb.healthCheck.expectedStatus,
              healthyThreshold: lb.healthCheck.healthyThreshold,
              unhealthyThreshold: lb.healthCheck.unhealthyThreshold,
            },
          };

          this.tasks.push(task);

          // Schedule health check
          if (!this.intervals.has(taskKey)) {
            const interval = setInterval(() => {
              this.performHealthCheck(task).catch((error) => {
                this.logger.error(`Health check failed for ${taskKey}:`, error);
              });
            }, lb.healthCheck.interval * 1000);

            this.intervals.set(taskKey, interval);

            // Perform initial check immediately
            this.performHealthCheck(task).catch((error) => {
              this.logger.error(`Initial health check failed for ${taskKey}:`, error);
            });
          }
        }
      }

      this.logger.info(`Loaded ${this.tasks.length} health check tasks`);
    } catch (error) {
      this.logger.error('Failed to load health checks:', error);
    }
  }

  private async performHealthCheck(task: HealthCheckTask): Promise<void> {
    const startTime = Date.now();

    try {
      let result: { status: 'success' | 'failed' | 'timeout'; statusCode?: number; message?: string };

      switch (task.type) {
        case 'http':
        case 'https':
          result = await this.checker.checkHttp(
            task.type === 'https',
            task.config.host,
            task.config.port,
            task.config.path || '/',
            task.config.timeout,
            task.config.expectedStatus
          );
          break;
        case 'tcp':
          result = await this.checker.checkTcp(
            task.config.host,
            task.config.port,
            task.config.timeout
          );
          break;
        default:
          this.logger.warn(`Unknown health check type: ${task.type}`);
          return;
      }

      const responseTime = Date.now() - startTime;

      // Save result
      await prisma.healthCheckResult.create({
        data: {
          healthCheckId: task.healthCheckId,
          backendServerId: task.backendServerId,
          status: result.status,
          responseTime,
          statusCode: result.statusCode,
          message: result.message,
        },
      });

      // Update backend server status
      const newStatus = result.status === 'success' ? 'up' : 'down';
      await prisma.backendServer.update({
        where: { id: task.backendServerId },
        data: { status: newStatus },
      });

      this.logger.debug(
        `Health check for ${task.config.host}:${task.config.port}: ${result.status} (${responseTime}ms)`
      );
    } catch (error) {
      this.logger.error('Health check error:', error);

      // Record failure
      await prisma.healthCheckResult.create({
        data: {
          healthCheckId: task.healthCheckId,
          backendServerId: task.backendServerId,
          status: 'failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      // Mark backend as down
      await prisma.backendServer.update({
        where: { id: task.backendServerId },
        data: { status: 'down' },
      });
    }
  }
}

