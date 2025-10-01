#!/bin/bash

echo "========================================="
echo "Complete Frontend Fix"
echo "========================================="
echo ""

# Stop the failing service
echo "Stopping frontend service..."
systemctl stop lb-frontend.service

# Go to frontend directory
cd /opt/lb-app/frontend

echo "Current directory: $(pwd)"
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

echo ""
echo "Step 1: Clean and reinstall dependencies..."
echo "==========================================="
rm -rf node_modules package-lock.json
npm install

echo ""
echo "Step 2: Check if .env.local exists..."
echo "====================================="
if [ ! -f .env.local ]; then
  echo "Creating .env.local..."
  cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:4000
EOF
  echo "✓ Created .env.local"
else
  echo "✓ .env.local already exists"
  cat .env.local
fi

echo ""
echo "Step 3: Build the frontend..."
echo "============================="
npm run build

echo ""
echo "Step 4: Test if the build worked..."
echo "==================================="
if [ -d .next ]; then
  echo "✓ Build directory exists"
  ls -la .next/
else
  echo "✗ Build directory missing"
  echo "Build failed, trying development mode..."
  
  # Update systemd service to use dev mode
  cat > /etc/systemd/system/lb-frontend.service << 'EOF'
[Unit]
Description=Load Balancer Frontend Service
After=network.target lb-api.service
Wants=lb-api.service

[Service]
Type=simple
User=lb-app
Group=lb-app
WorkingDirectory=/opt/lb-app/frontend
Environment=NODE_ENV=development
Environment=NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
Environment=NEXT_PUBLIC_WS_URL=ws://localhost:4000
ExecStart=/usr/bin/npm run dev
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=lb-frontend

[Install]
WantedBy=multi-user.target
EOF

  echo "✓ Updated systemd service for development mode"
fi

echo ""
echo "Step 5: Reload systemd and start service..."
echo "==========================================="
systemctl daemon-reload
systemctl start lb-frontend.service

echo ""
echo "Step 6: Check service status..."
echo "==============================="
sleep 3
systemctl status lb-frontend.service --no-pager

echo ""
echo "Step 7: Check recent logs..."
echo "============================"
journalctl -u lb-frontend -n 10 --no-pager

echo ""
echo "Step 8: Test if port 3000 is listening..."
echo "========================================="
netstat -tlnp | grep :3000 || ss -tlnp | grep :3000 || echo "Port 3000 not listening yet"

echo ""
echo "Frontend fix completed!"
echo "======================"
echo "If the service is running, try accessing:"
echo "  http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "If it's still not working, check logs with:"
echo "  journalctl -u lb-frontend -f"
