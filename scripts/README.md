# Installation Scripts

## Overview

This directory contains scripts for installing and managing the Load Balancer application.

## Scripts

### 1. `deploy-to-rocky.sh` - Deploy to Rocky VM (Run on your Mac)

**Purpose**: Package and transfer the application to your Rocky Linux VM

**Usage**:
```bash
# On your Mac
cd /Users/ojohnsen/opensource.lb.conecpt
chmod +x scripts/deploy-to-rocky.sh
./scripts/deploy-to-rocky.sh
```

**What it does**:
- Creates a deployment package (tarball)
- Uploads to your Rocky VM via SCP
- Extracts files on the VM
- Optionally runs the installer

**Requirements**:
- SSH access to Rocky VM
- Project files on your Mac

---

### 2. `install.sh` - Install Application (Run on Rocky VM)

**Purpose**: Install the Load Balancer application on Rocky Linux

**Usage**:
```bash
# On Rocky VM
cd /root/load-balancer-app  # or wherever you extracted
sudo bash scripts/install.sh
```

**What it does**:
1. Installs Node.js, npm, sqlite
2. Creates application user and directories
3. Copies files to `/opt/lb-app`
4. Installs Node.js dependencies
5. Sets up database with Prisma
6. Builds all services
7. Installs and starts systemd services
8. Configures firewall

**Installation locations**:
- Application: `/opt/lb-app/`
- Database: `/opt/lb-app/data/lb-app.db`
- Logs: `/var/log/lb-app/`

---

### 3. `uninstall.sh` - Remove Application (Run on Rocky VM)

**Purpose**: Completely remove the Load Balancer application

**Usage**:
```bash
# On Rocky VM
sudo bash scripts/uninstall.sh
```

**What it does**:
- Stops all services
- Disables systemd services
- Removes application files
- Optionally removes database and logs
- Optionally removes application user

---

## Quick Start Guide

### For First-Time Installation:

**Step 1**: On your **Mac**, deploy to Rocky VM:
```bash
cd /Users/ojohnsen/opensource.lb.conecpt
chmod +x scripts/deploy-to-rocky.sh
./scripts/deploy-to-rocky.sh
```

**Step 2**: The script will ask if you want to run installation automatically, or you can SSH manually:
```bash
ssh root@<rocky-vm-ip>
cd /root/load-balancer-app
sudo bash scripts/install.sh
```

**Step 3**: Access the web interface:
```
http://<rocky-vm-ip>:3000
```

Default credentials:
- Username: `admin`
- Password: `admin123`

---

## Troubleshooting

### deploy-to-rocky.sh fails

**Issue**: Cannot connect via SSH
```bash
# Test SSH manually
ssh root@<rocky-vm-ip>

# If using non-standard port
ssh -p 2222 root@<rocky-vm-ip>
```

**Issue**: Permission denied
```bash
# Ensure you have SSH key configured
ssh-copy-id root@<rocky-vm-ip>
```

---

### install.sh fails

**Issue**: "packages directory not found"

**Solution**: Make sure you're running from the project root:
```bash
cd /root/load-balancer-app  # or wherever you extracted
ls -la  # Should show packages/, services/, frontend/
sudo bash scripts/install.sh
```

**Issue**: Node.js installation fails

**Solution**: Manually install Node.js 18+:
```bash
sudo dnf module enable nodejs:18
sudo dnf install nodejs npm
node --version  # Should be 18+
```

**Issue**: Service fails to start

**Solution**: Check logs:
```bash
sudo journalctl -u lb-api -n 50
sudo journalctl -u lb-engine -n 50
sudo journalctl -u lb-healthcheck -n 50
sudo journalctl -u lb-frontend -n 50
```

**Issue**: Port already in use

**Solution**: Check what's using the port:
```bash
sudo netstat -tlnp | grep -E ':(3000|4000)'
# Stop conflicting service or change port in systemd files
```

---

## Manual Installation Steps

If scripts fail, you can install manually:

### 1. Install Dependencies
```bash
sudo dnf install nodejs npm sqlite -y
```

### 2. Create User and Directories
```bash
sudo useradd -r -s /bin/false lb-app
sudo mkdir -p /opt/lb-app/data
sudo mkdir -p /var/log/lb-app
sudo chown -R lb-app:lb-app /opt/lb-app/data /var/log/lb-app
```

### 3. Copy Files
```bash
sudo cp -r /root/load-balancer-app/* /opt/lb-app/
```

### 4. Install Dependencies
```bash
cd /opt/lb-app
sudo npm install --omit=dev
cd packages/database
sudo npm install --omit=dev
```

### 5. Setup Database
```bash
cd /opt/lb-app/packages/database
export DATABASE_URL="file:/opt/lb-app/data/lb-app.db"
npx prisma generate
npx prisma db push --accept-data-loss
npx tsx prisma/seed.ts
sudo chown -R lb-app:lb-app /opt/lb-app/data
```

### 6. Build Services
```bash
cd /opt/lb-app/services/api
npx tsc

cd /opt/lb-app/services/lb-engine
npx tsc

cd /opt/lb-app/services/healthcheck
npx tsc

cd /opt/lb-app/frontend
npm run build
```

### 7. Install Systemd Services
```bash
sudo cp /opt/lb-app/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable lb-api lb-engine lb-healthcheck lb-frontend
sudo systemctl start lb-api lb-engine lb-healthcheck lb-frontend
```

### 8. Configure Firewall
```bash
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=4000/tcp
sudo firewall-cmd --reload
```

---

## After Installation

### Check Service Status
```bash
sudo systemctl status lb-api lb-engine lb-healthcheck lb-frontend
```

### View Logs
```bash
# All services
sudo journalctl -u 'lb-*' -f

# Specific service
sudo journalctl -u lb-api -f
```

### Restart Services
```bash
sudo systemctl restart lb-api lb-engine lb-healthcheck lb-frontend
```

### Stop Services
```bash
sudo systemctl stop lb-api lb-engine lb-healthcheck lb-frontend
```

---

## Support

For more information:
- See `../INSTALLATION.md` for detailed installation guide
- See `../QUICKSTART.md` for quick setup
- See `../CLOUDIAN-SETUP.md` for Cloudian HyperStore setup
- See `../README.md` for full documentation

