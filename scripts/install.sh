#!/bin/bash
set -e

echo "========================================="
echo "Load Balancer Application Installer"
echo "========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: This script must be run as root"
  exit 1
fi

# Check OS
if [ ! -f /etc/rocky-release ]; then
  echo "WARNING: This installer is designed for Rocky Linux 9.6"
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Variables
INSTALL_DIR="/opt/lb-app"
DATA_DIR="/opt/lb-app/data"
LOG_DIR="/var/log/lb-app"
USER="lb-app"
GROUP="lb-app"

echo "Step 1: Installing dependencies..."
dnf install -y nodejs npm sqlite

echo ""
echo "Step 2: Creating application user..."
if ! id "$USER" &>/dev/null; then
  useradd -r -s /bin/false $USER
  echo "✓ User $USER created"
else
  echo "✓ User $USER already exists"
fi

echo ""
echo "Step 3: Creating directories..."
mkdir -p $INSTALL_DIR
mkdir -p $DATA_DIR
mkdir -p $LOG_DIR
chown -R $USER:$GROUP $DATA_DIR
chown -R $USER:$GROUP $LOG_DIR
echo "✓ Directories created"

echo ""
echo "Step 4: Copying application files..."
cp -r packages $INSTALL_DIR/
cp -r services $INSTALL_DIR/
cp -r frontend $INSTALL_DIR/
cp package.json $INSTALL_DIR/
cp tsconfig.json $INSTALL_DIR/
echo "✓ Files copied"

echo ""
echo "Step 5: Installing Node.js dependencies..."
cd $INSTALL_DIR
npm install --production
echo "✓ Dependencies installed"

echo ""
echo "Step 6: Setting up database..."
cd $INSTALL_DIR/packages/database
export DATABASE_URL="file:$DATA_DIR/lb-app.db"
npm run db:generate
npm run db:push
npm run db:seed
chown $USER:$GROUP $DATA_DIR/lb-app.db*
echo "✓ Database initialized"

echo ""
echo "Step 7: Building services..."
cd $INSTALL_DIR
npm run build
chown -R $USER:$GROUP $INSTALL_DIR
echo "✓ Services built"

echo ""
echo "Step 8: Installing systemd services..."
cp systemd/*.service /etc/systemd/system/
systemctl daemon-reload
echo "✓ Systemd services installed"

echo ""
echo "Step 9: Enabling services..."
systemctl enable lb-api.service
systemctl enable lb-engine.service
systemctl enable lb-healthcheck.service
systemctl enable lb-frontend.service
echo "✓ Services enabled"

echo ""
echo "Step 10: Starting services..."
systemctl start lb-api.service
systemctl start lb-engine.service
systemctl start lb-healthcheck.service
systemctl start lb-frontend.service
echo "✓ Services started"

echo ""
echo "Step 11: Configuring firewall..."
if command -v firewall-cmd &> /dev/null; then
  firewall-cmd --permanent --add-port=3000/tcp
  firewall-cmd --permanent --add-port=4000/tcp
  firewall-cmd --reload
  echo "✓ Firewall configured"
else
  echo "⚠ firewalld not found, skipping firewall configuration"
fi

echo ""
echo "========================================="
echo "Installation completed successfully!"
echo "========================================="
echo ""
echo "Service Status:"
systemctl status lb-api.service --no-pager -l || true
systemctl status lb-engine.service --no-pager -l || true
systemctl status lb-healthcheck.service --no-pager -l || true
systemctl status lb-frontend.service --no-pager -l || true
echo ""
echo "Access the web interface at: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "Default credentials:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "Important files:"
echo "  Application: $INSTALL_DIR"
echo "  Database: $DATA_DIR/lb-app.db"
echo "  Logs: $LOG_DIR"
echo "  Systemd services: /etc/systemd/system/lb-*.service"
echo ""
echo "Useful commands:"
echo "  Check status: systemctl status lb-api lb-engine lb-healthcheck lb-frontend"
echo "  View logs: journalctl -u lb-api -f"
echo "  Restart all: systemctl restart lb-api lb-engine lb-healthcheck lb-frontend"
echo ""

