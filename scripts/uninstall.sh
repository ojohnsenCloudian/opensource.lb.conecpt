#!/bin/bash
set -e

echo "========================================="
echo "Load Balancer Application Uninstaller"
echo "========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: This script must be run as root"
  exit 1
fi

read -p "This will remove the Load Balancer application. Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  exit 1
fi

echo ""
echo "Step 1: Stopping services..."
systemctl stop lb-frontend.service || true
systemctl stop lb-healthcheck.service || true
systemctl stop lb-engine.service || true
systemctl stop lb-api.service || true
echo "✓ Services stopped"

echo ""
echo "Step 2: Disabling services..."
systemctl disable lb-frontend.service || true
systemctl disable lb-healthcheck.service || true
systemctl disable lb-engine.service || true
systemctl disable lb-api.service || true
echo "✓ Services disabled"

echo ""
echo "Step 3: Removing systemd services..."
rm -f /etc/systemd/system/lb-*.service
systemctl daemon-reload
echo "✓ Systemd services removed"

echo ""
echo "Step 4: Removing application files..."
rm -rf /opt/lb-app
echo "✓ Application files removed"

read -p "Remove database and logs? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  rm -rf /var/log/lb-app
  echo "✓ Logs removed"
fi

read -p "Remove application user? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  userdel lb-app || true
  echo "✓ User removed"
fi

echo ""
echo "========================================="
echo "Uninstallation completed!"
echo "========================================="

