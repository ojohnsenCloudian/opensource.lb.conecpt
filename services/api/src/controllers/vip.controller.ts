import { Request, Response } from 'express';
import { prisma } from '@lb-app/database';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class VipController {
  async list(req: Request, res: Response) {
    try {
      const vips = await prisma.virtualIP.findMany({
        include: {
          _count: {
            select: { loadBalancers: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json(vips);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch VIPs' });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { ipAddress, interface: iface, description } = req.body;

      // Create VIP record
      const vip = await prisma.virtualIP.create({
        data: {
          ipAddress,
          interface: iface || 'eth0',
          description,
          active: false,
        },
      });

      // Activate VIP on system (requires root privileges)
      try {
        await this.activateVip(vip.ipAddress, vip.interface);
        
        await prisma.virtualIP.update({
          where: { id: vip.id },
          data: { active: true },
        });

        vip.active = true;
      } catch (error) {
        // Log error but don't fail the request
        await prisma.log.create({
          data: {
            level: 'warning',
            category: 'system',
            message: `Failed to activate VIP ${ipAddress}: ${error}`,
          },
        });
      }

      await prisma.log.create({
        data: {
          level: 'info',
          category: 'system',
          message: `VIP created: ${ipAddress}`,
        },
      });

      res.status(201).json(vip);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'VIP already exists' });
      }
      res.status(500).json({ error: 'Failed to create VIP' });
    }
  }

  async activate(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const vip = await prisma.virtualIP.findUnique({
        where: { id },
      });

      if (!vip) {
        return res.status(404).json({ error: 'VIP not found' });
      }

      if (vip.active) {
        return res.status(400).json({ error: 'VIP is already active' });
      }

      // Activate VIP on system
      try {
        await this.activateVip(vip.ipAddress, vip.interface);
        
        await prisma.virtualIP.update({
          where: { id },
          data: { active: true },
        });

        await prisma.log.create({
          data: {
            level: 'info',
            category: 'system',
            message: `VIP activated: ${vip.ipAddress}`,
          },
        });

        res.json({ message: 'VIP activated successfully', active: true });
      } catch (error) {
        await prisma.log.create({
          data: {
            level: 'error',
            category: 'system',
            message: `Failed to activate VIP ${vip.ipAddress}: ${error}`,
          },
        });
        
        res.status(500).json({ error: `Failed to activate VIP: ${error}` });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to activate VIP' });
    }
  }

  async deactivate(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const vip = await prisma.virtualIP.findUnique({
        where: { id },
      });

      if (!vip) {
        return res.status(404).json({ error: 'VIP not found' });
      }

      if (!vip.active) {
        return res.status(400).json({ error: 'VIP is not active' });
      }

      // Check if VIP is used by any load balancer
      const lbCount = await prisma.loadBalancer.count({
        where: { vipId: id, enabled: true },
      });

      if (lbCount > 0) {
        return res.status(400).json({
          error: 'Cannot deactivate VIP that is used by active load balancers',
        });
      }

      // Deactivate VIP on system
      try {
        await this.deactivateVip(vip.ipAddress, vip.interface);
        
        await prisma.virtualIP.update({
          where: { id },
          data: { active: false },
        });

        await prisma.log.create({
          data: {
            level: 'info',
            category: 'system',
            message: `VIP deactivated: ${vip.ipAddress}`,
          },
        });

        res.json({ message: 'VIP deactivated successfully', active: false });
      } catch (error) {
        await prisma.log.create({
          data: {
            level: 'error',
            category: 'system',
            message: `Failed to deactivate VIP ${vip.ipAddress}: ${error}`,
          },
        });
        
        res.status(500).json({ error: `Failed to deactivate VIP: ${error}` });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to deactivate VIP' });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const vip = await prisma.virtualIP.findUnique({
        where: { id },
      });

      if (!vip) {
        return res.status(404).json({ error: 'VIP not found' });
      }

      // Check if VIP is used by any load balancer
      const lbCount = await prisma.loadBalancer.count({
        where: { vipId: id },
      });

      if (lbCount > 0) {
        return res.status(400).json({
          error: 'Cannot delete VIP that is used by load balancers',
        });
      }

      // Deactivate VIP on system
      if (vip.active) {
        try {
          await this.deactivateVip(vip.ipAddress, vip.interface);
        } catch (error) {
          // Log error but continue with deletion
          await prisma.log.create({
            data: {
              level: 'warning',
              category: 'system',
              message: `Failed to deactivate VIP ${vip.ipAddress}: ${error}`,
            },
          });
        }
      }

      await prisma.virtualIP.delete({
        where: { id },
      });

      await prisma.log.create({
        data: {
          level: 'info',
          category: 'system',
          message: `VIP deleted: ${vip.ipAddress}`,
        },
      });

      res.json({ message: 'VIP deleted successfully' });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'VIP not found' });
      }
      res.status(500).json({ error: 'Failed to delete VIP' });
    }
  }

  private async activateVip(ipAddress: string, iface: string): Promise<void> {
    // Use the VIP manager script with sudo
    const command = `sudo /opt/lb-app/scripts/vip-manager.sh ${ipAddress} ${iface} activate`;
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr && !stderr.includes('already assigned')) {
      throw new Error(`VIP activation failed: ${stderr}`);
    }
  }

  private async deactivateVip(ipAddress: string, iface: string): Promise<void> {
    // Use the VIP manager script with sudo
    const command = `sudo /opt/lb-app/scripts/vip-manager.sh ${ipAddress} ${iface} deactivate`;
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr && !stderr.includes('not assigned')) {
      throw new Error(`VIP deactivation failed: ${stderr}`);
    }
  }
}

