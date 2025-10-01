import { Router } from 'express';
import { body } from 'express-validator';
import { UserController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const userRouter = Router();
const controller = new UserController();

userRouter.use(authenticate);

userRouter.get('/', controller.list.bind(controller));

userRouter.post(
  '/',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('email').isEmail().withMessage('Invalid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    validate,
  ],
  controller.create.bind(controller)
);

userRouter.get('/:id', controller.get.bind(controller));

userRouter.put('/:id', controller.update.bind(controller));

userRouter.delete('/:id', controller.delete.bind(controller));

