import { Router } from 'express';
import { body } from 'express-validator';
import { HealthCheckController } from '../controllers/health-check.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const healthCheckRouter = Router();
const controller = new HealthCheckController();

healthCheckRouter.use(authenticate);

healthCheckRouter.get('/', controller.list.bind(controller));

healthCheckRouter.post(
  '/',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('type').isIn(['http', 'https', 'tcp']).withMessage('Invalid type'),
    validate,
  ],
  controller.create.bind(controller)
);

healthCheckRouter.get('/:id', controller.get.bind(controller));

healthCheckRouter.put('/:id', controller.update.bind(controller));

healthCheckRouter.delete('/:id', controller.delete.bind(controller));

healthCheckRouter.get('/:id/results', controller.getResults.bind(controller));

