import { Router } from 'express';
import { authRouter } from './auth.routes';
import { loadBalancerRouter } from './load-balancer.routes';
import { backendServerRouter } from './backend-server.routes';
import { serverPoolRouter } from './server-pool.routes';
import { certificateRouter } from './certificate.routes';
import { healthCheckRouter } from './health-check.routes';
import { monitoringRouter } from './monitoring.routes';
import { logRouter } from './log.routes';
import { vipRouter } from './vip.routes';
import { userRouter } from './user.routes';

export const router = Router();

router.use('/auth', authRouter);
router.use('/load-balancers', loadBalancerRouter);
router.use('/backend-servers', backendServerRouter);
router.use('/server-pools', serverPoolRouter);
router.use('/certificates', certificateRouter);
router.use('/health-checks', healthCheckRouter);
router.use('/monitoring', monitoringRouter);
router.use('/logs', logRouter);
router.use('/vip', vipRouter);
router.use('/users', userRouter);

