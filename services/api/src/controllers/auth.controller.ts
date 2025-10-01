import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@lb-app/database';
import { AuthRequest } from '../middleware/auth';

export class AuthController {
  async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body;

      // Find user
      const user = await prisma.user.findUnique({
        where: { username },
      });

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.password);

      if (!isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate token
      const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
      const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
      
      const token = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn });

      // Create session
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

      await prisma.session.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Login failed' });
    }
  }

  async logout(req: AuthRequest, res: Response) {
    try {
      const token = req.headers.authorization?.substring(7);

      if (token) {
        await prisma.session.delete({
          where: { token },
        });
      }

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Logout failed' });
    }
  }

  async refresh(req: AuthRequest, res: Response) {
    try {
      const token = req.headers.authorization?.substring(7);

      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      // Update session expiration
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await prisma.session.update({
        where: { token },
        data: { expiresAt },
      });

      res.json({ message: 'Token refreshed' });
    } catch (error) {
      res.status(500).json({ error: 'Refresh failed' });
    }
  }

  async me(req: AuthRequest, res: Response) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });

      res.json(user);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get user info' });
    }
  }
}

