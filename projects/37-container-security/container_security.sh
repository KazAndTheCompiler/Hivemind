#!/bin/bash
# Container Security Hardening - Project 37

echo "
╔════════════════════════════════════════════════════════════════╗
║     Container Security Hardening - Project 37                 ║
╚════════════════════════════════════════════════════════════════╝

CONTAINER SECURITY BASICS:

1. IMAGE SECURITY
   - Use minimal base images (alpine, distroless)
   - Scan for vulnerabilities (Trivy, Snyk)
   - Sign and verify images (Docker Content Trust)
   - Pin specific image versions/tags

2. RUNTIME SECURITY
   - Drop capabilities (--cap-drop=all)
   - Run as non-root (--user=1000:1000)
   - Read-only filesystem (--read-only)
   - No privileged mode (--privileged=false)
   - Resource limits (--memory, --cpu)

3. NETWORK SECURITY
   - Minimal port exposure
   - Network segmentation
   - Use custom networks
   - No host networking (--network=none)

4. SECCOMP & SE linux
   - Default seccomp profile
   - --security-opt=seccomp:profile.json
   - --security-opt=label:level:Label

SECURE DOCKERFILE EXAMPLE:

```dockerfile
# Use minimal base image
FROM alpine:3.18

# Add labels for metadata
LABEL maintainer=\"security@example.com\"
LABEL description=\"Secure container\"

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Install only necessary packages
RUN apk add --no-cache curl

# Copy application
COPY --chown=appuser:appgroup app .

# Switch to non-root user
USER appuser

# Set entrypoint
ENTRYPOINT [\"./app\"]
```

DOCKER COMPOSE SECURITY:

```yaml
services:
  web:
    image: nginx:alpine
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp:rw,noexec,nosuid
    user: '1000:1000'
    cap_drop:
      - ALL
    resources:
      limits:
        memory: 256M
        cpus: '0.5'
```

SECURITY SCANNING:

# Trivy - Vulnerability scanner
trivy image nginx:alpine

# Docker Bench Security
docker run -it --net host --cap-add SYS_ADMIN \\
    --pid host --privileged aquasec/docker-bench-security

# Check containers for threats
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \\
    wpscanteam/wpscan

COMMON VULNERABILITIES:

| Issue | Impact | Fix |
|-------|--------|-----|
| Running as root | Container breakout | USER directive |
| Privileged mode | Full host access | Remove --privileged |
| Host network | No isolation | Custom network |
| No resource limits | DoS attacks | Set --memory |
| Sensitive mounts | Data theft | Use volumes wisely |

CONTAINER ORCHESTRATION SECURITY (K8s):

1. RBAC - Role-based access control
2. Network Policies - Segment pods
3. Pod Security Policies - Restrict pod specs
4. Secrets - Encrypt sensitive data
5. Pod Security Context - Run securely

BEST PRACTICES CHECKLIST:

[ ] Minimal base image
[ ] No running as root
[ ] Dropped capabilities
[ ] Read-only filesystem
[ ] Resource limits set
[ ] No privileged mode
[ ] Minimal ports exposed
[ ] Image scanning in CI/CD
[ ] Signed images
[ ] Regular updates

"

# Demo check
echo -e \"\\n[*] Checking Docker installation...\"
if command -v docker &> /dev/null; then
    docker --version
    echo -e \"\\n[+] Docker installed\"
    echo -e \"\\n[*] Checking running containers...\"
    docker ps --format \"table {{.Names}}\\t{{.Image}}\\t{{.Status}}\" 2>/dev/null || echo \"Cannot access Docker\"
else
    echo \"[-] Docker not installed\"
fi