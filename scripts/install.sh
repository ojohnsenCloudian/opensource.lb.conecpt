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

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Script directory: $SCRIPT_DIR"
echo "Project root: $PROJECT_ROOT"
echo ""

# Check if we're in the right directory structure
if [ ! -d "$PROJECT_ROOT/packages" ] || [ ! -d "$PROJECT_ROOT/services" ] || [ ! -d "$PROJECT_ROOT/frontend" ]; then
  echo "ERROR: Cannot find required directories (packages, services, frontend)"
  echo "Please ensure the script is run from the project structure"
  echo "Expected structure:"
  echo "  load-balancer-app/"
  echo "  ├── packages/"
  echo "  ├── services/"
  echo "  ├── frontend/"
  echo "  └── scripts/"
  exit 1
fi

# Check OS
if [ ! -f /etc/rocky-release ] && [ ! -f /etc/redhat-release ]; then
  echo "WARNING: This installer is designed for Rocky Linux 9.6 or RHEL-based systems"
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

# Remove any existing Node.js installation
if command -v node &> /dev/null; then
  CURRENT_VERSION=$(node -v)
  echo "Found existing Node.js version: $CURRENT_VERSION"
  echo "Removing old Node.js installation to ensure latest LTS version..."
  dnf remove -y nodejs npm nodejs-docs nodejs-devel 2>/dev/null || true
  # Clean up any remaining files
  rm -rf /usr/bin/node /usr/bin/npm /usr/lib/node_modules 2>/dev/null || true
fi

# Install Node.js 20.x LTS (Current LTS - Iron) from official NodeSource repository
echo "Installing Node.js 20.x LTS (Latest Stable)..."
echo "Downloading NodeSource setup script..."
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -

echo "Installing Node.js and SQLite..."
dnf install -y nodejs sqlite

# Verify installation
echo ""
echo "Installed versions:"
NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)
echo "  Node.js: $NODE_VERSION"
echo "  npm: $NPM_VERSION"
echo "  SQLite: $(sqlite3 --version 2>/dev/null || echo 'installed')"

# Validate Node.js version meets requirements
NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
NODE_MINOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f2)

if [ "$NODE_MAJOR" -lt 18 ] || ([ "$NODE_MAJOR" -eq 18 ] && [ "$NODE_MINOR" -lt 18 ]); then
  echo ""
  echo "ERROR: Node.js 18.18.0 or higher is required"
  echo "Current version: $NODE_VERSION"
  echo "Please install Node.js 18.18+ or Node.js 20.x LTS"
  exit 1
fi

echo "✓ Node.js $NODE_VERSION meets requirements (18.18.0+)"

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
cd "$PROJECT_ROOT"

# Copy directories
cp -r packages $INSTALL_DIR/ 2>/dev/null || { echo "ERROR: Failed to copy packages"; exit 1; }
cp -r services $INSTALL_DIR/ 2>/dev/null || { echo "ERROR: Failed to copy services"; exit 1; }
cp -r frontend $INSTALL_DIR/ 2>/dev/null || { echo "ERROR: Failed to copy frontend"; exit 1; }
cp -r systemd $INSTALL_DIR/ 2>/dev/null || echo "WARNING: systemd directory not found, will skip"

# Copy root files
cp package.json $INSTALL_DIR/ 2>/dev/null || { echo "ERROR: Failed to copy package.json"; exit 1; }
cp tsconfig.json $INSTALL_DIR/ 2>/dev/null || echo "WARNING: tsconfig.json not found"

# Copy env.example as .env if it exists
if [ -f env.example ]; then
  cp env.example $INSTALL_DIR/.env
elif [ -f .env.example ]; then
  cp .env.example $INSTALL_DIR/.env
else
  echo "WARNING: No .env.example or env.example found, creating default .env"
  cat > $INSTALL_DIR/.env << 'ENVEOF'
DATABASE_URL="file:/opt/lb-app/data/lb-app.db"
API_PORT=4000
API_HOST=0.0.0.0
JWT_SECRET=change-this-in-production-$(openssl rand -hex 32)
JWT_EXPIRES_IN=24h
LB_ENGINE_PORT=8080
LB_CONFIG_RELOAD_INTERVAL=30
HEALTHCHECK_INTERVAL=10
HEALTHCHECK_TIMEOUT=5
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
LOG_LEVEL=info
LOG_FILE_PATH=/var/log/lb-app
NODE_ENV=production
ENVEOF
fi

echo "✓ Files copied"

echo ""
echo "Step 5: Installing Node.js dependencies..."
cd $INSTALL_DIR

# For npm workspaces, we need to install everything from the root
echo "Installing dependencies (this may take a few minutes)..."
npm install 2>&1 | tail -20

echo "✓ Dependencies installed"

echo ""
echo "Step 6: Setting up database..."
cd $INSTALL_DIR/packages/database

# Set database URL
export DATABASE_URL="file:$DATA_DIR/lb-app.db"
echo "DATABASE_URL=\"file:$DATA_DIR/lb-app.db\"" >> $INSTALL_DIR/.env

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate --schema=./prisma/schema.prisma 2>&1 | tail -5

# Push schema to database
echo "Creating database schema..."
npx prisma db push --accept-data-loss --skip-generate 2>&1 | tail -5

