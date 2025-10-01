import { Request, Response } from 'express';
import { prisma } from '@lb-app/database';

export class LogController {
  async list(req: Request, res: Response) {
    try {
      const { level, category, loadBalancerId, from, to, limit = 100 } = req.query;

      const where: any = {};
      if (level) where.level = level as string;
      if (category) where.category = category as string;
      if (loadBalancerId) where.loadBalancerId = loadBalancerId as string;
      if (from || to) {
        where.timestamp = {};
        if (from) where.timestamp.gte = new Date(from as string);
        if (to) where.timestamp.lte = new Date(to as string);
      }

      const logs = await prisma.log.findMany({
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

      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  }

  async export(req: Request, res: Response) {
    try {
      const { level, category, loadBalancerId, from, to } = req.query;

      const where: any = {};
      if (level) where.level = level as string;
      if (category) where.category = category as string;
      if (loadBalancerId) where.loadBalancerId = loadBalancerId as string;
      if (from || to) {
        where.timestamp = {};
        if (from) where.timestamp.gte = new Date(from as string);
        if (to) where.timestamp.lte = new Date(to as string);
      }

      const logs = await prisma.log.findMany({
        where,
        include: {
          loadBalancer: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
      });

      // Convert to CSV format
      const csv = [
        'Timestamp,Level,Category,Load Balancer,Message',
        ...logs.map((log) =>
          [
            log.timestamp.toISOString(),
            log.level,
            log.category,
            log.loadBalancer?.name || '',
            `"${log.message.replace(/"/g, '""')}"`,
          ].join(',')
        ),
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=logs-${Date.now()}.csv`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({ error: 'Failed to export logs' });
    }
  }
}

