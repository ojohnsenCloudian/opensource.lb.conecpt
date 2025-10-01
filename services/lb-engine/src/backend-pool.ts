import * as crypto from 'crypto';
import { LoadBalancerConfig, BackendServerConfig } from './config-manager';
import { Logger } from './utils/logger';

export class BackendPool {
  private logger = new Logger('BackendPool');
  private backends: BackendServerConfig[];
  private currentIndex = 0;
  private connectionCounts = new Map<string, number>();

  constructor(private config: LoadBalancerConfig) {
    this.backends = config.backends.filter((b) => b.enabled && b.healthy);
    this.logger.info(`Initialized backend pool with ${this.backends.length} servers`);
  }

  selectBackend(clientIp?: string): BackendServerConfig | null {
    const availableBackends = this.backends.filter((b) => b.enabled && b.healthy);

    if (availableBackends.length === 0) {
      this.logger.warn('No healthy backends available');
      return null;
    }

    let selectedBackend: BackendServerConfig;

    switch (this.config.algorithm) {
      case 'roundrobin':
        selectedBackend = this.roundRobin(availableBackends);
        break;
      case 'leastconn':
        selectedBackend = this.leastConnections(availableBackends);
        break;
      case 'weighted':
        selectedBackend = this.weightedRoundRobin(availableBackends);
        break;
      case 'iphash':
        selectedBackend = this.ipHash(availableBackends, clientIp || '');
        break;
      default:
        selectedBackend = this.roundRobin(availableBackends);
    }

    return selectedBackend;
  }

  incrementConnections(backendId: string): void {
    const current = this.connectionCounts.get(backendId) || 0;
    this.connectionCounts.set(backendId, current + 1);
  }

  decrementConnections(backendId: string): void {
    const current = this.connectionCounts.get(backendId) || 0;
    if (current > 0) {
      this.connectionCounts.set(backendId, current - 1);
    }
  }

  getConnectionCount(backendId: string): number {
    return this.connectionCounts.get(backendId) || 0;
  }

  private roundRobin(backends: BackendServerConfig[]): BackendServerConfig {
    const backend = backends[this.currentIndex % backends.length];
    this.currentIndex = (this.currentIndex + 1) % backends.length;
    return backend;
  }

  private leastConnections(backends: BackendServerConfig[]): BackendServerConfig {
    let leastConnBackend = backends[0];
    let leastConn = this.getConnectionCount(backends[0].id);

    for (const backend of backends) {
      const connCount = this.getConnectionCount(backend.id);
      if (connCount < leastConn) {
        leastConn = connCount;
        leastConnBackend = backend;
      }
    }

    return leastConnBackend;
  }

  private weightedRoundRobin(backends: BackendServerConfig[]): BackendServerConfig {
    // Simple weighted selection based on weight
    const totalWeight = backends.reduce((sum, b) => sum + b.weight, 0);
    let random = Math.floor(Math.random() * totalWeight);

    for (const backend of backends) {
      random -= backend.weight;
      if (random < 0) {
        return backend;
      }
    }

    return backends[0];
  }

  private ipHash(backends: BackendServerConfig[], clientIp: string): BackendServerConfig {
    const hash = crypto.createHash('md5').update(clientIp).digest('hex');
    const index = parseInt(hash.substring(0, 8), 16) % backends.length;
    return backends[index];
  }

  updateBackends(backends: BackendServerConfig[]): void {
    this.backends = backends.filter((b) => b.enabled && b.healthy);
    this.logger.info(`Updated backend pool with ${this.backends.length} servers`);
  }
}

