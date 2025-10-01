import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default admin user (using lower rounds for faster seeding)
  const hashedPassword = await bcrypt.hash('admin123', 8);
  
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@loadbalancer.local',
      password: hashedPassword,
      role: 'admin',
    },
  });

  console.log('✅ Created admin user:', admin.username);

  // Create a sample server pool
  const pool = await prisma.serverPool.create({
    data: {
      name: 'default-pool',
      description: 'Default backend server pool',
    },
  });

  console.log('✅ Created server pool:', pool.name);

  // Create sample backend servers
  const backend1 = await prisma.backendServer.create({
    data: {
      name: 'backend-1',
      ipAddress: '192.168.1.10',
      port: 8080,
      weight: 100,
      poolId: pool.id,
      enabled: true,
    },
  });

  const backend2 = await prisma.backendServer.create({
    data: {
      name: 'backend-2',
      ipAddress: '192.168.1.11',
      port: 8080,
      weight: 100,
      poolId: pool.id,
      enabled: true,
    },
  });

  console.log('✅ Created backend servers');

  // Create a sample health check
  const healthCheck = await prisma.healthCheck.create({
    data: {
      name: 'http-health-check',
      type: 'http',
      path: '/health',
      interval: 10,
      timeout: 5,
      healthyThreshold: 2,
      unhealthyThreshold: 3,
      expectedStatus: 200,
    },
  });

  console.log('✅ Created health check');

  // Create a sample VIP
  const vip = await prisma.virtualIP.create({
    data: {
      ipAddress: '10.0.0.100',
      interface: 'eth0',
      description: 'Primary VIP',
      active: false,
    },
  });

  console.log('✅ Created VIP');

  // Create a sample load balancer (disabled by default)
  const lb = await prisma.loadBalancer.create({
    data: {
      name: 'example-lb',
      description: 'Example load balancer configuration',
      protocol: 'http',
      listenPort: 80,
      algorithm: 'roundrobin',
      enabled: false,
      serverPoolId: pool.id,
      healthCheckId: healthCheck.id,
      vipId: vip.id,
    },
  });

  console.log('✅ Created load balancer:', lb.name);

  console.log('🎉 Seeding completed!');
  console.log('\nDefault credentials:');
  console.log('  Username: admin');
  console.log('  Password: admin123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

