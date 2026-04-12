# Project 17: Study how antivirus software works

## Overview

Educational guide on antivirus detection mechanisms.

## Detection Methods

1. **Signature Detection** - Hash matching
2. **Heuristic Analysis** - PE imports, entropy
3. **Behavioral Analysis** - Sandbox execution
4. **Reputation** - File hash databases

## Usage

```bash
cd 17-antivirus-study
python3 antivirus_study.py <file_to_scan>
```

## Key Concepts

| Concept | Purpose |
|---------|---------|
| Entropy | Detect packed/encrypted files |
| PE Headers | Identify Windows executables |
| Import Tables | Find suspicious API calls |
| YARA Rules | Pattern matching |

## Tools

- VirusTotal - Online hash scanner
- YARA - Pattern matching tool
- PEStudio - PE file analysis
- REMnux - Malware analysis VM
