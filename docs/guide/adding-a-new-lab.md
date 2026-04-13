# Adding a New Lab

## Quick Start

1. Create a directory under `packages/labs/`:
   ```
   mkdir packages/labs/my-new-lab
   ```

2. Create `package.json`:
   ```json
   {
     "name": "@secdev/lab-my-new-lab",
     "version": "0.1.0",
     "private": true,
     "description": "Description of the lab",
     "scripts": {
       "run": "python my_lab.py",
       "test": "echo 'No tests yet'"
     }
   }
   ```

3. Create `metadata.json`:
   ```json
   {
     "type": "lab",
     "id": "lab-my-new-lab",
     "title": "My New Lab",
     "summary": "Short description",
     "category": "network-security",
     "tags": ["tag1", "tag2"],
     "language": "python",
     "maturity": "experimental",
     "riskLevel": "low",
     "safetyBoundary": "lab-only",
     "prerequisites": [],
     "setupSteps": [],
     "expectedOutputs": [],
     "testStatus": "none",
     "docsPath": "/docs/labs/my-new-lab",
     "owner": "secdev-team",
     "maintainer": "secdev-team",
     "sourceLegacyPath": "projects/XX-folder-name",
     "walkthrough": [],
     "cleanupSteps": [],
     "estimatedDuration": "30m"
   }
   ```

4. Add your code files (Python, Shell, etc.)

5. Validate:
   ```bash
   secdev validate
   secdev info lab-my-new-lab
   ```

## Safety Boundaries

Choose the appropriate safety boundary:

| Boundary | When to use |
|----------|-------------|
| `defensive` | Purely defensive, safe for general use |
| `analysis` | Analysis-only, no active exploitation |
| `simulation` | Simulated attacks, safe in isolation |
| `dual-use` | Can be used offensively or defensively |
| `restricted-research` | Requires strong context and oversight |
| `lab-only` | Only run in isolated lab environments |
| `do-not-deploy` | Not for production deployment |

## Categories

Valid lab categories:
- `network-security`
- `malware-analysis`
- `cryptography`
- `web-security`
- `forensics`
- `social-engineering`
- `infrastructure`
- `exploit-development`
- `threat-intelligence`
- `identity-access`
- `iot-embedded`
- `cloud-devops`
- `research`
