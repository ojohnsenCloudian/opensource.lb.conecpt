# Quick Start Guide

Get your Load Balancer up and running in 5 minutes!

## Installation on Rocky Linux 9.6

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd load-balancer-app

# 2. Run the installer (as root)
sudo bash scripts/install.sh

# 3. Access the web interface
open http://<your-server-ip>:3000

# 4. Login with default credentials
# Username: admin
# Password: admin123
```

## Create Your First Load Balancer

### Via Web UI (Recommended for beginners)

1. **Login** to the web interface at `http://<server-ip>:3000`

2. **Create a Server Pool:**
   - Click "Backend Servers" in navigation
   - Click "Create Pool"
   - Name it "web-servers"

3. **Add Backend Servers:**
   - Click "Add Server"
   - Add your backend servers:
     - Server 1: `192.168.1.10:8080`
     - Server 2: `192.168.1.11:8080`

4. **Create a Health Check:**
   - Click "Health Checks"
   - Click "Create"
   - Configure:
     - Name: "http-check"
     - Type: HTTP
     - Path: `/health`
     - Interval: 10 seconds

5. **Create Load Balancer:**
   - Click "Load Balancers"
   - Click "Create"
   - Configure:
     - Name: "my-first-lb"
     - Protocol: HTTP
     - Port: 80
     - Algorithm: Round Robin
     - Server Pool: web-servers
     - Health Check: http-check

6. **Enable the Load Balancer:**
   - Click "Enable" button
   - Your load balancer is now active!

7. **Test it:**
   ```bash
   curl http://<server-ip>:80
   ```

### Via API

```bash
# 1. Login and get token
TOKEN=$(curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | jq -r '.token')

# 2. Create a server pool
POOL_ID=$(curl -s -X POST http://localhost:4000/api/v1/server-pools \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"web-servers","description":"Web server pool"}' \
  | jq -r '.id')

# 3. Add backend servers
curl -X POST http://localhost:4000/api/v1/backend-servers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"web-1\",\"ipAddress\":\"192.168.1.10\",\"port\":8080,\"poolId\":\"$POOL_ID\"}"

curl -X POST http://localhost:4000/api/v1/backend-servers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"web-2\",\"ipAddress\":\"192.168.1.11\",\"port\":8080,\"poolId\":\"$POOL_ID\"}"

# 4. Create health check
HC_ID=$(curl -s -X POST http://localhost:4000/api/v1/health-checks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"http-check","type":"http","path":"/health"}' \
  | jq -r '.id')

# 5. Create load balancer
LB_ID=$(curl -s -X POST http://localhost:4000/api/v1/load-balancers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"my-first-lb\",\"protocol\":\"http\",\"listenPort\":80,\"algorithm\":\"roundrobin\",\"serverPoolId\":\"$POOL_ID\",\"healthCheckId\":\"$HC_ID\"}" \
  | jq -r '.id')

# 6. Enable load balancer
curl -X POST http://localhost:4000/api/v1/load-balancers/$LB_ID/enable \
  -H "Authorization: Bearer $TOKEN"

echo "Load balancer created and enabled! Test with: curl http://localhost:80"
```

## Adding HTTPS Support

1. **Prepare your SSL certificate files:**
   - Certificate: `cert.pem`
   - Private Key: `key.pem`
   - Chain (optional): `chain.pem`

2. **Upload certificate via UI:**
   - Navigate to "Certificates"
   - Click "Upload Certificate"
   - Fill in the form and paste certificate content

3. **Create HTTPS load balancer:**
   - Select "HTTPS" as protocol
   - Choose your certificate
   - Use port 443

## Monitoring and Logs

### View Real-time Monitoring
- Navigate to "Monitoring" in the web UI
- See system metrics, LB stats, and backend health

### Check Service Logs
```bash
# API logs
journalctl -u lb-api -f

# Load balancer engine logs
journalctl -u lb-engine -f

# Health check logs
journalctl -u lb-healthcheck -f

# All services
journalctl -u 'lb-*' -f
```

### Check Service Status
```bash
systemctl status lb-api lb-engine lb-healthcheck lb-frontend
```

## Common Operations

### Restart All Services
```bash
sudo systemctl restart lb-api lb-engine lb-healthcheck lb-frontend
```

### Backup Database
```bash
sudo cp /opt/lb-app/data/lb-app.db ~/lb-backup-$(date +%Y%m%d).db
```

### View Database
```bash
cd /opt/lb-app/packages/database
npm run db:studio
# Opens Prisma Studio on port 5555
```

### Change Admin Password
1. Login to web UI
2. Navigate to "Users"
3. Edit admin user
4. Set new password

## Troubleshooting

### Load balancer not responding
```bash
# Check if service is running
sudo systemctl status lb-engine

# Check if port is listening
sudo netstat -tlnp | grep <port>

# View recent logs
sudo journalctl -u lb-engine -n 50
```

### Backend servers showing as unhealthy
1. Check health check configuration
2. Verify backend servers are reachable:
   ```bash
   curl http://<backend-ip>:<port>/health
   ```
3. Check health check service logs:
   ```bash
   sudo journalctl -u lb-healthcheck -f
   ```

### Can't access web UI
```bash
# Check if frontend service is running
sudo systemctl status lb-frontend

# Check if port 3000 is open
sudo firewall-cmd --list-ports

# Add port if needed
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Explore the API documentation
- Set up SSL certificates for production
- Configure VIPs for high availability
- Review security best practices
- Set up automated backups

## Getting Help

- Check logs: `journalctl -u lb-api -n 100`
- Review configuration: `/etc/systemd/system/lb-*.service`
- Database location: `/opt/lb-app/data/lb-app.db`
- Application directory: `/opt/lb-app`

## Useful Commands Cheat Sheet

```bash
# Service management
sudo systemctl start|stop|restart|status lb-api
sudo systemctl start|stop|restart|status lb-engine
sudo systemctl start|stop|restart|status lb-healthcheck
sudo systemctl start|stop|restart|status lb-frontend

# View logs
sudo journalctl -u lb-api -f          # Follow API logs
sudo journalctl -u lb-engine -f       # Follow engine logs
sudo journalctl -u 'lb-*' -f          # Follow all services

# Check ports
sudo netstat -tlnp | grep -E ':(3000|4000|80|443)'

# Database management
cd /opt/lb-app/packages/database
npm run db:studio                     # Open Prisma Studio
npm run db:generate                   # Regenerate Prisma client

# Firewall
sudo firewall-cmd --list-all
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --reload
```

