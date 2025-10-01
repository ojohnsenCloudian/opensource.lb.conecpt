import { Router } from 'express';
import { body } from 'express-validator';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const authRouter = Router();
const controller = new AuthController();

authRouter.post(
  '/login',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
    validate,
  ],
  controller.login.bind(controller)
);

authRouter.post('/logout', authenticate, controller.logout.bind(controller));

authRouter.post('/refresh', authenticate, controller.refresh.bind(controller));

authRouter.get('/me', authenticate, controller.me.bind(controller));

