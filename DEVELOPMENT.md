# Development Guide

Guide for developers who want to contribute or modify the Load Balancer application.

## Prerequisites

- Node.js 18+ and npm 9+
- Git
- A code editor (VS Code recommended)
- Basic knowledge of TypeScript, Node.js, React/Next.js

## Development Setup

### 1. Clone and Install

```bash
# Clone repository
git clone <repository-url>
cd load-balancer-app

# Install dependencies
npm install

# Generate Prisma client
cd packages/database
npm run db:generate
```

### 2. Configure Environment

Create `.env` file in the root:

```bash
# Database
DATABASE_URL="file:./packages/database/prisma/dev.db"

# API
API_PORT=4000
API_HOST=localhost
JWT_SECRET=dev-secret-key-change-in-production
JWT_EXPIRES_IN=24h

# Load Balancer Engine
LB_CONFIG_RELOAD_INTERVAL=30

# Health Check
HEALTHCHECK_INTERVAL=10
HEALTHCHECK_TIMEOUT=5

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1

# Logging
LOG_LEVEL=debug
```

### 3. Initialize Database

```bash
cd packages/database

# Create database
npm run db:push

# Seed with sample data
npm run db:seed
```

### 4. Start Development Servers

**Option A: All services at once**
```bash
npm run dev
```

**Option B: Individual services**

Terminal 1 - API:
```bash
npm run dev:api
```

Terminal 2 - LB Engine:
```bash
npm run dev:lb
```

Terminal 3 - Health Check:
```bash
npm run dev:healthcheck
```

Terminal 4 - Frontend:
```bash
npm run dev:frontend
```

### 5. Access Services

- Frontend: http://localhost:3000
- API: http://localhost:4000
- API Health: http://localhost:4000/health

## Project Structure

```
load-balancer-app/
├── packages/
│   └── database/              # Shared database package
│       ├── prisma/
│       │   ├── schema.prisma  # Database schema
│       │   └── seed.ts        # Seed data
│       └── src/
│           └── index.ts       # Prisma client export
│
├── services/
│   ├── api/                   # REST API (Express)
│   │   ├── src/
│   │   │   ├── controllers/   # Request handlers
│   │   │   ├── routes/        # API routes
│   │   │   ├── middleware/    # Auth, validation, errors
│   │   │   ├── utils/         # Utilities
│   │   │   └── index.ts       # API entry point
│   │   └── package.json
│   │
│   ├── lb-engine/             # Load balancer engine
│   │   ├── src/
│   │   │   ├── engine.ts      # Main engine
│   │   │   ├── config-manager.ts
│   │   │   ├── backend-pool.ts
│   │   │   ├── request-handler.ts
│   │   │   ├── stats-collector.ts
│   │   │   └── utils/
│   │   └── package.json
│   │
│   └── healthcheck/           # Health check service
│       ├── src/
│       │   ├── health-check-service.ts
│       │   ├── health-checker.ts
│       │   └── utils/
│       └── package.json
│
├── frontend/                  # Next.js frontend
│   ├── app/                   # Next.js app directory
│   │   ├── page.tsx           # Dashboard
│   │   ├── login/             # Login page
│   │   ├── load-balancers/    # LB management
│   │   └── ...
│   ├── components/
│   │   └── ui/                # ShadCN components
│   ├── lib/
│   │   ├── api.ts             # API client
│   │   └── utils.ts           # Utilities
│   └── package.json
│
├── systemd/                   # Systemd service files
├── scripts/                   # Installation scripts
├── package.json               # Root package.json (workspace)
├── tsconfig.json              # TypeScript config
├── README.md                  # Main documentation
└── DEVELOPMENT.md             # This file
```

## Database Development

### Prisma Commands

```bash
cd packages/database

# Generate Prisma client
npm run db:generate

# Create migration
npm run db:migrate

# Push schema changes (dev only)
npm run db:push

# Open Prisma Studio
npm run db:studio

# Seed database
npm run db:seed
```

### Modifying the Schema

1. Edit `packages/database/prisma/schema.prisma`
2. Run `npm run db:push` (development)
3. Or create migration: `npm run db:migrate`
4. Regenerate client: `npm run db:generate`

### Adding Seed Data

Edit `packages/database/prisma/seed.ts` and run:
```bash
npm run db:seed
```

## API Development

### Adding a New Endpoint

1. **Create/Update Controller** (`services/api/src/controllers/`)

```typescript
// services/api/src/controllers/example.controller.ts
import { Request, Response } from 'express';
import { prisma } from '@lb-app/database';

export class ExampleController {
  async list(req: Request, res: Response) {
    try {
      const items = await prisma.example.findMany();
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch items' });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const item = await prisma.example.create({
        data: req.body,
      });
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create item' });
    }
  }
}
```

2. **Create Routes** (`services/api/src/routes/`)

