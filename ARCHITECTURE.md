# Architecture Documentation

Comprehensive architecture overview of the Load Balancer Application.

## System Overview

The Load Balancer Application is a full-stack solution consisting of four main services that work together to provide load balancing, health monitoring, and management capabilities.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Rocky Linux 9.6 VM                        │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Frontend (Next.js) - Port 3000                 │ │
│  │  • Dashboard                                                │ │
│  │  • Load Balancer Management                                │ │
│  │  • Backend Server Management                               │ │
│  │  • Monitoring & Logs                                       │ │
│  └────────────────┬───────────────────────────────────────────┘ │
│                   │ HTTP(S) API Calls                            │
│  ┌────────────────▼───────────────────────────────────────────┐ │
│  │         Backend API (Express) - Port 4000                   │ │
│  │  • RESTful API endpoints                                    │ │
│  │  • JWT Authentication                                       │ │
│  │  • Request validation                                       │ │
│  │  • Business logic                                           │ │
│  └──┬──────────────────┬──────────────────┬───────────────────┘ │
│     │                  │                  │                      │
│  ┌──▼──────┐   ┌──────▼────────┐   ┌────▼─────────────────┐   │
│  │ Prisma  │   │  LB Engine    │   │   Health Check       │   │
│  │   ORM   │   │  (Custom)     │   │   Service            │   │
│  │         │   │  • HTTP/HTTPS │   │  • Periodic checks   │   │
│  └──┬──────┘   │  • Algorithms │   │  • Status updates    │   │
│     │          │  • Stats      │   │  • Result storage    │   │
│  ┌──▼──────────┐└───────┬───────┘   └──────────────────────┘   │
│  │   SQLite    │        │                                        │
│  │   Database  │        │ Load Balanced Traffic                 │
│  └─────────────┘        │                                        │
│                         ▼                                        │
│              ┌────────────────────┐                             │
│              │  VIP (Virtual IP)  │                             │
│              └────────────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
                          │
                          │ Proxied Requests
                          ▼
        ┌─────────────────────────────────────┐
        │       Backend Server Pool           │
        │  ┌───────┐  ┌───────┐  ┌───────┐  │
        │  │  BE 1 │  │  BE 2 │  │  BE 3 │  │
        │  │  :8080│  │  :8080│  │  :8080│  │
        │  └───────┘  └───────┘  └───────┘  │
        └─────────────────────────────────────┘
