import { Router } from 'express';
import { MonitoringController } from '../controllers/monitoring.controller';
import { authenticate } from '../middleware/auth';

export const monitoringRouter = Router();
const controller = new MonitoringController();

monitoringRouter.use(authenticate);

monitoringRouter.get('/system', controller.getSystemMetrics.bind(controller));

monitoringRouter.get('/lb-stats', controller.getLbStats.bind(controller));

monitoringRouter.get('/backend-stats', controller.getBackendStats.bind(controller));

