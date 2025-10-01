# Installation Guide

## Prerequisites

Before installing, ensure you have:
- Rocky Linux 9.6 (or compatible RHEL-based distribution)
- Root access (sudo)
- Internet connection

## Step-by-Step Installation

### 1. Navigate to Project Root

```bash
cd /Users/ojohnsen/opensource.lb.conecpt
```

Or if you're on the Rocky Linux server:
```bash
cd /path/to/load-balancer-app
```

### 2. Verify Directory Structure

```bash
ls -la
```

You should see:
- `packages/` directory
- `services/` directory  
- `frontend/` directory
- `scripts/` directory
- `package.json` file
- `tsconfig.json` file

### 3. Run the Installer

```bash
sudo bash scripts/install.sh
```

**Important**: Run from the project root, not from inside the `scripts/` directory!

## What the Installer Does

1. ✅ Checks OS compatibility (Rocky Linux 9.6 recommended)
2. ✅ Installs dependencies (Node.js, npm, sqlite)
3. ✅ Creates application user (`lb-app`)
4. ✅ Creates directories (`/opt/lb-app`, `/var/log/lb-app`)
5. ✅ Copies application files
6. ✅ Installs Node.js dependencies
7. ✅ Sets up database (Prisma generate, push, seed)
8. ✅ Builds all services (TypeScript compilation)
9. ✅ Installs systemd services
10. ✅ Enables services for auto-start
11. ✅ Starts all services
12. ✅ Configures firewall (if firewalld is installed)

## Installation Locations

- **Application**: `/opt/lb-app/`
- **Database**: `/opt/lb-app/data/lb-app.db`
- **Logs**: `/var/log/lb-app/`
- **Systemd services**: `/etc/systemd/system/lb-*.service`

## Post-Installation

### 1. Check Service Status

```bash
sudo systemctl status lb-api lb-engine lb-healthcheck lb-frontend
```

### 2. View Logs

```bash
# All services
sudo journalctl -u 'lb-*' -f

# Specific service
sudo journalctl -u lb-engine -f
```

### 3. Access Web Interface

Open your browser:
```
http://<server-ip>:3000
```

**Default credentials**:
- Username: `admin`
- Password: `admin123`

⚠️ **Change the password immediately after first login!**

## Common Installation Issues

### Error: "packages directory not found"

**Cause**: Running the script from the wrong directory

**Solution**:
```bash
# Make sure you're in the project root
cd /Users/ojohnsen/opensource.lb.conecpt
pwd  # Should show the project root path

# Verify directories exist
ls -d packages services frontend

# Then run installer
sudo bash scripts/install.sh
```

### Error: "Node.js not found"

**Cause**: Node.js not installed or wrong version

**Solution**:
```bash
# Check Node.js version (requires 18+)
node --version

# If not installed, the installer will install it
# Or manually install:
sudo dnf module enable nodejs:18
sudo dnf install nodejs npm
```

### Error: "Permission denied"

**Cause**: Not running with sudo

**Solution**:
```bash
# Must run with sudo/root
sudo bash scripts/install.sh
```

### Error: "Port already in use"

**Cause**: Another service is using ports 3000 or 4000

**Solution**:
```bash
# Check what's using the ports
sudo netstat -tlnp | grep -E ':(3000|4000)'

# Stop conflicting services or modify ports in systemd service files
```

### Error: Database initialization failed

**Cause**: SQLite or Prisma issues

**Solution**:
```bash
# Manually initialize database
cd /opt/lb-app/packages/database
sudo -u lb-app npm run db:generate
sudo -u lb-app npm run db:push
sudo -u lb-app npm run db:seed
```

## Firewall Configuration

If you're using firewalld:

```bash
# The installer does this automatically, but you can also run manually:
sudo firewall-cmd --permanent --add-port=3000/tcp  # Frontend
sudo firewall-cmd --permanent --add-port=4000/tcp  # API
sudo firewall-cmd --permanent --add-port=80/tcp    # HTTP LB
sudo firewall-cmd --permanent --add-port=443/tcp   # HTTPS LB
sudo firewall-cmd --reload
```

## Development Installation (Local Testing)

For development on macOS or Linux:

```bash
# 1. Navigate to project root
cd /Users/ojohnsen/opensource.lb.conecpt

# 2. Install dependencies
npm install

# 3. Generate Prisma client
npm run db:generate

# 4. Initialize database
npm run db:push

# 5. Seed database
cd packages/database
npm run db:seed

# 6. Start all services in development mode
cd ../..
npm run dev
```

Access:
- Frontend: http://localhost:3000
- API: http://localhost:4000

## Uninstallation

To completely remove the application:

```bash
sudo bash scripts/uninstall.sh
```

This will:
- Stop all services
- Remove systemd service files
- Remove application files from `/opt/lb-app`
- Optionally remove logs and database
- Optionally remove the `lb-app` user

## Next Steps

After successful installation:

1. **Change Default Password**:
   - Login to web interface
   - Go to Users → Edit admin user
   - Set a strong password

2. **Configure Your First Load Balancer**:
   - See `QUICKSTART.md` for a quick guide
   - See `CLOUDIAN-SETUP.md` for Cloudian HyperStore setup

3. **Set Up Monitoring**:
   - Check the Monitoring page for system metrics
   - Review logs regularly

4. **Backup Database**:
   ```bash
   sudo cp /opt/lb-app/data/lb-app.db /backup/
   ```

## Support

If you encounter issues:

1. Check logs: `sudo journalctl -u lb-api -n 100`
2. Verify services: `sudo systemctl status lb-*`
3. Review this guide
4. Check `README.md` for detailed documentation
5. See `DEVELOPMENT.md` for development setup

## Security Checklist

After installation:
- [ ] Change default admin password
- [ ] Update JWT secret in `/etc/systemd/system/lb-api.service`
- [ ] Configure firewall rules
- [ ] Set up SSL certificates for production
- [ ] Review and restrict SSH access
- [ ] Set up regular database backups
- [ ] Monitor logs for suspicious activity

## Performance Tuning

For production deployments:

1. **Increase system limits**:
   ```bash
   # Edit /etc/security/limits.conf
   lb-app soft nofile 65536
   lb-app hard nofile 65536
   ```

2. **Optimize systemd services**:
   - Adjust CPU/memory limits in service files
   - Configure restart policies

3. **Monitor resources**:
   - Use the built-in monitoring dashboard
   - Set up external monitoring (Prometheus, Grafana)

## Upgrading

To upgrade to a new version:

```bash
# 1. Stop services
sudo systemctl stop lb-api lb-engine lb-healthcheck lb-frontend

# 2. Backup database
sudo cp /opt/lb-app/data/lb-app.db /backup/lb-app-$(date +%Y%m%d).db

# 3. Pull new code
cd /path/to/load-balancer-app
git pull

# 4. Rebuild
cd /opt/lb-app
npm install --production
npm run build

# 5. Database migrations (if any)
cd packages/database
npm run db:generate

# 6. Restart services
sudo systemctl start lb-api lb-engine lb-healthcheck lb-frontend
```

