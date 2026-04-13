# Safety Boundaries

Every lab, tool, and module in SecDev Labs declares its safety posture. This is machine-readable metadata that drives CLI warnings, execution policies, and documentation.

## Safety Levels

| Level | Description | Example |
|-------|-------------|---------|
| `defensive` | Purely defensive, safe for general use | Firewall setup, IDS configuration |
| `analysis` | Analysis-only, no active exploitation | Digital forensics, malware analysis |
| `simulation` | Simulated attacks, safe in isolation | Phishing simulation, DDoS simulation |
| `dual-use` | Can be used offensively or defensively | Password cracker, network scanner |
| `restricted-research` | Requires strong context and oversight | Zero-day research, exploit development |
| `lab-only` | Only run in isolated lab environments | Honeypot, keylogger practice |
| `do-not-deploy` | Not for production deployment | Shellcode generator, rootkit analysis |

## Enforcement

- The `secdev run` command displays safety warnings before execution
- Restricted and lab-only packages require explicit environment flags for full execution
- The `secdev doctor` command audits safety metadata completeness
- Dual-use packages are clearly marked in `secdev list` and `secdev inventory`

## Guidelines

1. **Always declare the most restrictive boundary that still allows the educational goal**
2. **Never blur offensive and defensive boundaries** — each package has one clear posture
3. **Restricted research packages need explicit owner/maintainer metadata**
4. **Lab-only packages should include cleanup steps in metadata**
