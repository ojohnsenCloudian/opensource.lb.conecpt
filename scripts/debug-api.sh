#!/bin/bash

echo "========================================="
echo "API Debugging Script"
echo "========================================="
echo ""

echo "1. Checking API service status..."
echo "================================="
systemctl status lb-api.service --no-pager

echo ""
echo "2. Testing API health endpoint..."
echo "================================="
curl -v http://localhost:4000/health 2>&1

echo ""
echo "3. Testing API base endpoint..."
echo "==============================="
curl -v http://localhost:4000/api/v1 2>&1

echo ""
echo "4. Testing login endpoint..."
echo "============================"
curl -v -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' 2>&1

echo ""
echo "5. Checking API logs (last 20 lines)..."
echo "========================================"
journalctl -u lb-api -n 20 --no-pager

echo ""
echo "6. Checking if database exists and is accessible..."
echo "=================================================="
if [ -f /opt/lb-app/data/lb-app.db ]; then
  echo "✓ Database file exists: /opt/lb-app/data/lb-app.db"
  ls -la /opt/lb-app/data/lb-app.db
else
  echo "✗ Database file not found"
fi

echo ""
echo "7. Checking database permissions..."
echo "=================================="
ls -la /opt/lb-app/data/ 2>/dev/null || echo "Data directory not found"

echo ""
echo "8. Testing database connection..."
echo "================================="
cd /opt/lb-app
if [ -f packages/database/node_modules/.bin/prisma ]; then
  echo "Testing Prisma connection..."
  NODE_PATH="/opt/lb-app/node_modules:/opt/lb-app/packages/database/node_modules" \
  node -e "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    prisma.user.findMany().then(users => {
      console.log('✓ Database connection successful');
      console.log('Users found:', users.length);
      if (users.length > 0) {
        console.log('First user:', users[0].username);
      }
      prisma.\$disconnect();
    }).catch(err => {
      console.log('✗ Database connection failed:', err.message);
      process.exit(1);
    });
  "
else
  echo "✗ Prisma client not found"
fi

echo ""
echo "9. Checking API environment..."
echo "=============================="
echo "API_PORT: $API_PORT"
echo "DATABASE_URL: $DATABASE_URL"
echo "JWT_SECRET: $JWT_SECRET"

echo ""
echo "10. Checking API process..."
echo "==========================="
ps aux | grep -E "(node|lb-api)" | grep -v grep

echo ""
echo "Debug completed!"
echo "================"
