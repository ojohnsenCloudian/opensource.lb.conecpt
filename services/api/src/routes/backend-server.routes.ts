import { Router } from 'express';
import { body } from 'express-validator';
import { BackendServerController } from '../controllers/backend-server.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const backendServerRouter = Router();
const controller = new BackendServerController();

backendServerRouter.use(authenticate);

backendServerRouter.get('/', controller.list.bind(controller));

backendServerRouter.post(
  '/',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('ipAddress').isIP().withMessage('Invalid IP address'),
    body('port').isInt({ min: 1, max: 65535 }).withMessage('Invalid port'),
    body('poolId').notEmpty().withMessage('Pool ID is required'),
    validate,
  ],
  controller.create.bind(controller)
);

backendServerRouter.get('/:id', controller.get.bind(controller));

backendServerRouter.put('/:id', controller.update.bind(controller));

backendServerRouter.delete('/:id', controller.delete.bind(controller));

backendServerRouter.get('/:id/health', controller.getHealth.bind(controller));

