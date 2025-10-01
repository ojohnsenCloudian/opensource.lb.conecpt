import { Request, Response } from 'express';
import { prisma } from '@lb-app/database';

export class ServerPoolController {
  async list(req: Request, res: Response) {
    try {
      const pools = await prisma.serverPool.findMany({
        include: {
          servers: true,
          _count: {
            select: { servers: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json(pools);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch server pools' });
    }
  }

  async get(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const pool = await prisma.serverPool.findUnique({
        where: { id },
        include: {
          servers: true,
        },
      });

      if (!pool) {
        return res.status(404).json({ error: 'Server pool not found' });
      }

      res.json(pool);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch server pool' });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { name, description } = req.body;

      const pool = await prisma.serverPool.create({
        data: {
          name,
          description,
        },
      });

      await prisma.log.create({
        data: {
          level: 'info',
          category: 'system',
          message: `Server pool created: ${name}`,
        },
      });

      res.status(201).json(pool);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Server pool name already exists' });
      }
      res.status(500).json({ error: 'Failed to create server pool' });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const pool = await prisma.serverPool.update({
        where: { id },
        data: req.body,
      });

      await prisma.log.create({
        data: {
          level: 'info',
          category: 'system',
          message: `Server pool updated: ${pool.name}`,
        },
      });

      res.json(pool);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Server pool not found' });
      }
      res.status(500).json({ error: 'Failed to update server pool' });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check if pool is used by any load balancer
      const lbCount = await prisma.loadBalancer.count({
        where: { serverPoolId: id },
      });

      if (lbCount > 0) {
        return res.status(400).json({
          error: 'Cannot delete server pool that is used by load balancers',
        });
      }

      const pool = await prisma.serverPool.findUnique({
        where: { id },
      });

      await prisma.serverPool.delete({
        where: { id },
      });

      await prisma.log.create({
        data: {
          level: 'info',
          category: 'system',
          message: `Server pool deleted: ${pool?.name}`,
        },
      });

      res.json({ message: 'Server pool deleted successfully' });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Server pool not found' });
      }
      res.status(500).json({ error: 'Failed to delete server pool' });
    }
  }
}

