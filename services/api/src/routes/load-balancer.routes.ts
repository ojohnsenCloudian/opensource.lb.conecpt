import { Router } from 'express';
import { body } from 'express-validator';
import { LoadBalancerController } from '../controllers/load-balancer.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const loadBalancerRouter = Router();
const controller = new LoadBalancerController();

// All routes require authentication
loadBalancerRouter.use(authenticate);

loadBalancerRouter.get('/', controller.list.bind(controller));

loadBalancerRouter.post(
  '/',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('protocol').isIn(['http', 'https', 'tcp']).withMessage('Invalid protocol'),
    body('listenPort').isInt({ min: 1, max: 65535 }).withMessage('Invalid port'),
    body('serverPoolId').notEmpty().withMessage('Server pool is required'),
    validate,
  ],
  controller.create.bind(controller)
);

loadBalancerRouter.get('/:id', controller.get.bind(controller));

loadBalancerRouter.put('/:id', controller.update.bind(controller));

loadBalancerRouter.delete('/:id', controller.delete.bind(controller));

loadBalancerRouter.post('/:id/enable', controller.enable.bind(controller));

loadBalancerRouter.post('/:id/disable', controller.disable.bind(controller));

loadBalancerRouter.get('/:id/stats', controller.getStats.bind(controller));

