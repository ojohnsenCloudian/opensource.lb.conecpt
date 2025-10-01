#!/bin/bash

echo "========================================="
echo "API Login Fix Script"
echo "========================================="
echo ""

# Stop API service
echo "1. Stopping API service..."
systemctl stop lb-api.service

# Go to project directory
cd /opt/lb-app

echo ""
echo "2. Checking database..."
echo "======================"
if [ -f data/lb-app.db ]; then
  echo "✓ Database exists"
  ls -la data/lb-app.db
else
  echo "✗ Database missing, recreating..."
  mkdir -p data
  chown lb-app:lb-app data
fi

echo ""
echo "3. Recreating database and seeding..."
echo "====================================="
# Remove old database
rm -f data/lb-app.db

# Generate Prisma client
echo "Generating Prisma client..."
cd packages/database
NODE_PATH="/opt/lb-app/node_modules:/opt/lb-app/packages/database/node_modules" \
node_modules/.bin/prisma generate

# Push schema
echo "Pushing database schema..."
NODE_PATH="/opt/lb-app/node_modules:/opt/lb-app/packages/database/node_modules" \
node_modules/.bin/prisma db push

# Seed database
echo "Seeding database..."
cat > /tmp/quick-seed.js << 'EOF'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seed() {
  try {
    console.log('Starting database seed...');
    
    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 8);
    const adminUser = await prisma.user.upsert({
      where: { username: 'admin' },
      update: {},
      create: {
        username: 'admin',
        email: 'admin@localhost',
        password: hashedPassword,
        role: 'ADMIN',
      },
    });
    console.log('✓ Admin user created:', adminUser.username);
    
    // Create default server pool
    const defaultPool = await prisma.serverPool.upsert({
      where: { name: 'default-pool' },
      update: {},
      create: {
        name: 'default-pool',
        description: 'Default server pool',
        algorithm: 'ROUND_ROBIN',
        healthCheckId: null,
      },
    });
    console.log('✓ Default server pool created:', defaultPool.name);
    
    // Create default health check
    const defaultHealthCheck = await prisma.healthCheck.upsert({
      where: { name: 'default-http' },
      update: {},
      create: {
        name: 'default-http',
        type: 'HTTP',
        path: '/health',
        port: 80,
        interval: 30,
        timeout: 5,
        retries: 3,
        expectedStatus: 200,
        expectedResponse: '',
      },
    });
    console.log('✓ Default health check created:', defaultHealthCheck.name);
    
    console.log('✓ Database seeded successfully');
  } catch (error) {
    console.error('✗ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
EOF

NODE_PATH="/opt/lb-app/node_modules:/opt/lb-app/packages/database/node_modules" \
node /tmp/quick-seed.js

echo ""
echo "4. Testing database connection..."
echo "================================="
NODE_PATH="/opt/lb-app/node_modules:/opt/lb-app/packages/database/node_modules" \
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.findMany().then(users => {
  console.log('✓ Database connection successful');
  console.log('Users found:', users.length);
  users.forEach(user => {
    console.log('  -', user.username, '(' + user.role + ')');
  });
  prisma.\$disconnect();
}).catch(err => {
  console.log('✗ Database connection failed:', err.message);
  process.exit(1);
});
"

echo ""
echo "5. Starting API service..."
echo "=========================="
systemctl start lb-api.service
sleep 3

echo ""
echo "6. Testing API endpoints..."
echo "==========================="
echo "Health check:"
curl -s http://localhost:4000/health | jq . 2>/dev/null || curl -s http://localhost:4000/health

echo ""
echo "Login test:"
curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq . 2>/dev/null || \
curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

echo ""
echo "7. Checking API service status..."
echo "================================="
systemctl status lb-api.service --no-pager

echo ""
echo "8. Recent API logs..."
echo "===================="
journalctl -u lb-api -n 10 --no-pager

echo ""
echo "API login fix completed!"
echo "========================"
echo "Try logging in again with:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "If still failing, check logs with:"
echo "  journalctl -u lb-api -f"
