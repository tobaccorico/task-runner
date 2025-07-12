
## Key Features

### 🚀 New 
- **Task monitoring** - execution tracking, performance metrics, health status
- **Enhanced error handling** - better logging, retry logic, timeout support
- **LocalStack support** - local development without AWS costs
- **Configuration validation** - task definition validation and suggestions
- **Health checks** - system and dependency health monitoring

## Installation

```bash
npm install

npm run setup:localstack
npm run local

npm start
```

## Configuration

### Existing Configuration (Preserved)
All existing JSON task files work unchanged:
- `api2.json` - API server tasks
- `coins.json` - Coin data tasks  
- `dimensions.json` - Dimension tasks
- `stablecoin.json` - Stablecoin tasks
- `tvl-dev.json` - TVL development tasks

### Enhanced Configuration (Optional)
Tasks can now include optional enhancement fields:

```json
{
  "tasks": {
    "enhanced-task": {
      "schedule": "*/5 * * * *",
      "bash_script": ["long-running-command"],
      "timeout": 300000,
      "retry_on_failure": true,
      "max_retries": 3,
      "retry_delay": 60000
    }
  }
}
```

## Local Development

### Using LocalStack

0. `sudo usermod -aG docker $USER && newgrp docker`
1. `sudo systemctl start docker`
2. Start LocalStack: `npm run localstack:setup`
3. Setup tables: `npm run localstack:start`
4. Run locally: `npm run local`

### Environment Variables
- `NODE_ENV=local` - Enables LocalStack mode
- `USE_LOCALSTACK=true` - Forces LocalStack usage
- `LOCALSTACK_ENDPOINT` - LocalStack endpoint (default: http://localhost:4566)
- `TASK_FILE` - Task configuration file (default: api2.json)

## Monitoring

### Health Checks
```bash
npm run health
```

### Log Files
- `logs/task-monitor.log` - Task execution events
- `logs/health-report.json` - Latest health status
- `logs/task-stats-final.json` - Final stats on shutdown

### Monitoring Data
- Task execution times and success rates
- Error tracking and failure analysis  
- System health and dependency status
- Active execution tracking

## Testing
```bash

npm test

npm run test:watch
```

## Migration Guide

### Adding Enhancements to Tasks
Optionally enhance existing tasks:

```json
// Before (still works)
{
  "schedule": "*/30 * * * *",
  "bash_script": ["git pull", "npm run build"]
}

// After (enhanced)
{
  "schedule": "*/30 * * * *", 
  "bash_script": ["git pull", "npm run build"],
  "timeout": 600000,
  "retry_on_failure": true,
  "max_retries": 2
}
```

## Architecture
- `app.js` - Main application with hot-reloading
- `aws.js` - DynamoDB secrets management
- Task JSON files - Configuration definitions

### New Components
- `task-monitor.js` 
- `task-executor.js` - with timeout/retry
- `config-validator.js` 
- `health-check.js` 
- `setup-localstack.js`

## Deployment

### Development
```bash
NODE_ENV=local npm start
```

### Production (unchanged)
```bash
NODE_ENV=production npm start
```