import { Request, Response } from 'express';
import { prisma } from '@lb-app/database';

export class HealthCheckController {
  async list(req: Request, res: Response) {
    try {
      const healthChecks = await prisma.healthCheck.findMany({
        orderBy: { createdAt: 'desc' },
      });

      res.json(healthChecks);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch health checks' });
    }
  }

  async get(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const healthCheck = await prisma.healthCheck.findUnique({
        where: { id },
      });

      if (!healthCheck) {
        return res.status(404).json({ error: 'Health check not found' });
      }

      res.json(healthCheck);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch health check' });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const {
        name,
        type,
        path,
        interval,
        timeout,
        healthyThreshold,
        unhealthyThreshold,
        expectedStatus,
      } = req.body;

      const healthCheck = await prisma.healthCheck.create({
        data: {
          name,
          type,
          path,
          interval: interval || 10,
          timeout: timeout || 5,
          healthyThreshold: healthyThreshold || 2,
          unhealthyThreshold: unhealthyThreshold || 3,
          expectedStatus: expectedStatus || 200,
        },
      });

      await prisma.log.create({
        data: {
          level: 'info',
          category: 'healthcheck',
          message: `Health check created: ${name}`,
        },
      });

      res.status(201).json(healthCheck);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Health check name already exists' });
      }
      res.status(500).json({ error: 'Failed to create health check' });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const healthCheck = await prisma.healthCheck.update({
        where: { id },
        data: req.body,
      });

      await prisma.log.create({
        data: {
          level: 'info',
          category: 'healthcheck',
          message: `Health check updated: ${healthCheck.name}`,
        },
      });

      res.json(healthCheck);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Health check not found' });
      }
      res.status(500).json({ error: 'Failed to update health check' });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check if health check is used by any load balancer
      const lbCount = await prisma.loadBalancer.count({
        where: { healthCheckId: id },
      });

      if (lbCount > 0) {
        return res.status(400).json({
          error: 'Cannot delete health check that is used by load balancers',
        });
      }

      const healthCheck = await prisma.healthCheck.findUnique({
        where: { id },
      });

      await prisma.healthCheck.delete({
        where: { id },
      });

      await prisma.log.create({
        data: {
          level: 'info',
          category: 'healthcheck',
          message: `Health check deleted: ${healthCheck?.name}`,
        },
      });

      res.json({ message: 'Health check deleted successfully' });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Health check not found' });
      }
      res.status(500).json({ error: 'Failed to delete health check' });
    }
  }

  async getResults(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { limit = 100 } = req.query;

      const results = await prisma.healthCheckResult.findMany({
        where: { healthCheckId: id },
        include: {
          backendServer: true,
        },
        orderBy: { timestamp: 'desc' },
        take: parseInt(limit as string),
      });

      res.json(results);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch health check results' });
    }
  }
}