# Build seed script first for faster execution
echo "Building seed script..."
if [ -f "prisma/seed.ts" ]; then
  # Compile seed.ts to seed.js
  npx tsc prisma/seed.ts --outDir prisma --module commonjs --target ES2020 --esModuleInterop 2>&1 | tail -3
  
  # Run compiled seed script (much faster than tsx)
  if [ -f "prisma/seed.js" ]; then
    echo "Seeding database (running compiled script)..."
    node prisma/seed.js 2>&1 | tail -10
    rm -f prisma/seed.js  # Clean up
  else
    # Fallback to tsx if compilation failed
    echo "Seeding database (using tsx)..."
    npx tsx prisma/seed.ts 2>&1 | tail -10
  fi
else
  echo "WARNING: No seed file found, skipping seed"
fi

# Set permissions
chown -R $USER:$GROUP $DATA_DIR
chmod 644 $DATA_DIR/lb-app.db* 2>/dev/null || true

echo "✓ Database initialized"

echo ""
echo "Step 7: Building services..."
cd $INSTALL_DIR

# Build each service
echo "Building API service..."
cd $INSTALL_DIR/services/api
npx tsc 2>&1 | tail -5

echo "Building LB Engine service..."
cd $INSTALL_DIR/services/lb-engine
npx tsc 2>&1 | tail -5

echo "Building Health Check service..."
cd $INSTALL_DIR/services/healthcheck
npx tsc 2>&1 | tail -5

echo "Building Frontend..."
cd $INSTALL_DIR/frontend
npm run build 2>&1 | tail -10

# Set ownership
cd $INSTALL_DIR
chown -R $USER:$GROUP $INSTALL_DIR
echo "✓ Services built"

echo ""
echo "Step 8: Installing systemd services..."

# Check if systemd directory exists
if [ -d "$INSTALL_DIR/systemd" ]; then
  cp $INSTALL_DIR/systemd/*.service /etc/systemd/system/ 2>/dev/null || {
    echo "WARNING: No systemd service files found in $INSTALL_DIR/systemd"
    echo "Copying from project root..."
    cp $PROJECT_ROOT/systemd/*.service /etc/systemd/system/ 2>/dev/null || {
      echo "ERROR: Cannot find systemd service files"
      exit 1
    }
  }
else
  echo "Copying systemd files from project root..."
  cp $PROJECT_ROOT/systemd/*.service /etc/systemd/system/ 2>/dev/null || {
    echo "ERROR: Cannot find systemd service files"
    exit 1
  }
fi

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
  echo "Configuring firewall rules..."
  firewall-cmd --permanent --add-port=3000/tcp 2>/dev/null || echo "Port 3000 already configured"
  firewall-cmd --permanent --add-port=4000/tcp 2>/dev/null || echo "Port 4000 already configured"
  firewall-cmd --permanent --add-port=80/tcp 2>/dev/null || echo "Port 80 already configured"
  firewall-cmd --permanent --add-port=443/tcp 2>/dev/null || echo "Port 443 already configured"
  firewall-cmd --reload
  echo "✓ Firewall configured"
else
  echo "⚠ firewalld not found, skipping firewall configuration"
  echo "  You may need to manually configure your firewall to allow:"
  echo "  - Port 3000 (Frontend)"
  echo "  - Port 4000 (API)"
  echo "  - Port 80 (HTTP Load Balancer)"
  echo "  - Port 443 (HTTPS Load Balancer)"
fi

echo ""
echo "========================================="
echo "Installation completed successfully!"
echo "========================================="
echo ""
echo "Waiting for services to start..."
sleep 5

echo ""
echo "Service Status:"
echo "---------------"
systemctl is-active lb-api.service && echo "✓ lb-api: running" || echo "✗ lb-api: failed"
systemctl is-active lb-engine.service && echo "✓ lb-engine: running" || echo "✗ lb-engine: failed"
systemctl is-active lb-healthcheck.service && echo "✓ lb-healthcheck: running" || echo "✗ lb-healthcheck: failed"
systemctl is-active lb-frontend.service && echo "✓ lb-frontend: running" || echo "✗ lb-frontend: failed"

echo ""
echo "Access the web interface at:"
echo "  http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "API endpoint:"
echo "  http://$(hostname -I | awk '{print $1}'):4000/api/v1"
echo ""
echo "Default credentials:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "⚠️  IMPORTANT: Change the default password immediately!"
echo ""
echo "Installation locations:"
echo "  Application: $INSTALL_DIR"
echo "  Database: $DATA_DIR/lb-app.db"
echo "  Logs: $LOG_DIR"
echo "  Systemd services: /etc/systemd/system/lb-*.service"
echo ""
echo "Useful commands:"
echo "  Check status:  systemctl status lb-api lb-engine lb-healthcheck lb-frontend"
echo "  View logs:     journalctl -u lb-api -f"
echo "  View all logs: journalctl -u 'lb-*' -f"
echo "  Restart all:   systemctl restart lb-api lb-engine lb-healthcheck lb-frontend"
echo ""
echo "Next steps:"
echo "  1. Access the web interface and change the admin password"
echo "  2. See QUICKSTART.md for a quick setup guide"
echo "  3. See CLOUDIAN-SETUP.md for Cloudian HyperStore configuration"
echo ""
echo "If services failed to start, check logs with:"
echo "  journalctl -u lb-api -n 50"
echo ""

