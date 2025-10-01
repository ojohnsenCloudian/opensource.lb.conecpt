import { Router } from 'express';
import { LogController } from '../controllers/log.controller';
import { authenticate } from '../middleware/auth';

export const logRouter = Router();
const controller = new LogController();

logRouter.use(authenticate);

logRouter.get('/', controller.list.bind(controller));

logRouter.get('/export', controller.export.bind(controller));

