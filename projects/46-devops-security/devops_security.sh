#!/bin/bash
# DevOps Security Hardening - Project 46
# Security best practices for CI/CD and DevOps

echo "
╔════════════════════════════════════════════════════════════════╗
║     DevOps Security Hardening - Project 46                    ║
╚════════════════════════════════════════════════════════════════╝

SECURE CI/CD PIPELINE:

1. SOURCE CODE SECURITY
   - Scan code for secrets (gitrob, gitleaks)
   - Dependency scanning (Snyk, Dependabot)
   - Static analysis (SonarQube, Semgrep)
   - Code review requirements

2. BUILD SECURITY
   - Signed builds (SLSA framework)
   - Build isolation (containerized)
   - No build from untrusted sources
   - Reproducible builds

3. ARTIFACT SECURITY
   - Sign artifacts (cosign, in-toto)
   - Store in secure registry
   - Image scanning (Trivy, Clair)
   - Minimal base images

4. DEPLOYMENT SECURITY
   - Signed deployments
   - Secrets management (HashiCorp Vault)
   - Rollback capabilities
   - Deployment approval gates

SECRETS MANAGEMENT:

# DON'T store secrets in:
# - Git history (even removed!)
# - Docker images
# - Environment variables (in public repos)
# - CI/CD logs

# DO use:
# - HashiCorp Vault
# - AWS Secrets Manager
# - GCP Secret Manager
# - Azure Key Vault
# - Doppler
# - GitGuardian

SECRET SCANNING:

# Gitleaks - Scan git history
gitleaks detect --source . --report-format json

# GitRob - Find sensitive files
gitrob target-org

# TruffleHog - Find credentials in git
trufflehog filesystem ./path

# pre-commit hook
# .git/hooks/pre-commit
git secrets --scan

DOCKER SECURITY:

# Scan images
trivy image alpine:latest
syft alpine:latest -o cyclonedx-json

# Sign images
cosign sign --yes ghcr.io/org/image:tag

# Verify images
cosign verify ghcr.io/org/image:tag

KUBERNETES SECURITY:

# RBAC - Least privilege
kubectl get clusterrolebinding --all-namespaces

# Network policies
# Limit pod-to-pod communication

# Pod security
# Enforce restricted pod specs

# Secrets encryption
# Enable encryption at rest

SAST TOOLS:

| Tool | Language | Type |
|------|----------|------|
| Semgrep | Many | Pattern matching |
| Bandit | Python | Security issues |
| Gosec | Go | Security issues |
| ESLint | JavaScript | Security rules |
| SonarQube | Many | Full analysis |

DEPENDENCY SCANNING:

# npm
npm audit
snyk test

# pip
pip-audit
safety check

# Maven
mvn dependency:tree
 OWASP Dependency Check

SECURE DEPLOYMENT CHECKLIST:

[ ] Secrets not in git
[ ] Dependencies scanned
[ ] Images signed
[ ] Build reproducible
[ ] RBAC configured
[ ] Network policies applied
[ ] Secrets encrypted
[ ] Logs centralized
[ ] Monitoring enabled
[ ] Rollback tested

SUPPLY CHAIN SECURITY (SLSA):

SLSA Levels:
- Level 1: Provenance exists
- Level 2: Signed provenance
- Level 3: Hosted build service
- Level 4: Hardened build service

"

# Check for available tools
echo -e \"\\n[*] Checking DevOps tools...\"
for tool in docker kubectl trivy snyk; do
    if command -v $tool &> /dev/null; then
        echo \"[+] $tool installed\"
    else
        echo \"[-] $tool not found\"
    fi
done