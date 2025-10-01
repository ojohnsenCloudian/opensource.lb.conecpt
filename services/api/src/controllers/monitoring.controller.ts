import { Request, Response } from 'express';
import { prisma } from '@lb-app/database';
import * as si from 'systeminformation';

export class MonitoringController {
  async getSystemMetrics(req: Request, res: Response) {
    try {
      // Get real-time system metrics
      const [cpu, mem, fsSize, networkStats] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.networkStats(),
      ]);

      const metrics = {
        cpu: {
          usage: cpu.currentLoad,
          cores: cpu.cpus.length,
        },
        memory: {
          total: Math.round(mem.total / 1024 / 1024), // MB
          used: Math.round(mem.used / 1024 / 1024), // MB
          free: Math.round(mem.free / 1024 / 1024), // MB
          usagePercent: (mem.used / mem.total) * 100,
        },
        disk: fsSize.map((fs) => ({
          fs: fs.fs,
          type: fs.type,
          size: Math.round(fs.size / 1024 / 1024 / 1024), // GB
          used: Math.round(fs.used / 1024 / 1024 / 1024), // GB
          available: Math.round(fs.available / 1024 / 1024 / 1024), // GB
          usagePercent: fs.use,
          mount: fs.mount,
        })),
        network: networkStats.map((net) => ({
          iface: net.iface,
          operstate: net.operstate,
          rx_bytes: net.rx_bytes,
          tx_bytes: net.tx_bytes,
          rx_sec: net.rx_sec,
          tx_sec: net.tx_sec,
        })),
        timestamp: new Date(),
      };

      // Save to database for historical tracking
      if (fsSize[0]) {
        await prisma.systemMetric.create({
          data: {
            cpuUsage: cpu.currentLoad,
            memoryUsage: (mem.used / mem.total) * 100,
            memoryTotal: Math.round(mem.total / 1024 / 1024),
            memoryUsed: Math.round(mem.used / 1024 / 1024),
            diskUsage: fsSize[0].use,
            diskTotal: Math.round(fsSize[0].size / 1024 / 1024 / 1024),
            diskUsed: Math.round(fsSize[0].used / 1024 / 1024 / 1024),
            networkBytesIn: networkStats[0]?.rx_bytes || 0,
            networkBytesOut: networkStats[0]?.tx_bytes || 0,
          },
        });
      }

      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch system metrics' });
    }
  }

  async getLbStats(req: Request, res: Response) {
    try {
      const { loadBalancerId, from, to, limit = 100 } = req.query;

      const where: any = {};
      if (loadBalancerId) {
        where.loadBalancerId = loadBalancerId as string;
      }
      if (from || to) {
        where.timestamp = {};
        if (from) where.timestamp.gte = new Date(from as string);
        if (to) where.timestamp.lte = new Date(to as string);
      }

      const stats = await prisma.loadBalancerStat.findMany({
        where,
        include: {
          loadBalancer: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        take: parseInt(limit as string),
      });

      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch load balancer statistics' });
    }
  }

  async getBackendStats(req: Request, res: Response) {
    try {
      const { backendServerId, from, to, limit = 100 } = req.query;

      const where: any = {};
      if (backendServerId) {
        where.backendServerId = backendServerId as string;
      }
      if (from || to) {
        where.timestamp = {};
        if (from) where.timestamp.gte = new Date(from as string);
        if (to) where.timestamp.lte = new Date(to as string);
      }

      const stats = await prisma.backendServerStat.findMany({
        where,
        include: {
          backendServer: {
            select: {
              id: true,
              name: true,
              ipAddress: true,
              port: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        take: parseInt(limit as string),
      });

      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch backend server statistics' });
    }
  }
}

