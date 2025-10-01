import { Router } from 'express';
import { body } from 'express-validator';
import { CertificateController } from '../controllers/certificate.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const certificateRouter = Router();
const controller = new CertificateController();

certificateRouter.use(authenticate);

certificateRouter.get('/', controller.list.bind(controller));

certificateRouter.post(
  '/',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('domain').notEmpty().withMessage('Domain is required'),
    body('certContent').notEmpty().withMessage('Certificate content is required'),
    body('keyContent').notEmpty().withMessage('Key content is required'),
    validate,
  ],
  controller.create.bind(controller)
);

certificateRouter.get('/:id', controller.get.bind(controller));

certificateRouter.put('/:id', controller.update.bind(controller));

certificateRouter.delete('/:id', controller.delete.bind(controller));

