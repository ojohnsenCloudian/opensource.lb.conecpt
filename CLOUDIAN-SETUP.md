# Cloudian HyperStore Load Balancer Setup Guide

Complete guide for setting up the Load Balancer for Cloudian HyperStore S3 storage clusters.

## Overview

Cloudian HyperStore typically exposes multiple services on different ports:
- **Port 443**: S3 API (HTTPS)
- **Port 80**: S3 API (HTTP)
- **Port 8084**: Admin API
- **Port 9443**: CMC (Cloudian Management Console)
- **Port 18081**: IAM Service
- **Port 19443**: CMC Admin API

This guide shows you how to configure **one VIP** to load balance **all these services** simultaneously.

## Architecture

```
                      Single VIP: 10.0.0.100
                              |
        ┌─────────────────────┼─────────────────────┐
        |                     |                     |
    Port 443              Port 8084           Port 9443
    (S3 API)             (Admin API)        (CMC Console)
        |                     |                     |
   ┌────┴────┐          ┌────┴────┐          ┌────┴────┐
   │   LB1   │          │   LB2   │          │   LB3   │
   └────┬────┘          └────┬────┘          └────┬────┘
        |                     |                     |
   ┌────┴─────────┐    ┌────┴────────┐     ┌─────┴─────┐
   | S3 Pool      |    | Admin Pool  |     | CMC Pool  |
   ├──────────────┤    ├─────────────┤     ├───────────┤
   | node1:443    |    | node1:8084  |     | node1:9443|
   | node2:443    |    | node2:8084  |     | node2:9443|
   | node3:443    |    | node3:8084  |     | node3:9443|
   └──────────────┘    └─────────────┘     └───────────┘
```

## Step-by-Step Setup

### 1. Install Load Balancer Application

```bash
# Clone and install
git clone <your-repo-url>
cd load-balancer-app
sudo bash scripts/install.sh
```

### 2. Login to Web Interface

```bash
# Access UI
open http://<lb-server-ip>:3000

# Default credentials
Username: admin
Password: admin123
```

### 3. Create Virtual IP

**Via Web UI:**
1. Navigate to "VIPs" → Click "Add VIP"
2. Configure:
   - IP Address: `10.0.0.100` (your Cloudian VIP)
   - Interface: `eth0` (or your network interface)
   - Description: "Cloudian HyperStore VIP"
3. Click "Add VIP"

**Via API:**
```bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.token')

VIP_ID=$(curl -s -X POST http://localhost:4000/api/v1/vip \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ipAddress":"10.0.0.100","interface":"eth0","description":"Cloudian VIP"}' \
  | jq -r '.id')
```

### 4. Configure S3 API Load Balancer (Port 443)

#### A. Create Server Pool for S3 Nodes

**Via Web UI:**
1. Navigate to "Server Pools" → "Create Pool"
2. Name: `cloudian-s3-pool`
3. Description: "S3 API nodes"

#### B. Add Backend Servers

1. Navigate to "Backend Servers" → "Add Server"
2. Add each Cloudian node:
   ```
   Name: cloudian-s3-node1
   IP: 192.168.1.101
   Port: 443
   Pool: cloudian-s3-pool
   Weight: 100
   ```
3. Repeat for all S3 nodes

**Via API:**
```bash
# Create S3 pool
S3_POOL_ID=$(curl -s -X POST http://localhost:4000/api/v1/server-pools \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"cloudian-s3-pool","description":"S3 API nodes"}' \
  | jq -r '.id')

# Add S3 backend nodes
for i in 101 102 103; do
  curl -X POST http://localhost:4000/api/v1/backend-servers \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"cloudian-s3-node${i}\",\"ipAddress\":\"192.168.1.${i}\",\"port\":443,\"poolId\":\"$S3_POOL_ID\",\"weight\":100}"
done
```

#### C. Create Health Check for S3

