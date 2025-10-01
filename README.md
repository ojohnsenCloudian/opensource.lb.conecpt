# Load Balancer Application

A comprehensive Load Balancer solution with management interface for Rocky Linux 9.6.

## Features

- **Custom Load Balancer Engine**: Built-in HTTP/HTTPS load balancer with multiple algorithms
- **Health Checks**: Automated health monitoring for backend servers
- **SSL/TLS Support**: Manage SSL certificates including wildcard certificates
- **Multiple Algorithms**: Round Robin, Least Connections, Weighted, IP Hash
- **Real-time Monitoring**: System metrics, LB statistics, and backend server performance
- **Web Management UI**: Modern Next.js interface with ShadCN components
- **RESTful API**: Complete API for programmatic management
- **Virtual IPs**: Support for VIP addresses
- **Logging**: Comprehensive logging and audit trail

## Architecture

```
├── packages/
│   └── database/          # Prisma database schema and client
├── services/
│   ├── api/               # REST API backend (Express)
│   ├── lb-engine/         # Custom load balancer engine
│   └── healthcheck/       # Health check service
├── frontend/              # Next.js web interface
├── systemd/               # Systemd service files
└── scripts/               # Installation scripts
```

## Requirements

- Rocky Linux 9.6 (or similar RHEL-based distribution)
- Node.js 18+ and npm
- SQLite
- Root access for installation

## Quick Start

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd load-balancer-app
```

2. Run the installer:
```bash
sudo bash scripts/install.sh
```

The installer will:
- Install dependencies (Node.js, npm, sqlite)
- Create application user and directories
- Install and build all services
- Set up the database with seed data
- Configure and start systemd services
- Configure firewall rules

### Access

After installation, access the web interface at:
```
http://<your-server-ip>:3000
```

**Default Credentials:**
- Username: `admin`
- Password: `admin123`

⚠️ **Important:** Change the default password after first login!

## Services

The application consists of four systemd services:

1. **lb-api** (port 4000): REST API for management
2. **lb-engine**: Custom load balancer engine
3. **lb-healthcheck**: Health check monitoring service
4. **lb-frontend** (port 3000): Web management interface

### Managing Services

```bash
# Check status
systemctl status lb-api lb-engine lb-healthcheck lb-frontend

# Start services
systemctl start lb-api lb-engine lb-healthcheck lb-frontend

# Stop services
systemctl stop lb-api lb-engine lb-healthcheck lb-frontend

# Restart services
systemctl restart lb-api lb-engine lb-healthcheck lb-frontend

# View logs
journalctl -u lb-api -f
journalctl -u lb-engine -f
journalctl -u lb-healthcheck -f
journalctl -u lb-frontend -f
```

## Configuration

### Environment Variables

Configuration is managed through environment variables in the systemd service files:

#### API Service (`/etc/systemd/system/lb-api.service`)
```
Environment="DATABASE_URL=file:/opt/lb-app/data/lb-app.db"
Environment="API_PORT=4000"
Environment="JWT_SECRET=your-secret-key"
```

#### Load Balancer Engine
```
Environment="LB_CONFIG_RELOAD_INTERVAL=30"
```

#### Health Check Service
```
Environment="HEALTHCHECK_INTERVAL=10"
Environment="HEALTHCHECK_TIMEOUT=5"
```

After modifying service files:
```bash
systemctl daemon-reload
systemctl restart <service-name>
```

## Usage Guide

### Creating a Load Balancer

1. **Create a Server Pool:**
   - Navigate to "Backend Servers" → "Pools"
   - Click "Create Pool"
   - Add backend servers to the pool

2. **Add Backend Servers:**
   - Go to "Backend Servers"
   - Click "Add Server"
   - Enter IP address, port, and weight

3. **Create Health Check (Optional):**
   - Navigate to "Health Checks"
   - Create a new health check configuration
   - Configure type (HTTP/HTTPS/TCP), interval, and thresholds

4. **Upload SSL Certificate (for HTTPS):**
   - Go to "Certificates"
   - Upload certificate, private key, and chain

5. **Create Load Balancer:**
   - Navigate to "Load Balancers"
   - Click "Create Load Balancer"
   - Configure:
     - Name and description
     - Protocol (HTTP/HTTPS)
     - Listen port
     - Algorithm (Round Robin, Least Connections, etc.)
     - Select server pool
     - Attach health check
     - Attach SSL certificate (if HTTPS)

6. **Enable Load Balancer:**
   - Click "Enable" on the load balancer
   - Traffic will start being balanced

### Load Balancing Algorithms

- **Round Robin**: Distributes requests evenly across all backends
- **Least Connections**: Sends requests to server with fewest active connections
- **Weighted**: Distributes based on server weights
- **IP Hash**: Routes same client IP to same backend (session persistence)

## API Documentation

### Authentication

All API endpoints (except `/auth/login`) require authentication via JWT token.

```bash
# Login
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Use token in subsequent requests
curl -H "Authorization: Bearer <token>" \
  http://localhost:4000/api/v1/load-balancers
