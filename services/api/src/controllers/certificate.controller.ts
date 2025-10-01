import { Request, Response } from 'express';
import { prisma } from '@lb-app/database';
import * as crypto from 'crypto';

export class CertificateController {
  async list(req: Request, res: Response) {
    try {
      const certificates = await prisma.certificate.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          domain: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
          // Don't return actual cert/key content in list
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json(certificates);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch certificates' });
    }
  }

  async get(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const certificate = await prisma.certificate.findUnique({
        where: { id },
      });

      if (!certificate) {
        return res.status(404).json({ error: 'Certificate not found' });
      }

      res.json(certificate);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch certificate' });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { name, description, domain, certContent, keyContent, chainContent, expiresAt } =
        req.body;

      // TODO: Validate certificate format and extract expiration if not provided
      const expiration = expiresAt ? new Date(expiresAt) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      const certificate = await prisma.certificate.create({
        data: {
          name,
          description,
          domain,
          certContent,
          keyContent,
          chainContent,
          expiresAt: expiration,
        },
      });

      await prisma.log.create({
        data: {
          level: 'info',
          category: 'system',
          message: `Certificate created: ${name} (${domain})`,
        },
      });

      res.status(201).json(certificate);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Certificate name already exists' });
      }
      res.status(500).json({ error: 'Failed to create certificate' });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const certificate = await prisma.certificate.update({
        where: { id },
        data: req.body,
      });

      await prisma.log.create({
        data: {
          level: 'info',
          category: 'system',
          message: `Certificate updated: ${certificate.name}`,
        },
      });

      res.json(certificate);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Certificate not found' });
      }
      res.status(500).json({ error: 'Failed to update certificate' });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check if certificate is used by any load balancer
      const lbCount = await prisma.loadBalancer.count({
        where: { certificateId: id },
      });

      if (lbCount > 0) {
        return res.status(400).json({
          error: 'Cannot delete certificate that is used by load balancers',
        });
      }

      const certificate = await prisma.certificate.findUnique({
        where: { id },
      });

      await prisma.certificate.delete({
        where: { id },
      });

      await prisma.log.create({
        data: {
          level: 'info',
          category: 'system',
          message: `Certificate deleted: ${certificate?.name}`,
        },
      });

      res.json({ message: 'Certificate deleted successfully' });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Certificate not found' });
      }
      res.status(500).json({ error: 'Failed to delete certificate' });
    }
  }
}