1. Navigate to "Health Checks" → "Create"
2. Configure:
   - Name: `s3-health-check`
   - Type: HTTPS
   - Path: `/` (or Cloudian's health endpoint)
   - Interval: 10 seconds
   - Timeout: 5 seconds
   - Expected Status: 200

```bash
# Via API
S3_HC_ID=$(curl -s -X POST http://localhost:4000/api/v1/health-checks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"s3-health-check","type":"https","path":"/","interval":10,"timeout":5}' \
  | jq -r '.id')
```

#### D. Upload SSL Certificate (if needed)

1. Navigate to "Certificates" → "Upload Certificate"
2. Upload your Cloudian SSL certificate
   - Certificate content (PEM)
   - Private key (PEM)
   - Chain (optional)

#### E. Create Load Balancer for S3 API

1. Navigate to "Load Balancers" → "Create"
2. Configure:
   - Name: `cloudian-s3-api`
   - Protocol: HTTPS
   - Listen Port: 443
   - Algorithm: **Least Connections** (recommended for S3)
   - VIP: Select your VIP (10.0.0.100)
   - Server Pool: `cloudian-s3-pool`
   - SSL Certificate: Select your certificate
   - Health Check: `s3-health-check`
3. Click "Create" then "Enable"

```bash
# Via API
S3_LB_ID=$(curl -s -X POST http://localhost:4000/api/v1/load-balancers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\":\"cloudian-s3-api\",
    \"protocol\":\"https\",
    \"listenPort\":443,
    \"algorithm\":\"leastconn\",
    \"vipId\":\"$VIP_ID\",
    \"serverPoolId\":\"$S3_POOL_ID\",
    \"certificateId\":\"$CERT_ID\",
    \"healthCheckId\":\"$S3_HC_ID\"
  }" | jq -r '.id')

# Enable it
curl -X POST http://localhost:4000/api/v1/load-balancers/$S3_LB_ID/enable \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Configure Admin API Load Balancer (Port 8084)

Repeat similar steps for Admin API:

```bash
# Create admin pool
ADMIN_POOL_ID=$(curl -s -X POST http://localhost:4000/api/v1/server-pools \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"cloudian-admin-pool","description":"Admin API nodes"}' \
  | jq -r '.id')

# Add admin backend nodes
for i in 101 102 103; do
  curl -X POST http://localhost:4000/api/v1/backend-servers \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"cloudian-admin-node${i}\",\"ipAddress\":\"192.168.1.${i}\",\"port\":8084,\"poolId\":\"$ADMIN_POOL_ID\"}"
done

# Create admin health check
ADMIN_HC_ID=$(curl -s -X POST http://localhost:4000/api/v1/health-checks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"admin-health-check","type":"http","path":"/","interval":10}' \
  | jq -r '.id')

# Create admin load balancer
ADMIN_LB_ID=$(curl -s -X POST http://localhost:4000/api/v1/load-balancers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\":\"cloudian-admin-api\",
    \"protocol\":\"http\",
    \"listenPort\":8084,
    \"algorithm\":\"roundrobin\",
    \"vipId\":\"$VIP_ID\",
    \"serverPoolId\":\"$ADMIN_POOL_ID\",
    \"healthCheckId\":\"$ADMIN_HC_ID\"
  }" | jq -r '.id')

# Enable
curl -X POST http://localhost:4000/api/v1/load-balancers/$ADMIN_LB_ID/enable \
  -H "Authorization: Bearer $TOKEN"
```

### 6. Configure CMC Load Balancer (Port 9443)

Similarly for CMC:

```bash
# Create CMC pool and servers
CMC_POOL_ID=$(curl -s -X POST http://localhost:4000/api/v1/server-pools \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"cloudian-cmc-pool","description":"CMC Console nodes"}' \
  | jq -r '.id')

for i in 101 102 103; do
  curl -X POST http://localhost:4000/api/v1/backend-servers \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"cloudian-cmc-node${i}\",\"ipAddress\":\"192.168.1.${i}\",\"port\":9443,\"poolId\":\"$CMC_POOL_ID\"}"
done

# Create CMC load balancer
CMC_LB_ID=$(curl -s -X POST http://localhost:4000/api/v1/load-balancers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\":\"cloudian-cmc\",
    \"protocol\":\"https\",
    \"listenPort\":9443,
    \"algorithm\":\"roundrobin\",
    \"vipId\":\"$VIP_ID\",
    \"serverPoolId\":\"$CMC_POOL_ID\",
    \"certificateId\":\"$CERT_ID\"
  }" | jq -r '.id')

curl -X POST http://localhost:4000/api/v1/load-balancers/$CMC_LB_ID/enable \
  -H "Authorization: Bearer $TOKEN"
```

## Testing

### Test S3 API through Load Balancer

```bash
# Using AWS CLI
aws s3 ls --endpoint-url https://10.0.0.100:443

# Using curl
curl -k https://10.0.0.100:443/

# Test with s3cmd
s3cmd ls --host=10.0.0.100:443 --host-bucket=%(bucket)s.10.0.0.100:443
```

### Test Admin API

```bash
curl http://10.0.0.100:8084/stats
```

### Test CMC

```bash
open https://10.0.0.100:9443
```

## Monitoring

1. Navigate to "Monitoring" in the web UI
2. View real-time metrics for each service
3. Check backend server health status
4. Monitor request rates and response times

## Load Balancing Algorithms for Cloudian

### Recommended Algorithms by Service:

**S3 API (Port 443):**
- **Best: Least Connections**
  - S3 requests vary greatly in duration (small vs large objects)
  - Least connections distributes load more evenly
  - Better for mixed workloads

- **Alternative: IP Hash**
  - Use if you need session persistence
  - Same client always hits same backend
  - Can help with caching

**Admin API (Port 8084):**
- **Best: Round Robin**
  - Admin operations are typically short-lived
  - Equal distribution works well

**CMC Console (Port 9443):**
- **Best: Round Robin with IP Hash**
  - Web sessions benefit from sticky sessions
  - Configure `sessionPersistence: true`

## Advanced Configuration

### Session Persistence for CMC

1. Edit the CMC load balancer
2. Enable "Session Persistence"
3. This uses IP Hash to maintain session affinity

### SSL Passthrough (Optional)

If you want SSL termination on Cloudian nodes instead of load balancer:
1. Use protocol: `tcp`
2. Forward encrypted traffic directly to backends
3. No certificate needed on load balancer

### High Availability

For production:
1. Deploy multiple load balancer VMs
2. Use Keepalived + VRRP for VIP failover
3. Configure both load balancers identically

## Performance Tuning

### For High-Throughput S3 Operations

Edit load balancer timeouts:
```json
{
  "connectionTimeout": 10000,    // 10 seconds
  "requestTimeout": 300000,      // 5 minutes for large uploads
  "maxRetries": 1                // Retry once on failure
}
```

### Connection Pooling

The LB engine automatically pools connections to backends:
- Reuses TCP connections
- Reduces overhead
- Better performance

## Troubleshooting

### S3 requests failing

```bash
# Check load balancer status
systemctl status lb-engine

# Check backend health
curl http://localhost:4000/api/v1/backend-servers

# View logs
journalctl -u lb-engine -f
```

### High latency

1. Check backend server health in UI
2. Verify network connectivity
3. Consider algorithm change (try Least Connections)
4. Monitor system resources on LB server

### SSL certificate errors

1. Verify certificate matches domain
2. Check certificate expiration
3. Ensure private key is correct
4. Review logs: `journalctl -u lb-api -f`

## Complete Setup Script

Here's a complete automated setup script:

```bash
#!/bin/bash

API_URL="http://localhost:4000/api/v1"
VIP="10.0.0.100"
CLOUDIAN_NODES=("192.168.1.101" "192.168.1.102" "192.168.1.103")

# Login
TOKEN=$(curl -s -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.token')

# Create VIP
VIP_ID=$(curl -s -X POST $API_URL/vip \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"ipAddress\":\"$VIP\",\"interface\":\"eth0\"}" \
  | jq -r '.id')

# Setup S3 API (Port 443)
S3_POOL_ID=$(curl -s -X POST $API_URL/server-pools \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"cloudian-s3-pool"}' | jq -r '.id')

for i in "${!CLOUDIAN_NODES[@]}"; do
  curl -X POST $API_URL/backend-servers \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"s3-node$i\",\"ipAddress\":\"${CLOUDIAN_NODES[$i]}\",\"port\":443,\"poolId\":\"$S3_POOL_ID\"}"
done

S3_HC_ID=$(curl -s -X POST $API_URL/health-checks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"s3-hc","type":"https","path":"/"}' | jq -r '.id')

S3_LB_ID=$(curl -s -X POST $API_URL/load-balancers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"cloudian-s3\",\"protocol\":\"https\",\"listenPort\":443,\"algorithm\":\"leastconn\",\"vipId\":\"$VIP_ID\",\"serverPoolId\":\"$S3_POOL_ID\",\"healthCheckId\":\"$S3_HC_ID\"}" \
  | jq -r '.id')

curl -X POST $API_URL/load-balancers/$S3_LB_ID/enable \
  -H "Authorization: Bearer $TOKEN"

echo "Setup complete! S3 API available at https://$VIP:443"
```

## Best Practices

1. **Use Least Connections for S3**: Better load distribution
2. **Enable Health Checks**: Automatic failover on node failure
3. **Monitor Backend Health**: Check UI regularly
4. **SSL Certificates**: Keep certificates up to date
5. **Resource Monitoring**: Watch CPU/memory on LB server
6. **Backup Configuration**: Regular database backups
7. **Log Review**: Monitor logs for errors
8. **Test Failover**: Simulate node failures

## Production Checklist

- [ ] All Cloudian nodes added to pools
- [ ] Health checks configured and passing
- [ ] SSL certificates valid and not expiring soon
- [ ] All load balancers enabled
- [ ] VIP accessible from client network
- [ ] Firewall rules configured
- [ ] Monitoring dashboard accessible
- [ ] Backup strategy in place
- [ ] Documentation updated with actual IPs
- [ ] Load testing performed
- [ ] Failover tested

## Support

For issues specific to this load balancer:
- Check logs: `journalctl -u lb-engine -f`
- Review documentation: README.md
- Web UI: Monitoring and Logs sections

For Cloudian-specific issues:
- Consult Cloudian HyperStore documentation
- Check Cloudian node logs
- Verify Cloudian configuration

