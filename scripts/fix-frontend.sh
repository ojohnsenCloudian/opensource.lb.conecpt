#!/bin/bash

echo "========================================="
echo "Frontend Service Troubleshooting"
echo "========================================="
echo ""

echo "Checking frontend logs..."
echo "========================="
journalctl -u lb-frontend -n 20 --no-pager

echo ""
echo "Checking frontend directory structure..."
echo "========================================"
ls -la /opt/lb-app/frontend/

echo ""
echo "Checking if Next.js is built..."
echo "==============================="
ls -la /opt/lb-app/frontend/.next/ 2>/dev/null || echo "No .next directory found"

echo ""
echo "Checking package.json..."
echo "========================"
cat /opt/lb-app/frontend/package.json | head -20

echo ""
echo "Checking node_modules..."
echo "======================="
ls -la /opt/lb-app/frontend/node_modules/ | head -10

echo ""
echo "Trying to start frontend manually..."
echo "===================================="
cd /opt/lb-app/frontend
echo "Current directory: $(pwd)"
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

echo ""
echo "Checking if .env.local exists..."
echo "================================"
ls -la /opt/lb-app/frontend/.env*

echo ""
echo "Attempting manual start..."
echo "=========================="
timeout 10s npm start 2>&1 || echo "Manual start failed or timed out"

echo ""
echo "Checking systemd service file..."
echo "================================"
cat /etc/systemd/system/lb-frontend.service

