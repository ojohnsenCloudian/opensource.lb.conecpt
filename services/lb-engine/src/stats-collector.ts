import { prisma } from '@lb-app/database';
import { Logger } from './utils/logger';

interface RequestStats {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  totalResponseTime: number;
  totalBytesIn: number;
  totalBytesOut: number;
}

interface BackendStats {
  [backendId: string]: RequestStats;
}

export class StatsCollector {
  private logger = new Logger('StatsCollector');
  private stats: RequestStats = {
    totalRequests: 0,
    successCount: 0,
    errorCount: 0,
    totalResponseTime: 0,
    totalBytesIn: 0,
    totalBytesOut: 0,
  };
  private backendStats: BackendStats = {};
  private flushInterval?: NodeJS.Timeout;
  private flushIntervalMs = 60000; // 1 minute
  private lastFlush = Date.now();

  constructor(private loadBalancerId: string) {}

  start(): void {
    this.flushInterval = setInterval(() => {
      this.flush().catch((error) => {
        this.logger.error('Failed to flush statistics:', error);
      });
    }, this.flushIntervalMs);
  }

  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    // Final flush
    this.flush().catch((error) => {
      this.logger.error('Failed to flush statistics on stop:', error);
    });
  }

  recordRequest(
    statusCode: number,
    responseTime: number,
    bytesIn: number,
    bytesOut: number
  ): void {
    this.stats.totalRequests++;
    this.stats.totalResponseTime += responseTime;
    this.stats.totalBytesIn += bytesIn;
    this.stats.totalBytesOut += bytesOut;

    if (statusCode >= 200 && statusCode < 400) {
      this.stats.successCount++;
    } else {
      this.stats.errorCount++;
    }
  }

  recordBackendRequest(
    backendId: string,
    statusCode: number,
    responseTime: number,
    bytesIn: number,
    bytesOut: number
  ): void {
    if (!this.backendStats[backendId]) {
      this.backendStats[backendId] = {
        totalRequests: 0,
        successCount: 0,
        errorCount: 0,
        totalResponseTime: 0,
        totalBytesIn: 0,
        totalBytesOut: 0,
      };
    }

    const stats = this.backendStats[backendId];
    stats.totalRequests++;
    stats.totalResponseTime += responseTime;
    stats.totalBytesIn += bytesIn;
    stats.totalBytesOut += bytesOut;

    if (statusCode >= 200 && statusCode < 400) {
      stats.successCount++;
    } else {
      stats.errorCount++;
    }
  }

  private async flush(): Promise<void> {
    if (this.stats.totalRequests === 0) {
      return; // Nothing to flush
    }

    try {
      const now = Date.now();
      const elapsedSeconds = (now - this.lastFlush) / 1000;

      // Calculate metrics
      const requestsPerSec = this.stats.totalRequests / elapsedSeconds;
      const avgResponseTime = Math.round(
        this.stats.totalResponseTime / this.stats.totalRequests
      );
      const errorRate =
        this.stats.totalRequests > 0
          ? (this.stats.errorCount / this.stats.totalRequests) * 100
          : 0;

      // Save load balancer stats
      await prisma.loadBalancerStat.create({
        data: {
          loadBalancerId: this.loadBalancerId,
          connections: 0, // TODO: Track active connections
          requestsPerSec,
          bytesIn: this.stats.totalBytesIn,
          bytesOut: this.stats.totalBytesOut,
          avgResponseTime,
          errorRate,
        },
      });

      // Save backend stats
      for (const [backendId, stats] of Object.entries(this.backendStats)) {
        const backendRequestsPerSec = stats.totalRequests / elapsedSeconds;
        const backendAvgResponseTime = Math.round(
          stats.totalResponseTime / stats.totalRequests
        );

        await prisma.backendServerStat.create({
          data: {
            backendServerId: backendId,
            connections: 0, // TODO: Track active connections
            requestsPerSec: backendRequestsPerSec,
            avgResponseTime: backendAvgResponseTime,
            bytesIn: stats.totalBytesIn,
            bytesOut: stats.totalBytesOut,
            errorCount: stats.errorCount,
          },
        });
      }

      this.logger.debug(`Flushed statistics: ${this.stats.totalRequests} requests`);

      // Reset stats
      this.stats = {
        totalRequests: 0,
        successCount: 0,
        errorCount: 0,
        totalResponseTime: 0,
        totalBytesIn: 0,
        totalBytesOut: 0,
      };
      this.backendStats = {};
      this.lastFlush = now;
    } catch (error) {
      this.logger.error('Error flushing statistics:', error);
    }
  }

  getStats() {
    return { ...this.stats };
  }
}

