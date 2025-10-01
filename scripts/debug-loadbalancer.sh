#!/bin/bash

echo "========================================="
echo "Load Balancer Debug Information"
echo "========================================="
echo ""

echo "1. Checking what's listening on ports 3000 and 4000..."
echo "======================================================"
netstat -tlnp | grep -E ':(3000|4000)' || ss -tlnp | grep -E ':(3000|4000)'

echo ""
echo "2. Checking VIP addresses..."
echo "============================"
ip addr show | grep -E 'inet.*192\.168\.64\.'

echo ""
echo "3. Checking load balancer service status..."
echo "==========================================="
systemctl status lb-engine --no-pager

echo ""
echo "4. Recent load balancer engine logs..."
echo "======================================"
journalctl -u lb-engine -n 20 --no-pager

echo ""
echo "5. Checking database for load balancer configuration..."
echo "======================================================"
cd /opt/lb-app
NODE_PATH="/opt/lb-app/node_modules:/opt/lb-app/packages/database/node_modules" \
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLB() {
  try {
    const lbs = await prisma.loadBalancer.findMany({
      include: {
        vip: true,
        serverPool: {
          include: {
            servers: true
          }
        }
      }
    });
    
    console.log('Load Balancers in database:');
    lbs.forEach(lb => {
      console.log(\`- \${lb.name}: port \${lb.listenPort}, enabled: \${lb.enabled}\`);
      console.log(\`  VIP: \${lb.vip ? lb.vip.ipAddress : 'None'}\`);
      console.log(\`  Backends: \${lb.serverPool.servers.length}\`);
    });
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await prisma.\$disconnect();
  }
}

checkLB();
"

echo ""
echo "6. Testing port connectivity..."
echo "==============================="
echo "Testing port 3000:"
curl -s -o /dev/null -w "HTTP Status: %{http_code}, Time: %{time_total}s\n" http://localhost:3000/ || echo "Port 3000 not responding"

echo "Testing port 4000:"
curl -s -o /dev/null -w "HTTP Status: %{http_code}, Time: %{time_total}s\n" http://localhost:4000/health || echo "Port 4000 not responding"

echo ""
echo "Debug completed!"
