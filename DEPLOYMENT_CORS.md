# CORS Configuration Guide

## Overview

SsalgTen automatically handles CORS (Cross-Origin Resource Sharing) configuration based on your deployment environment. This guide explains how to configure CORS for different deployment scenarios.

## Automatic Configuration

### Development Environment
- **When**: `NODE_ENV != "production"` or `NODE_ENV` is unset
- **Default**: `CORS_ORIGIN="*"` (allows all origins)
- **Suitable for**: Local development, testing

### Production Environment  
- **When**: `NODE_ENV="production"`
- **Default behavior (when CORS_ORIGIN is unset)**:
  - Allow all HTTPS origins
  - Allow localhost/127.0.0.1
  - Allow private networks (10.x, 192.168.x, 172.16–31.x)
- **Notes**: `FRONTEND_URL` and `DOMAIN` are also honored as allowed origins if provided (domain-only values are auto-expanded to http/https variants)
- **Suitable for**: HTTPS-first deployments; avoids 500 errors on unknown origins by omitting CORS headers instead of throwing

## Manual Configuration

You can refine behavior via environment variables:
- `CORS_ORIGIN`: primary allowlist (supports multiple separators and wildcards)
- `FRONTEND_URL`: additional frontend URL to allow
- `DOMAIN`: domain name; domain-only is accepted and expanded to http/https

Examples:

### Single Origin
```bash
CORS_ORIGIN=https://yourdomain.com
```

### Multiple Origins (comma-separated)
```bash
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com,http://localhost:3000
```

### Wildcard Patterns

#### Domain Wildcards
```bash
CORS_ORIGIN=*.yourdomain.com              # All subdomains
CORS_ORIGIN=https://*.yourdomain.com      # HTTPS subdomains only
```

#### Protocol Wildcards  
```bash
CORS_ORIGIN=https://*                     # All HTTPS domains
CORS_ORIGIN=http://*                      # All HTTP domains (not recommended for production)
```

#### Mixed Patterns
```bash
CORS_ORIGIN=https://*.yourdomain.com,https://anotherdomain.com,http://localhost:3000
```

## Common Deployment Scenarios

### Docker with Custom Domain
```bash
# In your .env file:
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com,https://*.yourdomain.com
```

### Docker with Multiple Domains
```bash
NODE_ENV=production  
CORS_ORIGIN=https://domain1.com,https://domain2.com,https://*.yourdomain.com
```

### Development with Custom Domain
```bash
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000,https://dev.yourdomain.com
```

### Maximum Security (Specific Origins Only)
```bash
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
```

### Maximum Flexibility (All HTTPS - Recommended for most production deployments)
```bash
NODE_ENV=production
# Leave CORS_ORIGIN unset - will default to https://* + localhost
```

## Troubleshooting

### Problem: Login returns 500 error on custom domain
**Cause**: CORS blocking the request from your domain
**Solution**: Add your domain to CORS_ORIGIN:
```bash
CORS_ORIGIN=https://yourdomain.com,https://*.yourdomain.com
```

### Problem: Works on localhost but not on domain
**Cause**: Production environment blocking non-localhost origins  
**Solution**: Configure CORS_ORIGIN for your domain or use the automatic HTTPS wildcard

### Problem: Mixed HTTP/HTTPS issues
**Cause**: Browser security blocking mixed content
**Solution**: Use HTTPS for both frontend and backend, configure CORS accordingly

## Security Notes

- **Never use `CORS_ORIGIN=*` in production** with `credentials: true`
- **Always use HTTPS** for production deployments
- **Be specific** with origins when possible for better security
- **Test thoroughly** after changing CORS configuration

## Examples by Use Case

### Personal Project (Single Domain)
```bash
NODE_ENV=production
CORS_ORIGIN=https://myproject.com
```

### SaaS Platform (Multiple Customer Domains)  
```bash
NODE_ENV=production
CORS_ORIGIN=https://*
```

### Corporate (Specific Subdomains)
```bash
NODE_ENV=production
CORS_ORIGIN=https://*.company.com,https://company.com
```

### Development/Staging Mix
```bash
NODE_ENV=production
CORS_ORIGIN=https://staging.company.com,https://dev.company.com,http://localhost:3000
```
