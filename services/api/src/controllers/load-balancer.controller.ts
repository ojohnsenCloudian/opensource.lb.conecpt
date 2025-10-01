import { Request, Response } from 'express';
import { prisma } from '@lb-app/database';

export class LoadBalancerController {
  async list(req: Request, res: Response) {
    try {
      const loadBalancers = await prisma.loadBalancer.findMany({
        include: {
          vip: true,
          certificate: {
            select: {
              id: true,
              name: true,
              domain: true,
              expiresAt: true,
            },
          },
          serverPool: {
            include: {
              servers: true,
            },
          },
          healthCheck: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json(loadBalancers);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch load balancers' });
    }
  }

  async get(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const loadBalancer = await prisma.loadBalancer.findUnique({
        where: { id },
        include: {
          vip: true,
          certificate: true,
          serverPool: {
            include: {
              servers: true,
            },
          },
          healthCheck: true,
        },
      });

      if (!loadBalancer) {
        return res.status(404).json({ error: 'Load balancer not found' });
      }

      res.json(loadBalancer);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch load balancer' });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const {
        name,
        description,
        protocol,
        listenPort,
        algorithm,
        vipId,
        certificateId,
        serverPoolId,
        healthCheckId,
        sessionPersistence,
        connectionTimeout,
        requestTimeout,
        maxRetries,
      } = req.body;

      const loadBalancer = await prisma.loadBalancer.create({
        data: {
          name,
          description,
          protocol,
          listenPort,
          algorithm: algorithm || 'roundrobin',
          vipId,
          certificateId,
          serverPoolId,
          healthCheckId,
          sessionPersistence: sessionPersistence || false,
          connectionTimeout: connectionTimeout || 5000,
          requestTimeout: requestTimeout || 30000,
          maxRetries: maxRetries || 2,
          enabled: false,
        },
        include: {
          vip: true,
          certificate: true,
          serverPool: {
            include: {
              servers: true,
            },
          },
          healthCheck: true,
        },
      });

      await prisma.log.create({
        data: {
          level: 'info',
          category: 'loadbalancer',
          message: `Load balancer created: ${name}`,
          loadBalancerId: loadBalancer.id,
        },
      });

      res.status(201).json(loadBalancer);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Load balancer name already exists' });
      }
      res.status(500).json({ error: 'Failed to create load balancer' });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const loadBalancer = await prisma.loadBalancer.update({
        where: { id },
        data: req.body,
        include: {
          vip: true,
          certificate: true,
          serverPool: {
            include: {
              servers: true,
            },
          },
          healthCheck: true,
        },
      });

      await prisma.log.create({
        data: {
          level: 'info',
          category: 'loadbalancer',
          message: `Load balancer updated: ${loadBalancer.name}`,
          loadBalancerId: id,
        },
      });

      res.json(loadBalancer);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Load balancer not found' });
      }
      res.status(500).json({ error: 'Failed to update load balancer' });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const loadBalancer = await prisma.loadBalancer.findUnique({
        where: { id },
      });

      if (loadBalancer?.enabled) {
        return res.status(400).json({
          error: 'Cannot delete enabled load balancer. Disable it first.',
        });
      }

      await prisma.loadBalancer.delete({
        where: { id },
      });

      await prisma.log.create({
        data: {
          level: 'info',
          category: 'loadbalancer',
          message: `Load balancer deleted: ${loadBalancer?.name}`,
        },
      });

      res.json({ message: 'Load balancer deleted successfully' });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Load balancer not found' });
      }
      res.status(500).json({ error: 'Failed to delete load balancer' });
    }
  }

  async enable(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const loadBalancer = await prisma.loadBalancer.update({
        where: { id },
        data: { enabled: true },
      });

      await prisma.log.create({
        data: {
          level: 'info',
          category: 'loadbalancer',
          message: `Load balancer enabled: ${loadBalancer.name}`,
          loadBalancerId: id,
        },
      });

      res.json(loadBalancer);
    } catch (error) {
      res.status(500).json({ error: 'Failed to enable load balancer' });
    }
  }

  async disable(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const loadBalancer = await prisma.loadBalancer.update({
        where: { id },
        data: { enabled: false },
      });

      await prisma.log.create({
        data: {
          level: 'info',
          category: 'loadbalancer',
          message: `Load balancer disabled: ${loadBalancer.name}`,
          loadBalancerId: id,
        },
      });

      res.json(loadBalancer);
    } catch (error) {
      res.status(500).json({ error: 'Failed to disable load balancer' });
    }
  }

  async getStats(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { limit = 100 } = req.query;

      const stats = await prisma.loadBalancerStat.findMany({
        where: { loadBalancerId: id },
        orderBy: { timestamp: 'desc' },
        take: parseInt(limit as string),
      });

      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  }
}

