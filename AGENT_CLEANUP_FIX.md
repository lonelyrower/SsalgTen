# Agent Cleanup Fix - Deployment Script Safety Update

## 🎯 Problem Summary
The deployment script `scripts/ssalgten.sh` was deleting `ssalgten-agent` containers during cleanup, which is **incorrect** because:

1. **ssalgten-agent is NOT part of the main deployment** - it's a separate Looking Glass-style agent
2. **Agents run on remote VPS servers** - they connect back to the main server API
3. **Main server only runs**: database, redis, backend, frontend, updater
4. **Script was deleting other VPS's agent containers** when run on shared infrastructure

## 🔧 Changes Made

### 1. **scripts/ssalgten.sh** - Removed Agent from Cleanup Loops

#### Location 1: 镜像模式 Deployment (Line ~4232)
**Before:**
```bash
# 2. 强制删除所有可能的容器
for container in ssalgten-database ssalgten-postgres ssalgten-redis ssalgten-backend ssalgten-frontend ssalgten-agent ssalgten-updater; do
    docker rm -f "$container" >/dev/null 2>&1 || true
done
```

**After:**
```bash
# 2. 强制删除所有可能的容器（不包括 agent，agent 在其他 VPS 上运行）
for container in ssalgten-database ssalgten-postgres ssalgten-redis ssalgten-backend ssalgten-frontend ssalgten-updater; do
    docker rm -f "$container" >/dev/null 2>&1 || true
done
```

#### Location 2: 源码模式 Deployment (Line ~4298)
**Before:**
```bash
# 2. 强制删除所有可能的容器
for container in ssalgten-database ssalgten-postgres ssalgten-redis ssalgten-backend ssalgten-frontend ssalgten-agent ssalgten-updater; do
    docker rm -f "$container" >/dev/null 2>&1 || true
done
```

**After:**
```bash
# 2. 强制删除所有可能的容器（不包括 agent，agent 在其他 VPS 上运行）
for container in ssalgten-database ssalgten-postgres ssalgten-redis ssalgten-backend ssalgten-frontend ssalgten-updater; do
    docker rm -f "$container" >/dev/null 2>&1 || true
done
```

#### Location 3: Uninstall Function (Already Fixed)
- `ssalgten-agent` already removed from uninstall cleanup
- Only deletes main deployment containers

### 2. **docker-compose.ghcr.yml** - Commented Out Agent Service

**Lines 141-162**: Agent service fully commented out with explanation:
```yaml
  # agent:
  #   # 注意：Agent 服务仅用于测试，生产环境应在其他VPS单独部署
  #   image: ${IMAGE_REGISTRY}/${IMAGE_NAMESPACE}/ssalgten-agent:${IMAGE_TAG}
  #   container_name: ssalgten-agent
  #   # ... (entire service definition commented)
```

## 🏗️ Architecture Clarification

### Main Server Deployment
**Services**: database, redis, backend, frontend, updater
- Runs on primary VPS
- Provides API and web interface
- Generates agent installation scripts

### Agent Deployment (Separate)
**Services**: ssalgten-agent
- Runs on **other VPS servers**
- Installed via separate installation script
- Connects back to main server API
- **NOT part of main deployment**

## ✅ Verification

### Containers that WILL be deleted during deployment:
- `ssalgten-database` (or `ssalgten-postgres`)
- `ssalgten-redis`
- `ssalgten-backend`
- `ssalgten-frontend`
- `ssalgten-updater`

### Containers that will NOT be touched:
- `ssalgten-agent` ✅
- Any other Docker containers from other projects ✅

## 🧪 Testing Checklist

- [ ] Deploy main server - verify agent containers are NOT deleted
- [ ] Run uninstall - verify agent containers are NOT deleted
- [ ] Verify main services deploy correctly
- [ ] Verify port conflicts are resolved
- [ ] Check that other projects' containers remain untouched

## 📝 Related Files Modified

1. `scripts/ssalgten.sh` (3 locations updated)
   - Line ~4232: 镜像模式 deployment cleanup
   - Line ~4298: 源码模式 deployment cleanup
   - Line ~4000: Uninstall function (already fixed previously)

2. `docker-compose.ghcr.yml`
   - Lines 141-162: Agent service commented out

## 🚀 Next Steps

1. **Test deployment** on development environment
2. **Commit changes** to Git with message: "fix: remove ssalgten-agent from deployment cleanup - agent is separate service"
3. **Push to GitHub**
4. **Notify users** who may have agents running on shared infrastructure

## ⚠️ Important Notes

- **DO NOT** uncomment agent service in `docker-compose.ghcr.yml` for production
- **Agent installation** should use separate script: `scripts/install-agent.sh`
- **Main server script** should NEVER manage agent containers
- **Agents are independent** - they can be installed/removed separately from main deployment

---

**Generated:** 2025-01-XX  
**Issue:** Deployment script deleting agent containers on remote VPS  
**Resolution:** Removed ssalgten-agent from all deployment cleanup loops  
**Impact:** Main server deployment now safe to run on shared infrastructure
