#!/bin/bash
# Container Security with Microservices - Project 67

echo "
╔════════════════════════════════════════════════════════════════╗
║     Container Security with Microservices - Project 67         ║
╚════════════════════════════════════════════════════════════════╝

MICROSERVICES SECURITY:

Each microservice is an attack surface.
Security must be built into every layer.

ZERO TRUST ARCHITECTURE:

# Never trust, always verify
# Every request must be authenticated
# Every connection must be encrypted
# Least privilege access

SERVICE MESH SECURITY:

ISTIO SECURITY:

# Enable mTLS in mesh
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
spec:
  mtls:
    mode: STRICT

# Authorization policy
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: product-access
spec:
  selector:
    matchLabels:
      app: product
  rules:
  - from:
    - source:
        principals: [\"cluster.local/ns/default/sa/frontend\"]
    to:
    - operation:
        methods: [\"GET\"]
        paths: [\"/api/products\"]

LINKERD SECURITY:

# Enable auto mTLS
l江苏省 install --set linkerd.io/mtls=witness

CONSUL SERVICE MESH:

# Enable Consul Connect
consul connect enable

# Intentions (zero trust)
consul intention create -allow frontend to product

SECURE SERVICE COMMUNICATION:

# mTLS (mutual TLS)
# Both sides verify each other
# Certificates issued by SPIFFE

# SPIFFE (Secure Production Identity Framework for Everyone)
# Standardized identity framework
# Workload certificates

SERVICE AUTHENTICATION:

# JWT tokens for service-to-service
# Token validation at each hop
# Short-lived tokens

# Example: Create JWT
# {
#   \"iss\": \"auth-service\",
#   \"sub\": \"product-service\",
#   \"aud\": \"internal\",
#   \"exp\": 1234567890
# }

CONTAINER SECURITY:

IMAGES:

# Use minimal base images
FROM alpine:3.18
# NOT: FROM ubuntu:latest

# Multi-stage builds
FROM golang AS builder
WORKDIR /src
COPY . .
RUN go build -o service

FROM alpine:3.18
COPY --from=builder /src/service /service
ENTRYPOINT [\"/service\"]

# No secrets in images
# No default passwords
# Scan for CVEs

RUNTIME:

# Non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Read-only filesystem
security-opt:
  read-only: true

# Drop capabilities
security_opt:
  seccomp: profile.json
cap_drop:
  - ALL

NETWORK POLICIES:

# Kubernetes network policies
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-isolation
spec:
  podSelector:
    matchLabels:
      tier: backend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          tier: frontend
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - podSelector:
        matchLabels:
          tier: database

SECRETS MANAGEMENT:

# Kubernetes secrets (base64 - NOT secure alone!)
# Use external secrets operators

# HashiCorp Vault
# External secret injection
# Dynamic secrets
# Automatic rotation

# AWS Secrets Manager
# Secrets Manager injection
# RDS automatic rotation

OBSERVABILITY:

# Mutual TLS enabled
# All communication traced
# Centralized logging
# Alert on anomalies

SECURITY CHECKLIST:

[ ] mTLS enabled for all services
[ ] Zero trust network policies
[ ] Images scanned for CVEs
[ ] No root user in containers
[ ] Read-only filesystem
[ ] Dropped capabilities
[ ] Secrets in vault, not env vars
[ ] Images signed and verified
[ ] Regular security audits
[ ] Incident response plan

TOOLS:

| Tool | Purpose |
|------|---------|
| Istio | Service mesh security |
| Linkerd | Lightweight service mesh |
| Consul | Service discovery + mesh |
| Vault | Secrets management |
| Falco | Runtime security |
| Aqua | Container security platform |

"

# Check for tools
echo -e \"\\n[*] Checking container security tools...\"
for tool in docker kubectl istio linkerd; do
    if command -v $tool &> /dev/null 2>&1; then
        echo \"[+] $tool installed\"
    else
        echo \"[-] $tool not found\"
    fi
done