```

### Key Endpoints

```
POST   /api/v1/auth/login                 # Login
GET    /api/v1/load-balancers             # List load balancers
POST   /api/v1/load-balancers             # Create load balancer
GET    /api/v1/load-balancers/:id         # Get load balancer
PUT    /api/v1/load-balancers/:id         # Update load balancer
DELETE /api/v1/load-balancers/:id         # Delete load balancer
POST   /api/v1/load-balancers/:id/enable  # Enable load balancer
POST   /api/v1/load-balancers/:id/disable # Disable load balancer

GET    /api/v1/backend-servers            # List backend servers
POST   /api/v1/backend-servers            # Add backend server
GET    /api/v1/backend-servers/:id/health # Get health status

GET    /api/v1/monitoring/system          # System metrics
GET    /api/v1/monitoring/lb-stats        # LB statistics
GET    /api/v1/logs                       # View logs
```

## Development

### Prerequisites
- Node.js 18+
- npm 9+

### Setup
```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Push database schema
npm run db:push

# Seed database
cd packages/database
npm run db:seed

# Start all services in development mode
npm run dev
```

### Project Structure
```
├── packages/database/        # Shared database package
│   ├── prisma/schema.prisma # Database schema
│   └── src/index.ts         # Prisma client export
├── services/
│   ├── api/                 # Express API
│   ├── lb-engine/           # Load balancer engine
│   └── healthcheck/         # Health check service
└── frontend/                # Next.js frontend
```

## Troubleshooting

### Services won't start
```bash
# Check service status
systemctl status lb-api

# View detailed logs
journalctl -u lb-api -n 100

# Check if ports are available
netstat -tlnp | grep -E ':(3000|4000)'
```

### Database issues
```bash
# Regenerate Prisma client
cd /opt/lb-app/packages/database
npm run db:generate

# Reset database (⚠️ deletes all data)
rm /opt/lb-app/data/lb-app.db
npm run db:push
npm run db:seed
```

### Load balancer not routing traffic
1. Check if LB is enabled in UI
2. Verify backend servers are healthy
3. Check firewall rules
4. Review lb-engine logs

### Can't bind to port < 1024
Ensure lb-engine service has `CAP_NET_BIND_SERVICE` capability:
```bash
# Check systemd service file
grep -A5 "\[Service\]" /etc/systemd/system/lb-engine.service
```

## Security Considerations

1. **Change Default Password**: Immediately after installation
2. **JWT Secret**: Update JWT_SECRET in production
3. **Firewall**: Only expose necessary ports
4. **SSL/TLS**: Use strong certificates and ciphers
5. **User Permissions**: Run services as non-root where possible
6. **Database**: Secure database file permissions
7. **Updates**: Keep Node.js and dependencies updated

## Backup and Restore

### Backup
```bash
# Backup database
cp /opt/lb-app/data/lb-app.db /backup/lb-app-$(date +%Y%m%d).db

# Backup configuration
tar -czf /backup/lb-app-config-$(date +%Y%m%d).tar.gz \
  /etc/systemd/system/lb-*.service
```

### Restore
```bash
# Stop services
systemctl stop lb-api lb-engine lb-healthcheck lb-frontend

# Restore database
cp /backup/lb-app-20240101.db /opt/lb-app/data/lb-app.db
chown lb-app:lb-app /opt/lb-app/data/lb-app.db

# Start services
systemctl start lb-api lb-engine lb-healthcheck lb-frontend
```

## Uninstallation

```bash
sudo bash scripts/uninstall.sh
```

This will:
- Stop and disable all services
- Remove systemd service files
- Remove application files
- Optionally remove database, logs, and user

## Support and Contributing

For issues, questions, or contributions, please open an issue or pull request on GitHub.

## License

MIT License - See LICENSE file for details

## Credits

- Built with Node.js, Express, Next.js, and Prisma
- UI components from ShadCN/ui
- Icons from Lucide React

