import { Request, Response } from 'express';
import { prisma } from '@lb-app/database';

export class BackendServerController {
  async list(req: Request, res: Response) {
    try {
      const { poolId } = req.query;

      const where = poolId ? { poolId: poolId as string } : {};

      const servers = await prisma.backendServer.findMany({
        where,
        include: {
          pool: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json(servers);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch backend servers' });
    }
  }

  async get(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const server = await prisma.backendServer.findUnique({
        where: { id },
        include: {
          pool: true,
        },
      });

      if (!server) {
        return res.status(404).json({ error: 'Backend server not found' });
      }

      res.json(server);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch backend server' });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { name, ipAddress, port, weight, poolId, enabled } = req.body;

      const server = await prisma.backendServer.create({
        data: {
          name,
          ipAddress,
          port,
          weight: weight || 100,
          poolId,
          enabled: enabled !== undefined ? enabled : true,
        },
        include: {
          pool: true,
        },
      });

      await prisma.log.create({
        data: {
          level: 'info',
          category: 'system',
          message: `Backend server created: ${name} (${ipAddress}:${port})`,
        },
      });

      res.status(201).json(server);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Backend server already exists in this pool' });
      }
      res.status(500).json({ error: 'Failed to create backend server' });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const server = await prisma.backendServer.update({
        where: { id },
        data: req.body,
        include: {
          pool: true,
        },
      });

      await prisma.log.create({
        data: {
          level: 'info',
          category: 'system',
          message: `Backend server updated: ${server.name}`,
        },
      });

      res.json(server);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Backend server not found' });
      }
      res.status(500).json({ error: 'Failed to update backend server' });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const server = await prisma.backendServer.findUnique({
        where: { id },
      });

      await prisma.backendServer.delete({
        where: { id },
      });

      await prisma.log.create({
        data: {
          level: 'info',
          category: 'system',
          message: `Backend server deleted: ${server?.name}`,
        },
      });

      res.json({ message: 'Backend server deleted successfully' });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Backend server not found' });
      }
      res.status(500).json({ error: 'Failed to delete backend server' });
    }
  }

  async getHealth(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { limit = 100 } = req.query;

      const results = await prisma.healthCheckResult.findMany({
        where: { backendServerId: id },
        orderBy: { timestamp: 'desc' },
        take: parseInt(limit as string),
      });

      res.json(results);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch health check results' });
    }
  }
}

