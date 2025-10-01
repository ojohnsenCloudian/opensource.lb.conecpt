#!/bin/bash

echo "========================================="
echo "Deploy to Rocky Linux VM"
echo "========================================="
echo ""

# Configuration
read -p "Enter Rocky VM IP address: " ROCKY_IP
read -p "Enter SSH user (default: root): " ROCKY_USER
ROCKY_USER=${ROCKY_USER:-root}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo ""
echo "Configuration:"
echo "  Rocky VM IP: $ROCKY_IP"
echo "  SSH User: $ROCKY_USER"
echo "  Project Root: $PROJECT_ROOT"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  exit 1
fi

# Test SSH connection
echo ""
echo "Testing SSH connection..."
if ! ssh -o ConnectTimeout=5 ${ROCKY_USER}@${ROCKY_IP} "echo 'Connection successful'" 2>/dev/null; then
  echo "ERROR: Cannot connect to ${ROCKY_USER}@${ROCKY_IP}"
  echo "Please check:"
  echo "  - IP address is correct"
  echo "  - SSH is running on Rocky VM"
  echo "  - You have SSH access"
  echo ""
  echo "You can test manually with:"
  echo "  ssh ${ROCKY_USER}@${ROCKY_IP}"
  exit 1
fi
echo "✓ SSH connection successful"

# Create tarball
echo ""
echo "Creating deployment package..."
cd "$PROJECT_ROOT"

TARBALL="/tmp/load-balancer-app-$(date +%Y%m%d-%H%M%S).tar.gz"

tar -czf "$TARBALL" \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='dist' \
  --exclude='*.db' \
  --exclude='*.db-journal' \
  --exclude='.git' \
  --exclude='.DS_Store' \
  packages/ \
  services/ \
  frontend/ \
  scripts/ \
  systemd/ \
  package.json \
  tsconfig.json \
  env.example \
  *.md \
  LICENSE 2>/dev/null

if [ ! -f "$TARBALL" ]; then
  echo "ERROR: Failed to create tarball"
  exit 1
fi

TARBALL_SIZE=$(du -h "$TARBALL" | cut -f1)
echo "✓ Package created: $TARBALL ($TARBALL_SIZE)"

# Copy to Rocky VM
echo ""
echo "Uploading to Rocky VM..."
scp "$TARBALL" ${ROCKY_USER}@${ROCKY_IP}:/tmp/ || {
  echo "ERROR: Failed to upload package"
  exit 1
}
echo "✓ Upload complete"

# Extract and prepare on Rocky VM
echo ""
echo "Extracting on Rocky VM..."
ssh ${ROCKY_USER}@${ROCKY_IP} << EOF
  set -e
  cd /root
  
  # Remove old installation if exists
  if [ -d "load-balancer-app" ]; then
    echo "Removing old installation..."
    rm -rf load-balancer-app
  fi
  
  # Create directory and extract
  mkdir -p load-balancer-app
  tar -xzf /tmp/$(basename $TARBALL) -C load-balancer-app
  
  # Clean up tarball
  rm -f /tmp/$(basename $TARBALL)
  
  echo "✓ Files extracted to /root/load-balancer-app"
  
  # Show structure
  echo ""
  echo "Directory structure:"
  ls -la /root/load-balancer-app/
EOF

if [ $? -ne 0 ]; then
  echo "ERROR: Failed to extract on Rocky VM"
  exit 1
fi

# Clean up local tarball
rm -f "$TARBALL"

echo ""
echo "========================================="
echo "Deployment successful!"
echo "========================================="
echo ""
echo "Files are now on Rocky VM at: /root/load-balancer-app"
echo ""
echo "To complete installation, run these commands:"
echo ""
echo "  ssh ${ROCKY_USER}@${ROCKY_IP}"
echo "  cd /root/load-balancer-app"
echo "  sudo bash scripts/install.sh"
echo ""
echo "Or run installation directly:"
read -p "Run installation now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo ""
  echo "Running installation on Rocky VM..."
  ssh -t ${ROCKY_USER}@${ROCKY_IP} "cd /root/load-balancer-app && sudo bash scripts/install.sh"
fi

echo ""
echo "Done!"

