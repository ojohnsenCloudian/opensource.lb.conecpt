import { EventEmitter } from 'events';
import { prisma } from '@lb-app/database';
import { Logger } from './utils/logger';

export interface BackendServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  weight: number;
  enabled: boolean;
  healthy: boolean;
}

export interface CertificateConfig {
  certContent: string;
  keyContent: string;
  chainContent?: string;
}

export interface LoadBalancerConfig {
  id: string;
  name: string;
  listenPort: number;
  protocol: 'http' | 'https' | 'tcp';
  algorithm: 'roundrobin' | 'leastconn' | 'weighted' | 'iphash';
  enabled: boolean;
  vip?: string;
  certificate?: CertificateConfig;
  backends: BackendServerConfig[];
  sessionPersistence: boolean;
  connectionTimeout: number;
  requestTimeout: number;
  maxRetries: number;
}

export class ConfigManager extends EventEmitter {
  private logger = new Logger('ConfigManager');
  private configs: LoadBalancerConfig[] = [];
  private reloadInterval?: NodeJS.Timeout;
  private reloadIntervalMs: number;

  constructor() {
    super();
    this.reloadIntervalMs = parseInt(process.env.LB_CONFIG_RELOAD_INTERVAL || '30') * 1000;
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing configuration manager...');
    await this.loadConfiguration();

    // Start periodic reload
    this.reloadInterval = setInterval(() => {
      this.reload().catch((error) => {
        this.logger.error('Failed to reload configuration:', error);
      });
    }, this.reloadIntervalMs);
  }

  async stop(): Promise<void> {
    if (this.reloadInterval) {
      clearInterval(this.reloadInterval);
    }
  }

  async reload(): Promise<void> {
    const oldConfigsJson = JSON.stringify(this.configs);
    await this.loadConfiguration();
    const newConfigsJson = JSON.stringify(this.configs);

    if (oldConfigsJson !== newConfigsJson) {
      this.logger.info('Configuration changed, emitting update event');
      this.emit('config-updated', this.configs);
    }
  }

  getLoadBalancers(): LoadBalancerConfig[] {
    return this.configs;
  }

  getLoadBalancer(id: string): LoadBalancerConfig | undefined {
    return this.configs.find((c) => c.id === id);
  }

  private async loadConfiguration(): Promise<void> {
    try {
      const loadBalancers = await prisma.loadBalancer.findMany({
        include: {
          vip: true,
          certificate: true,
          serverPool: {
            include: {
              servers: true,
            },
          },
        },
      });

      this.configs = loadBalancers.map((lb) => {
        const backends: BackendServerConfig[] = lb.serverPool.servers.map((server) => ({
          id: server.id,
          name: server.name,
          host: server.ipAddress,
          port: server.port,
          weight: server.weight,
          enabled: server.enabled,
          healthy: server.status === 'up',
        }));

        const config: LoadBalancerConfig = {
          id: lb.id,
          name: lb.name,
          listenPort: lb.listenPort,
          protocol: lb.protocol as 'http' | 'https' | 'tcp',
          algorithm: lb.algorithm as 'roundrobin' | 'leastconn' | 'weighted' | 'iphash',
          enabled: lb.enabled,
          backends,
          sessionPersistence: lb.sessionPersistence,
          connectionTimeout: lb.connectionTimeout,
          requestTimeout: lb.requestTimeout,
          maxRetries: lb.maxRetries,
        };

        if (lb.vip) {
          config.vip = lb.vip.ipAddress;
        }

        if (lb.certificate) {
          config.certificate = {
            certContent: lb.certificate.certContent,
            keyContent: lb.certificate.keyContent,
            chainContent: lb.certificate.chainContent || undefined,
          };
        }

        return config;
      });

      this.logger.info(`Loaded ${this.configs.length} load balancer configurations`);
    } catch (error) {
      this.logger.error('Failed to load configuration from database:', error);
      throw error;
    }
  }
}