```

## Core Components

### 1. Frontend Service (Next.js)

**Purpose**: Web-based management interface

**Technology Stack**:
- Next.js 14 (App Router)
- React 18
- ShadCN/ui components
- Tailwind CSS
- Axios for API communication

**Key Features**:
- Dashboard with real-time statistics
- Load balancer CRUD operations
- Backend server management
- Certificate management
- Health check configuration
- System monitoring
- Log viewing and export

**Pages**:
- `/` - Dashboard
- `/login` - Authentication
- `/load-balancers` - LB management
- `/backend-servers` - Server management
- `/certificates` - SSL/TLS management
- `/health-checks` - Health check config
- `/monitoring` - Real-time metrics
- `/logs` - System logs

**Communication**:
- Communicates with API service via REST
- Uses JWT tokens for authentication
- WebSocket support (future enhancement)

### 2. API Service (Express)

**Purpose**: Central management API for all operations

**Technology Stack**:
- Node.js + Express
- Prisma ORM
- JWT authentication
- Express Validator
- SystemInformation library

**Architecture**:
```
src/
├── controllers/        # Business logic handlers
│   ├── auth.controller.ts
│   ├── load-balancer.controller.ts
│   ├── backend-server.controller.ts
│   ├── certificate.controller.ts
│   ├── health-check.controller.ts
│   ├── monitoring.controller.ts
│   ├── log.controller.ts
│   ├── vip.controller.ts
│   └── user.controller.ts
├── routes/            # API route definitions
├── middleware/        # Authentication, validation
└── utils/            # Helper functions
```

**Key Endpoints**:
- `/api/v1/auth/*` - Authentication
- `/api/v1/load-balancers/*` - LB management
- `/api/v1/backend-servers/*` - Server management
- `/api/v1/certificates/*` - Certificate management
- `/api/v1/health-checks/*` - Health check config
- `/api/v1/monitoring/*` - Metrics and stats
- `/api/v1/logs/*` - Log retrieval
- `/api/v1/vip/*` - VIP management
- `/api/v1/users/*` - User management

**Security**:
- JWT-based authentication
- Password hashing with bcrypt
- Input validation
- SQL injection prevention via Prisma
- Role-based access control (admin/viewer)

### 3. Load Balancer Engine (Custom)

**Purpose**: Core load balancing functionality

**Technology Stack**:
- Node.js (native http/https modules)
- Custom implementation

**Architecture**:
```
src/
├── engine.ts              # Main engine orchestrator
├── config-manager.ts      # Configuration loading & hot reload
├── backend-pool.ts        # Backend server pool & algorithms
├── request-handler.ts     # HTTP request proxying
├── stats-collector.ts     # Statistics collection
└── utils/
    └── logger.ts          # Logging utility
```

**Core Functionality**:

**1. Configuration Management**
- Polls database every 30 seconds (configurable)
- Hot reload without dropping connections
- Supports multiple load balancers simultaneously

**2. Load Balancing Algorithms**
- **Round Robin**: Sequential distribution
- **Least Connections**: Route to server with fewest connections
- **Weighted**: Distribution based on server weights
- **IP Hash**: Session persistence via client IP hashing

**3. Request Handling**
- HTTP/1.1 support
- SSL/TLS termination
- Connection pooling to backends
- Keep-alive connections
- Request/response streaming
- Timeout management
- Retry logic

**4. Traffic Flow**:
```
Client Request
    ↓
Accept on VIP:Port
    ↓
SSL Termination (if HTTPS)
    ↓
Parse HTTP Request
    ↓
Select Backend (Algorithm)
    ↓
Check Health Status
    ↓
Get/Create Connection
    ↓
Forward Request
    ↓
Stream Response
    ↓
Record Statistics
    ↓
Return Connection to Pool
```

**5. Statistics Collection**
- Request count
- Response times
- Bytes in/out
- Error rates
- Connection counts
- Per-backend metrics

### 4. Health Check Service

**Purpose**: Monitor backend server health

**Technology Stack**:
- Node.js
- Native http/https/net modules

**Architecture**:
```
src/
├── health-check-service.ts   # Orchestrator
├── health-checker.ts          # Check execution
└── utils/
    └── logger.ts
```

**Functionality**:

**1. Check Types**
- **HTTP/HTTPS**: Sends GET request, validates status code
- **TCP**: Tests TCP connection establishment

**2. Check Configuration**
- Interval: How often to check (seconds)
- Timeout: Maximum wait time (seconds)
- Healthy Threshold: Consecutive successes to mark healthy
- Unhealthy Threshold: Consecutive failures to mark unhealthy
- Expected Status: Expected HTTP status code (default 200)
- Path: HTTP endpoint to check (default /)

**3. Check Process**:
```
Load Check Configurations
    ↓
For each Backend Server:
    ↓
Execute Check (HTTP/TCP)
    ↓
Record Result (success/failure/timeout)
    ↓
Update Server Status in DB
    ↓
Store Check Result
    ↓
Wait for Interval
    ↓
Repeat
```

**4. Result Storage**
- All results stored in database
- Available via API for history/analysis
- Used by LB engine to determine routing

### 5. Database Layer (Prisma + SQLite)

**Purpose**: Persistent storage for all data

**Technology**: 
- Prisma ORM
- SQLite database

**Schema Overview**:

**Core Entities**:
- `User` - Authentication and authorization
- `Session` - User sessions with JWT tokens
- `LoadBalancer` - LB configurations
- `ServerPool` - Groups of backend servers
- `BackendServer` - Individual backend servers
- `VirtualIP` - Virtual IP addresses
- `Certificate` - SSL/TLS certificates
- `HealthCheck` - Health check configurations

**Time-Series Data**:
- `HealthCheckResult` - Health check history
- `LoadBalancerStat` - LB metrics over time
- `BackendServerStat` - Backend metrics over time
- `SystemMetric` - System resource metrics
- `Log` - Application logs

**Relationships**:
```
LoadBalancer
  ├─── ServerPool (1:1)
  │      └─── BackendServers (1:N)
  ├─── VirtualIP (1:1)
  ├─── Certificate (1:1)
  ├─── HealthCheck (1:1)
  ├─── Logs (1:N)
  └─── Stats (1:N)

BackendServer
  ├─── HealthCheckResults (1:N)
  └─── Stats (1:N)
```

## Data Flow

### 1. Configuration Update Flow

```
User updates LB config via UI
    ↓
API validates and saves to DB
    ↓
Config Manager polls DB (30s interval)
    ↓
Detects configuration change
    ↓
Engine reloads LB instances
    ↓
New configuration active
```

### 2. Request Routing Flow

```
Client sends HTTP request
    ↓
LB Engine accepts on VIP:Port
    ↓
SSL termination (if HTTPS)
    ↓
Backend Pool selects server (algorithm)
    ↓
Checks if server is healthy
    ↓
Gets connection from pool
    ↓
Forwards request to backend
    ↓
Streams response to client
    ↓
Records statistics
    ↓
Returns connection to pool
```

### 3. Health Check Flow

```
Health Check Service runs on schedule
    ↓
For each backend server:
    ├─ Execute HTTP/TCP check
    ├─ Measure response time
    └─ Determine status
    ↓
Store result in database
    ↓
Update backend server status
    ↓
LB Engine uses status for routing
```

### 4. Monitoring Data Flow

```
LB Engine collects metrics
    ↓
Stats Collector aggregates (in-memory)
    ↓
Flushes to DB every 60 seconds
    ↓
API reads from DB
    ↓
Frontend displays in real-time
```

## Deployment Architecture

### Process Management

All services run as systemd services:

```
systemd
  ├── lb-api.service        (User: lb-app)
  ├── lb-engine.service     (User: root, CAP_NET_BIND_SERVICE)
  ├── lb-healthcheck.service (User: lb-app)
  └── lb-frontend.service   (User: lb-app)
```

### File System Layout

```
/opt/lb-app/                    # Application root
  ├── packages/
  │   └── database/             # Shared database package
  ├── services/
  │   ├── api/                  # API service
  │   ├── lb-engine/            # LB engine
  │   └── healthcheck/          # Health check service
  └── frontend/                 # Frontend application

/opt/lb-app/data/               # Data directory
  └── lb-app.db                 # SQLite database

/var/log/lb-app/                # Log directory

/etc/systemd/system/            # Systemd services
  ├── lb-api.service
  ├── lb-engine.service
  ├── lb-healthcheck.service
  └── lb-frontend.service
```

### Network Ports

- **3000**: Frontend web interface
- **4000**: API service
- **Configurable**: Load balancer listen ports (80, 443, etc.)

### Security Model

**Process Isolation**:
- API, Health Check, and Frontend run as `lb-app` user
- LB Engine runs as root (requires CAP_NET_BIND_SERVICE for ports < 1024)

**Authentication**:
- JWT tokens with configurable expiration
- Bcrypt password hashing (10 rounds)
- Session management in database

**Network Security**:
- API bound to localhost or specific interface
- Firewall rules for exposed ports
- SSL/TLS for encrypted traffic

## Scalability Considerations

### Current Limitations

1. **Single Instance**: One VM runs all services
2. **SQLite**: Not suitable for high concurrency
3. **No Clustering**: Single point of failure

### Future Enhancements

1. **Database**: Migrate to PostgreSQL/MySQL for better concurrency
2. **LB Engine**: Support clustering with shared state
3. **API**: Horizontal scaling with load balancer in front
4. **Health Checks**: Distributed health checking
5. **VIP**: Support for VRRP/Keepalived for HA
6. **Monitoring**: Integration with Prometheus/Grafana
7. **Logging**: Centralized logging with ELK stack

## Performance Characteristics

### Load Balancer Engine

- **Throughput**: ~5,000-10,000 req/s (depending on backend latency)
- **Latency**: <5ms proxy overhead (excluding backend time)
- **Memory**: ~50-100MB per LB instance
- **CPU**: Scales with request rate

### API Service

- **Response Time**: <50ms for most endpoints
- **Concurrency**: Handles 100+ concurrent requests
- **Memory**: ~100-200MB
- **Database**: SQLite suitable for <1000 ops/sec

### Health Check Service

- **Check Frequency**: Configurable (default 10s)
- **Concurrent Checks**: All backends checked in parallel
- **Memory**: ~30-50MB
- **CPU**: Minimal (<5%)

## Monitoring and Observability

### Metrics Collected

**System Level**:
- CPU usage (%)
- Memory usage (MB, %)
- Disk usage (GB, %)
- Network traffic (bytes in/out)

**Load Balancer Level**:
- Request count
- Requests per second
- Average response time
- Error rate (%)
- Bytes in/out
- Active connections

**Backend Server Level**:
- Request count
- Response times
- Error count
- Health status
- Connection count

### Logging

**Log Levels**:
- DEBUG: Detailed debugging information
- INFO: General informational messages
- WARN: Warning messages
- ERROR: Error conditions

**Log Categories**:
- `system`: System-level events
- `api`: API operations
- `loadbalancer`: LB operations
- `healthcheck`: Health check events

**Log Storage**:
- Systemd journal (`journalctl`)
- Database (via API)
- File system (optional)

## Error Handling

### LB Engine

1. **Backend Unavailable**: Try next backend (up to maxRetries)
2. **All Backends Down**: Return 503 Service Unavailable
3. **Timeout**: Close connection, try next backend
4. **Connection Error**: Mark backend as unhealthy
5. **Invalid Configuration**: Log error, skip that LB

### API Service

1. **Invalid Request**: Return 400 with error details
2. **Unauthorized**: Return 401
3. **Not Found**: Return 404
4. **Server Error**: Return 500, log error

### Health Check Service

1. **Check Failure**: Record failure, update status
2. **Timeout**: Mark as timeout, count toward threshold
3. **Network Error**: Mark backend as down

## Configuration Hot Reload

The LB Engine supports configuration updates without downtime:

1. Config Manager polls database every 30 seconds
2. Compares new config with current config
3. If changed:
   - For new LBs: Start new instance
   - For removed LBs: Gracefully stop instance
   - For modified LBs: Stop and restart instance
4. Connections are gracefully drained during restart

## Security Considerations

### Threat Model

**Threats**:
- Unauthorized access to management interface
- SQL injection attacks
- SSL certificate theft
- DoS attacks on load balancer
- Privilege escalation

**Mitigations**:
- JWT authentication with secure secrets
- Prisma ORM prevents SQL injection
- Certificates stored in database with limited access
- Rate limiting (future enhancement)
- Separate process users, limited capabilities

### Best Practices

1. Change default admin password
2. Use strong JWT secrets
3. Enable firewall rules
4. Use HTTPS for management interface
5. Regular security updates
6. Monitor logs for suspicious activity
7. Backup database regularly
8. Restrict SSH access
9. Use strong SSL/TLS ciphers
10. Implement rate limiting

## Disaster Recovery

### Backup Strategy

1. **Database Backup**:
   ```bash
   cp /opt/lb-app/data/lb-app.db /backup/
   ```

2. **Configuration Backup**:
   ```bash
   tar -czf backup.tar.gz /etc/systemd/system/lb-*.service
   ```

3. **Full Application Backup**:
   ```bash
   tar -czf full-backup.tar.gz /opt/lb-app
   ```

### Recovery Procedures

1. **Database Corruption**:
   - Stop services
   - Restore database from backup
   - Restart services

2. **Service Failure**:
   - Check logs: `journalctl -u <service>`
   - Restart service: `systemctl restart <service>`
   - If persistent: Reinstall application

3. **Complete System Failure**:
   - Install fresh Rocky Linux
   - Run installer script
   - Restore database backup
   - Verify all services

## Future Roadmap

### Short Term
- [ ] WebSocket support for real-time updates
- [ ] Enhanced monitoring dashboards
- [ ] Rate limiting per client IP
- [ ] Request/response header manipulation
- [ ] URL rewriting

### Medium Term
- [ ] PostgreSQL support
- [ ] HTTP/2 support
- [ ] WebSocket proxying
- [ ] Advanced SSL/TLS features (OCSP stapling)
- [ ] Metrics export (Prometheus)

### Long Term
- [ ] High Availability with clustering
- [ ] Multi-region support
- [ ] Auto-scaling backends
- [ ] Machine learning for traffic prediction
- [ ] WAF (Web Application Firewall) features
- [ ] DDoS protection

