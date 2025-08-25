# SsalgTen PowerShell Deployment Script
# Windows version of the deployment script

param(
    [Parameter(Position=0)]
    [ValidateSet('deploy', 'start', 'stop', 'restart', 'status', 'logs', 'update', 'cleanup', 'build')]
    [string]$Command = 'deploy',
    
    [Parameter(Position=1)]
    [string]$Service = ''
)

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$EnvFile = Join-Path $ProjectRoot ".env"
$DockerComposeFile = Join-Path $ProjectRoot "docker-compose.yml"

# Compose wrapper (prefer Docker Compose v2 plugin)
function Test-ComposeV2 {
    try { docker compose version | Out-Null; return $true } catch { return $false }
}

function Test-ComposeV1 {
    try { docker-compose --version | Out-Null; return $true } catch { return $false }
}

function Compose {
    param([Parameter(ValueFromRemainingArguments = $true)] [string[]]$Args)
    if (Test-ComposeV2) {
        & docker compose @Args
    } elseif (Test-ComposeV1) {
        & docker-compose @Args
    } else {
        throw "Docker Compose is not available. Please install Docker Desktop (with Compose plugin) or docker-compose."
    }
}

# Functions
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if Docker and Docker Compose are installed
function Test-Dependencies {
    Write-Info "Checking dependencies..."
    
    try {
        docker --version | Out-Null
    } catch {
        Write-Error "Docker is not installed or not in PATH. Please install Docker first."
        exit 1
    }
    
    if (-not (Test-ComposeV2) -and -not (Test-ComposeV1)) {
        Write-Error "Docker Compose is not installed or not in PATH. Please install Docker Desktop (Compose v2) or docker-compose."
        exit 1
    }
    
    Write-Success "Dependencies check passed"
}

# Check if environment file exists
function Test-Environment {
    Write-Info "Checking environment configuration..."
    
    if (-not (Test-Path $EnvFile)) {
        Write-Warning "Environment file not found. Creating from template..."
        Copy-Item (Join-Path $ProjectRoot ".env.example") $EnvFile
        Write-Warning "Please edit $EnvFile with your configuration before running again."
        exit 1
    }
    
    # Check for default values that should be changed
    $envContent = Get-Content $EnvFile -Raw
    
    if ($envContent -match "your_secure_database_password_here") {
        Write-Warning "Please update the default database password in $EnvFile"
        exit 1
    }
    
    if ($envContent -match "your-super-secret-jwt-key-change-this-in-production") {
        Write-Warning "Please update the default JWT secret in $EnvFile"
        exit 1
    }
    
    Write-Success "Environment configuration check passed"
}

# Build images
function Build-Images {
    Write-Info "Building Docker images..."
    
    Set-Location $ProjectRoot
    
    # Build all images
    Compose build --no-cache
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to build Docker images"
        exit 1
    }
    
    Write-Success "Docker images built successfully"
}

# Start services
function Start-Services {
    Write-Info "Starting SsalgTen services..."
    
    Set-Location $ProjectRoot
    
    # Start database first
    Write-Info "Starting database..."
    Compose up -d database redis
    
    # Wait for database to be ready
    Write-Info "Waiting for database to be ready..."
    Start-Sleep 30
    
    # Start backend
    Write-Info "Starting backend..."
    Compose up -d backend
    
    # Wait for backend to be ready
    Write-Info "Waiting for backend to be ready..."
    Start-Sleep 30
    
    # Start frontend
    Write-Info "Starting frontend..."
    Compose up -d frontend
    
    # Start agents
    Write-Info "Starting agents..."
    Compose up -d agent-nyc
    
    Write-Success "All services started successfully"
}

# Check service health
function Test-Health {
    Write-Info "Checking service health..."
    
    Set-Location $ProjectRoot
    
    try {
        $services = Compose ps --format json | ConvertFrom-Json
    } catch {
        Write-Warning "Compose JSON output not available. Showing textual status instead."
        Compose ps
        return
    }
    $healthyServices = $services | Where-Object { $_.Health -eq "healthy" }
    
    if ($healthyServices.Count -gt 0) {
        Write-Success "Services are healthy"
    } else {
        Write-Warning "Some services may not be healthy. Check with: docker compose ps"
    }
}

# Show service status
function Show-Status {
    Write-Info "Service status:"
    Set-Location $ProjectRoot
    Compose ps
    
    Write-Host ""
    Write-Info "Service URLs:"
    Write-Host "Frontend: http://localhost"
    Write-Host "Backend API: http://localhost:3001/api"
    Write-Host "Backend Health: http://localhost:3001/api/health"
    Write-Host "Agent NYC: http://localhost:3002/api/health"
}

# Stop services
function Stop-Services {
    Write-Info "Stopping SsalgTen services..."
    
    Set-Location $ProjectRoot
    Compose down
    
    Write-Success "Services stopped"
}

# Clean up (remove containers and volumes)
function Invoke-Cleanup {
    Write-Warning "This will remove all containers and volumes. Data will be lost!"
    $confirmation = Read-Host "Are you sure? (y/N)"
    
    if ($confirmation -eq 'y' -or $confirmation -eq 'Y') {
        Write-Info "Cleaning up..."
        Set-Location $ProjectRoot
        Compose down -v --remove-orphans
        docker system prune -f
        Write-Success "Cleanup completed"
    } else {
        Write-Info "Cleanup cancelled"
    }
}

# Update and restart services
function Update-Services {
    Write-Info "Updating SsalgTen services..."
    
    Set-Location $ProjectRoot
    
    # Pull latest images and rebuild
    Compose pull
    Compose build --no-cache
    
    # Restart services
    Compose up -d --force-recreate
    
    Write-Success "Services updated and restarted"
}

# Show logs
function Show-Logs {
    param([string]$ServiceName = '')
    
    Set-Location $ProjectRoot
    
    if ($ServiceName) {
        Write-Info "Showing logs for $ServiceName..."
        Compose logs -f $ServiceName
    } else {
        Write-Info "Showing logs for all services..."
        Compose logs -f
    }
}

# Main script logic
switch ($Command) {
    'deploy' {
        Test-Dependencies
        Test-Environment
        Build-Images
        Start-Services
        Test-Health
        Show-Status
    }
    'start' {
        Start-Services
        Show-Status
    }
    'stop' {
        Stop-Services
    }
    'restart' {
        Stop-Services
        Start-Services
        Show-Status
    }
    'status' {
        Show-Status
    }
    'logs' {
        Show-Logs $Service
    }
    'update' {
        Update-Services
    }
    'cleanup' {
        Invoke-Cleanup
    }
    'build' {
        Build-Images
    }
    default {
        Write-Host "Usage: .\deploy.ps1 {deploy|start|stop|restart|status|logs|update|cleanup|build} [service]"
        Write-Host ""
        Write-Host "Commands:"
        Write-Host "  deploy   - Full deployment (build images and start services)"
        Write-Host "  start    - Start all services"
        Write-Host "  stop     - Stop all services"
        Write-Host "  restart  - Restart all services"
        Write-Host "  status   - Show service status"
        Write-Host "  logs     - Show service logs (specify service name for specific service)"
        Write-Host "  update   - Update and restart services"
        Write-Host "  cleanup  - Remove all containers and volumes (WARNING: data loss)"
        Write-Host "  build    - Build Docker images only"
    }
}
