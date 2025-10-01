import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '@lb-app/database';

export class UserController {
  async list(req: Request, res: Response) {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json(users);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }

  async get(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { username, email, password, role } = req.body;

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          username,
          email,
          password: hashedPassword,
          role: role || 'viewer',
        },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });

      await prisma.log.create({
        data: {
          level: 'info',
          category: 'system',
          message: `User created: ${username}`,
        },
      });

      res.status(201).json(user);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Username or email already exists' });
      }
      res.status(500).json({ error: 'Failed to create user' });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { password, ...updateData } = req.body;

      // If password is being updated, hash it
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      const user = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          updatedAt: true,
        },
      });

      await prisma.log.create({
        data: {
          level: 'info',
          category: 'system',
          message: `User updated: ${user.username}`,
        },
      });

      res.json(user);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'User not found' });
      }
      res.status(500).json({ error: 'Failed to update user' });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { id },
      });

      await prisma.user.delete({
        where: { id },
      });

      await prisma.log.create({
        data: {
          level: 'info',
          category: 'system',
          message: `User deleted: ${user?.username}`,
        },
      });

      res.json({ message: 'User deleted successfully' });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'User not found' });
      }
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }
}

