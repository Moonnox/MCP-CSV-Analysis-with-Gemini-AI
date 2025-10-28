# Docker Deployment Guide

## Quick Start

### 1. Create Environment File
Create a `.env` file in the project root:

```env
# Required
GEMINI_API_KEY=your_gemini_api_key_here

# Optional (for image uploads)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=your_supabase_anon_key

# Optional
PORT=3000
```

### 2. Build and Start
```bash
# Build the Docker image
docker-compose build

# Start the container
docker-compose up -d

# View logs
docker-compose logs -f
```

### 3. Verify
```bash
# Check health
curl http://localhost:3000/health

# Expected output:
# {"status":"healthy","service":"mcp-csv-analysis-gemini","version":"1.0.0"}
```

## What's Included in the Docker Image

### Runtime Environment
- **Base**: Node.js 20 Alpine Linux
- **Python**: Python 3.x with pip
- **Chromium**: Headless browser for chart rendering (required by Kaleido)
- **Build Tools**: gcc, musl-dev (for compiling Python packages)
- **Fonts**: TrueType fonts for proper text rendering in charts

### Python Packages
- `plotly` - Chart rendering
- `kaleido` - Image export engine
- `pandas` - Data manipulation

### Application Files
- Compiled TypeScript (`dist/`)
- Python render script (`scripts/render_chart.py`)
- Node.js dependencies (production only)

### Directories
- `/app/output` - Mounted as volume for persistent storage
- Charts and analysis outputs saved here

## Docker Image Layers

```dockerfile
Stage 1: Builder (node:20-alpine)
├── Install Node.js dependencies
├── Copy source code
└── Compile TypeScript → dist/

Stage 2: Runtime (node:20-alpine)
├── Install Python 3 + build tools
├── Install Chromium + dependencies (for Kaleido)
├── Install wget for healthcheck
├── Copy production Node.js dependencies
├── Copy compiled code from Stage 1
├── Copy Python scripts and requirements
├── Install Python dependencies (plotly, kaleido, pandas)
├── Set environment variables (CHROME_BIN, CHROMIUM_PATH)
├── Create output directory
├── Set up non-root user (nodejs:nodejs)
└── Start server on port 3000
```

## Volumes

### Output Directory
```yaml
volumes:
  - ./output:/app/output
```

**Purpose**: Persist generated charts, analysis results, and thinking outputs

**Files Generated**:
- `chart_config_*.json` - Chart configurations
- `chart_*.png` - Rendered images
- `csv_analysis_*.txt` - Analysis results
- `gemini_thinking_*.txt` - Thinking outputs

## Environment Variables

### Required
- `GEMINI_API_KEY` - Your Google Gemini API key

### Optional
- `SUPABASE_URL` - Supabase project URL (for image uploads)
- `SUPABASE_KEY` - Supabase anon/service key (for image uploads)
- `NODE_ENV` - Set to `production` automatically
- `PORT` - Server port (default: 3000)

## Docker Commands

### Build
```bash
# Build the image
docker-compose build

# Build with no cache (fresh build)
docker-compose build --no-cache
```

### Start/Stop
```bash
# Start in detached mode
docker-compose up -d

# Start with logs
docker-compose up

# Stop
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Logs
```bash
# View logs
docker-compose logs

# Follow logs
docker-compose logs -f

# Tail last 100 lines
docker-compose logs --tail=100
```

### Shell Access
```bash
# Access container shell
docker-compose exec mcp-csv-analysis sh

# Check Python installation
docker-compose exec mcp-csv-analysis python3 --version

# List files
docker-compose exec mcp-csv-analysis ls -la /app
```

### Inspect
```bash
# View container details
docker-compose ps

# View resource usage
docker stats mcp-csv-analysis-server

# View image size
docker images mcp-csv-analysis-gemini
```

## Troubleshooting

### Python Script Not Found
**Error**: `Python render script not found at: /app/scripts/render_chart.py`

**Solution**: Rebuild the image to include the scripts directory
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Python Packages Missing
**Error**: `No module named 'plotly'`

**Solution**: Rebuild with fresh Python dependencies
```bash
docker-compose build --no-cache
```

### Permission Denied on Output Directory
**Error**: Cannot write to `/app/output`

**Solution**: Check volume mount permissions
```bash
# On host
chmod 755 output/

# Rebuild if needed
docker-compose down
docker-compose up -d
```

### Supabase Upload Fails
**Error**: Upload to Supabase fails

**Check**:
1. Environment variables set correctly in `.env`
2. Supabase credentials valid
3. Network connectivity from container

```bash
# Test from container
docker-compose exec mcp-csv-analysis wget -O- https://supabase.co
```

### Container Won't Start
**Check**:
1. `.env` file exists and has `GEMINI_API_KEY`
2. Port 3000 not already in use
3. Docker daemon running

```bash
# Check logs
docker-compose logs

# Check port usage
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows
```

## Health Check

The container includes an automatic health check:
- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Start Period**: 40 seconds
- **Retries**: 3

**Endpoint**: `http://localhost:3000/health`

```bash
# Check container health status
docker-compose ps

# Expected:
# NAME                        STATUS
# mcp-csv-analysis-server    Up (healthy)
```

## Resource Limits

To add resource limits, update `docker-compose.yml`:

```yaml
services:
  mcp-csv-analysis:
    # ... existing config ...
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
```

## Production Considerations

### Security
- ✅ Runs as non-root user (`nodejs:nodejs`)
- ✅ Multi-stage build (smaller final image)
- ✅ Production dependencies only
- ⚠️ Store secrets in `.env`, never in code
- ⚠️ Use secrets management in production (Docker secrets, Kubernetes secrets)

### Performance
- Python chart rendering: ~2-3 seconds per chart
- Consider scaling horizontally for high load
- Use Supabase CDN for faster image delivery

### Monitoring
```bash
# Container logs
docker-compose logs -f

# Resource usage
docker stats mcp-csv-analysis-server

# Health endpoint
watch -n 5 'curl -s http://localhost:3000/health | jq'
```

### Backup
```bash
# Backup output directory
tar -czf output-backup-$(date +%Y%m%d).tar.gz output/

# Backup environment
cp .env .env.backup
```

## Kubernetes Deployment

For Kubernetes, convert the Docker Compose to K8s manifests:

```bash
# Install kompose
curl -L https://github.com/kubernetes/kompose/releases/download/v1.31.2/kompose-linux-amd64 -o kompose
chmod +x kompose
sudo mv kompose /usr/local/bin/

# Convert
kompose convert -f docker-compose.yml
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: docker-compose build
      
      - name: Run tests
        run: |
          docker-compose up -d
          sleep 10
          curl -f http://localhost:3000/health || exit 1
          docker-compose down
```

## Summary

The Docker deployment:
- ✅ Includes Python and all dependencies
- ✅ Runs chart rendering inside container
- ✅ Supports Supabase uploads
- ✅ Persists outputs via volumes
- ✅ Auto-restarts on failure
- ✅ Health checks included
- ✅ Production-ready

**Next Steps**: Rebuild your container to apply the changes!

