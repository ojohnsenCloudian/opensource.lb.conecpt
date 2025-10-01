import { Router } from 'express';
import { body } from 'express-validator';
import { VipController } from '../controllers/vip.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const vipRouter = Router();
const controller = new VipController();

vipRouter.use(authenticate);

vipRouter.get('/', controller.list.bind(controller));

vipRouter.post(
  '/',
  [
    body('ipAddress').isIP().withMessage('Invalid IP address'),
    validate,
  ],
  controller.create.bind(controller)
);

vipRouter.post('/:id/activate', controller.activate.bind(controller));

vipRouter.post('/:id/deactivate', controller.deactivate.bind(controller));

vipRouter.delete('/:id', controller.delete.bind(controller));

