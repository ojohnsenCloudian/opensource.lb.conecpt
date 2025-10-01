import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import { ConfigManager, LoadBalancerConfig } from './config-manager';
import { Logger } from './utils/logger';
import { BackendPool } from './backend-pool';
import { StatsCollector } from './stats-collector';
import { RequestHandler } from './request-handler';

export class LoadBalancerEngine {
  private logger = new Logger('Engine');
  private servers = new Map<string, http.Server | https.Server>();
  private backendPools = new Map<string, BackendPool>();
  private statsCollectors = new Map<string, StatsCollector>();

  constructor(private configManager: ConfigManager) {
    // Listen for configuration changes
    this.configManager.on('config-updated', this.handleConfigUpdate.bind(this));
  }

  async start(): Promise<void> {
    this.logger.info('Initializing load balancers...');
    const configs = this.configManager.getLoadBalancers();

    for (const config of configs) {
      if (config.enabled) {
        await this.startLoadBalancer(config);
      }
    }
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping all load balancers...');

    // Stop all stats collectors
    for (const [id, collector] of this.statsCollectors) {
      collector.stop();
      this.statsCollectors.delete(id);
    }

    // Close all servers
    const closePromises = Array.from(this.servers.entries()).map(([id, server]) => {
      return new Promise<void>((resolve) => {
        this.logger.info(`Closing load balancer: ${id}`);
        server.close(() => {
          this.logger.info(`Load balancer closed: ${id}`);
          resolve();
        });
      });
    });

    await Promise.all(closePromises);
    this.servers.clear();
    this.backendPools.clear();
  }

  private async startLoadBalancer(config: LoadBalancerConfig): Promise<void> {
    try {
      this.logger.info(`Starting load balancer: ${config.name} on port ${config.listenPort}`);

      // Create backend pool
      const backendPool = new BackendPool(config);
      this.backendPools.set(config.id, backendPool);

      // Create stats collector
      const statsCollector = new StatsCollector(config.id);
      this.statsCollectors.set(config.id, statsCollector);
      statsCollector.start();

      // Create request handler
      const requestHandler = new RequestHandler(config, backendPool, statsCollector);

      // Create server
      let server: http.Server | https.Server;

      if (config.protocol === 'https' && config.certificate) {
        server = https.createServer(
          {
            cert: config.certificate.certContent,
            key: config.certificate.keyContent,
            ca: config.certificate.chainContent || undefined,
          },
          (req, res) => requestHandler.handle(req, res)
        );
      } else {
        server = http.createServer((req, res) => requestHandler.handle(req, res));
      }

      // Set server timeout
      server.timeout = config.requestTimeout;

      // Start listening
      await new Promise<void>((resolve, reject) => {
        server.on('error', (error: NodeJS.ErrnoException) => {
          if (error.code === 'EADDRINUSE') {
            this.logger.error(`Port ${config.listenPort} is already in use`);
          } else {
            this.logger.error(`Server error: ${error.message}`);
          }
          reject(error);
        });

        // Bind to VIP address if specified, otherwise bind to all interfaces
        const bindAddress = config.vip?.ipAddress || '0.0.0.0';
        server.listen(config.listenPort, bindAddress, () => {
          this.logger.info(`Load balancer ${config.name} listening on ${bindAddress}:${config.listenPort}`);
          resolve();
        });
      });

      this.servers.set(config.id, server);
    } catch (error) {
      this.logger.error(`Failed to start load balancer ${config.name}:`, error);
      throw error;
    }
  }

  private async stopLoadBalancer(id: string): Promise<void> {
    const server = this.servers.get(id);
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
      this.servers.delete(id);
    }

    const statsCollector = this.statsCollectors.get(id);
    if (statsCollector) {
      statsCollector.stop();
      this.statsCollectors.delete(id);
    }

    this.backendPools.delete(id);
  }

  private async handleConfigUpdate(configs: LoadBalancerConfig[]): Promise<void> {
    this.logger.info('Configuration updated, reloading load balancers...');

    const currentIds = new Set(this.servers.keys());
    const newIds = new Set(configs.filter((c) => c.enabled).map((c) => c.id));

    // Stop removed load balancers
    for (const id of currentIds) {
      if (!newIds.has(id)) {
        this.logger.info(`Stopping removed load balancer: ${id}`);
        await this.stopLoadBalancer(id);
      }
    }

    // Start new load balancers and update existing ones
    for (const config of configs) {
      if (config.enabled) {
        if (currentIds.has(config.id)) {
          // For simplicity, restart the load balancer
          // In production, you might want to do hot reload
          this.logger.info(`Restarting updated load balancer: ${config.name}`);
          await this.stopLoadBalancer(config.id);
          await this.startLoadBalancer(config);
        } else {
          this.logger.info(`Starting new load balancer: ${config.name}`);
          await this.startLoadBalancer(config);
        }
      } else if (currentIds.has(config.id)) {
        // Load balancer was disabled
        this.logger.info(`Stopping disabled load balancer: ${config.name}`);
        await this.stopLoadBalancer(config.id);
      }
    }
  }
}