```typescript
// services/api/src/routes/example.routes.ts
import { Router } from 'express';
import { body } from 'express-validator';
import { ExampleController } from '../controllers/example.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const exampleRouter = Router();
const controller = new ExampleController();

exampleRouter.use(authenticate);

exampleRouter.get('/', controller.list.bind(controller));

exampleRouter.post(
  '/',
  [
    body('name').notEmpty().withMessage('Name is required'),
    validate,
  ],
  controller.create.bind(controller)
);
```

3. **Register Routes** (`services/api/src/routes/index.ts`)

```typescript
import { exampleRouter } from './example.routes';

router.use('/examples', exampleRouter);
```

### Testing API Endpoints

```bash
# Get authentication token
TOKEN=$(curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | jq -r '.token')

# Test endpoint
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/v1/examples
```

## Load Balancer Engine Development

### Architecture

The LB engine consists of:
- **Engine**: Manages multiple LB instances
- **Config Manager**: Loads config from database
- **Backend Pool**: Manages backend servers and algorithms
- **Request Handler**: Handles HTTP requests and proxying
- **Stats Collector**: Collects and persists metrics

### Testing Load Balancer

1. Start a test backend server:
```bash
# Simple HTTP server
python3 -m http.server 8080
```

2. Create a load balancer configuration in the database

3. The LB engine will automatically pick up the configuration

4. Test:
```bash
curl http://localhost:<lb-port>
```

### Adding a New Load Balancing Algorithm

Edit `services/lb-engine/src/backend-pool.ts`:

```typescript
selectBackend(clientIp?: string): BackendServerConfig | null {
  switch (this.config.algorithm) {
    case 'mynew algorithm':
      selectedBackend = this.myNewAlgorithm(availableBackends);
      break;
    // ... other cases
  }
}

private myNewAlgorithm(backends: BackendServerConfig[]): BackendServerConfig {
  // Your algorithm implementation
  return backends[0];
}
```

## Frontend Development

### Adding a New Page

1. Create page file: `frontend/app/my-page/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card } from '@/components/ui/card';

export default function MyPage() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await api.get('/my-endpoint');
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1>My Page</h1>
      {/* Your components */}
    </div>
  );
}
```

2. Add navigation link in main layout/dashboard

### Creating ShadCN Components

The project uses ShadCN components. To add more:

```bash
cd frontend

# Example: Add a dialog component
npx shadcn-ui@latest add dialog

# Example: Add a table component
npx shadcn-ui@latest add table
```

Components will be added to `frontend/components/ui/`

## Testing

### Manual Testing

```bash
# Test API
curl http://localhost:4000/health

# Test load balancer
curl http://localhost:<lb-port>

# Check logs
npm run dev:api
# Watch console output
```

### Database Testing

```bash
# Reset database
rm packages/database/prisma/dev.db
cd packages/database
npm run db:push
npm run db:seed
```

## Building for Production

```bash
# Build all services
npm run build

# Build individual services
npm run build:api
npm run build:lb
npm run build:healthcheck
npm run build:frontend
```

## Debugging

### VS Code Debug Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug API",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev:api"],
      "skipFiles": ["<node_internals>/**"],
      "console": "integratedTerminal"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug LB Engine",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev:lb"],
      "skipFiles": ["<node_internals>/**"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Logging

Set `LOG_LEVEL=debug` in `.env` for verbose logging.

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "Add: My new feature"

# Push and create PR
git push origin feature/my-feature
```

### Commit Message Convention

```
Add: New feature
Fix: Bug fix
Update: Modify existing feature
Remove: Delete code/feature
Refactor: Code refactoring
Docs: Documentation changes
```

## Common Development Tasks

### Regenerate Prisma Client
```bash
cd packages/database
npm run db:generate
```

### Reset Database
```bash
cd packages/database
rm prisma/dev.db*
npm run db:push
npm run db:seed
```

### Add New npm Package
```bash
# To a specific service
cd services/api
npm install <package>

# To frontend
cd frontend
npm install <package>

# To database package
cd packages/database
npm install <package>
```

### Update Dependencies
```bash
# Update all workspaces
npm update

# Check for outdated packages
npm outdated
```

## Performance Tips

1. **Database**: Add indexes for frequently queried fields
2. **API**: Implement caching for expensive queries
3. **LB Engine**: Use connection pooling
4. **Frontend**: Implement pagination for large lists

## Security Checklist

- [ ] Never commit `.env` files
- [ ] Use strong JWT secrets in production
- [ ] Validate all user inputs
- [ ] Sanitize database queries
- [ ] Use HTTPS in production
- [ ] Implement rate limiting
- [ ] Regular dependency updates

## Troubleshooting Development Issues

### Port already in use
```bash
# Find process using port
lsof -i :4000
# Kill process
kill -9 <PID>
```

### Prisma client out of sync
```bash
cd packages/database
npm run db:generate
```

### TypeScript errors
```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

## Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Express Documentation](https://expressjs.com/)
- [ShadCN/ui Documentation](https://ui.shadcn.com/)
- [Node.js HTTP Module](https://nodejs.org/api/http.html)

## Getting Help

- Check existing issues on GitHub
- Review logs in console
- Use Prisma Studio to inspect database
- Add debug logging to trace issues

