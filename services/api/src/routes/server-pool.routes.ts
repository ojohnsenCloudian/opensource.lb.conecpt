import { Router } from 'express';
import { body } from 'express-validator';
import { ServerPoolController } from '../controllers/server-pool.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const serverPoolRouter = Router();
const controller = new ServerPoolController();

serverPoolRouter.use(authenticate);

serverPoolRouter.get('/', controller.list.bind(controller));

serverPoolRouter.post(
  '/',
  [
    body('name').notEmpty().withMessage('Name is required'),
    validate,
  ],
  controller.create.bind(controller)
);

serverPoolRouter.get('/:id', controller.get.bind(controller));

serverPoolRouter.put('/:id', controller.update.bind(controller));

serverPoolRouter.delete('/:id', controller.delete.bind(controller));

