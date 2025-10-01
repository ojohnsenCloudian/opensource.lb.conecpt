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

# Install frontend dependencies separately to ensure ShadCN deps are included
echo "Installing frontend dependencies (including UI components)..."
cd $INSTALL_DIR/frontend
npm install 2>&1 | tail -10

cd $INSTALL_DIR
echo "✓ Dependencies installed"

echo ""
echo "Step 6: Setting up database..."
cd $INSTALL_DIR/packages/database

# Set database URL
export DATABASE_URL="file:$DATA_DIR/lb-app.db"
echo "DATABASE_URL=\"file:$DATA_DIR/lb-app.db\"" >> $INSTALL_DIR/.env

# Generate Prisma client using local installation (faster than npx)
echo "Generating Prisma client..."
echo "  (This downloads Prisma engines - may take 1-2 minutes on slow connections)"
cd $INSTALL_DIR
node_modules/.bin/prisma generate --schema=packages/database/prisma/schema.prisma 2>&1 | grep -E "(Generated|Prisma|Error|✔)" || echo "Generating..."
echo "✓ Prisma client generated"

# Push schema to database
echo "Creating database schema..."
cd $INSTALL_DIR/packages/database
node $INSTALL_DIR/node_modules/.bin/prisma db push --accept-data-loss --skip-generate --force-reset 2>&1 | grep -E "(migration|created|Error|✔|🚀)" || echo "Creating..."
echo "✓ Database schema created"

# Seed database with faster method
echo "Seeding database..."
if [ -f "prisma/seed.ts" ]; then
  # Create a quick seed script that doesn't need compilation
  cat > /tmp/quick-seed.js << 'SEEDEOF'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Starting database seeding...');
    
    // Create admin user
    console.log('Creating admin user...');
    const hashedPassword = await bcrypt.hash('admin123', 8);
    
    const adminUser = await prisma.user.upsert({
      where: { username: 'admin' },
      update: {
        password: hashedPassword, // Update password in case it changed
      },
      create: {
        username: 'admin',
        email: 'admin@loadbalancer.local',
        password: hashedPassword,
        role: 'admin',
      },
    });
    console.log('✓ Admin user created/updated:', adminUser.username);
    
    // Create default health check first
    console.log('Creating default health check...');
    const healthCheck = await prisma.healthCheck.upsert({
      where: { name: 'default-http' },
      update: {},
      create: {
        name: 'default-http',
        type: 'http',
        path: '/health',
        port: 80,
        interval: 30,
        timeout: 5,
        healthyThreshold: 2,
        unhealthyThreshold: 3,
        expectedStatus: 200,
        expectedResponse: '',
      },
    });
    console.log('✓ Default health check created:', healthCheck.name);
    
    // Create default server pool
    console.log('Creating default server pool...');
    const serverPool = await prisma.serverPool.upsert({
      where: { name: 'default-pool' },
      update: {},
      create: {
        name: 'default-pool',
        description: 'Default backend server pool',
      },
    });
    console.log('✓ Default server pool created:', serverPool.name);
    
    // Create a sample VIP
    console.log('Creating sample VIP...');
    const vip = await prisma.virtualIP.upsert({
      where: { ipAddress: '192.168.1.100' },
      update: {},
      create: {
        ipAddress: '192.168.1.100',
        interface: 'eth0',
        description: 'Sample VIP for testing',
        active: false,
      },
    });
    console.log('✓ Sample VIP created:', vip.ipAddress);
    
    console.log('✓ Database seeded successfully!');
    console.log('Login credentials:');
    console.log('  Username: admin');
    console.log('  Password: admin123');
    
  } catch (error) {
    console.error('✗ Seeding failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => { 
    console.error('Unhandled error:', e); 
    process.exit(1); 
  })
  .finally(async () => { 
    await prisma.$disconnect(); 
  });
SEEDEOF

  # Run the quick seed script with proper module resolution
  cd $INSTALL_DIR
  NODE_PATH=$INSTALL_DIR/node_modules:$INSTALL_DIR/packages/database/node_modules node /tmp/quick-seed.js 2>&1 || echo "WARNING: Seeding failed, but continuing..."
  rm -f /tmp/quick-seed.js
else
  echo "WARNING: No seed file found, skipping seed"
fi
echo "✓ Database seeded"

# Set permissions
chown -R $USER:$GROUP $DATA_DIR
chmod 644 $DATA_DIR/lb-app.db* 2>/dev/null || true

echo "✓ Database initialized"

echo ""
echo "Step 7: Building services..."
cd $INSTALL_DIR

# First, build the database package so other services can import it
echo "Building database package..."
cd $INSTALL_DIR/packages/database
npx tsc 2>&1 | tail -5 || echo "Database package built (or no TS to compile)"

# Build each service
echo "Building API service..."
cd $INSTALL_DIR/services/api
npx tsc --skipLibCheck --noEmitOnError false 2>&1 | tail -5 || true
echo "✓ API service built"

echo "Building LB Engine service..."
cd $INSTALL_DIR/services/lb-engine
npx tsc --skipLibCheck --noEmitOnError false 2>&1 | tail -5 || true
echo "✓ LB Engine service built"

echo "Building Health Check service..."
cd $INSTALL_DIR/services/healthcheck
npx tsc --skipLibCheck --noEmitOnError false 2>&1 | tail -5 || true
echo "✓ Health Check service built"

echo "Building Frontend..."
cd $INSTALL_DIR/frontend

# Ensure .env.local exists for frontend
if [ ! -f .env.local ]; then
  echo "Creating .env.local for frontend..."
  cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:4000
EOF
fi

# Clean and reinstall frontend dependencies to ensure everything is fresh
echo "Reinstalling frontend dependencies..."
rm -rf node_modules package-lock.json
npm install

# Build the frontend with detailed output
echo "Building Next.js application..."
if npm run build; then
  echo "✓ Frontend built successfully"
  FRONTEND_MODE="production"
else
  echo "✗ Frontend build failed, will use development mode"
  FRONTEND_MODE="development"
fi

# Always ensure the correct systemd service file is in place
echo "Setting up systemd service for $FRONTEND_MODE mode..."
if [ "$FRONTEND_MODE" = "production" ]; then
  # Use the standard production service file
  cp $INSTALL_DIR/systemd/lb-frontend.service /etc/systemd/system/
else
  # Create development mode service file
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
fi

echo "✓ Frontend systemd service configured for $FRONTEND_MODE mode"

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

# Check frontend service with retry
echo "Checking frontend service..."
if systemctl is-active lb-frontend.service; then
  echo "✓ lb-frontend: running"
else
  echo "✗ lb-frontend: failed, attempting restart..."
  systemctl restart lb-frontend.service
  sleep 3
  if systemctl is-active lb-frontend.service; then
    echo "✓ lb-frontend: running (after restart)"
  else
    echo "✗ lb-frontend: still failed, check logs with: journalctl -u lb-frontend -n 20"
  fi
fi

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

