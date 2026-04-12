# Project 27: Encrypt data with full disk encryption

## Overview

Guide to setting up Full Disk Encryption (FDE) using LUKS.

## Setup

```bash
cd 27-full-disk-encryption
./fde_setup.sh
```

## Types

| Type | Platform | Features |
|------|----------|----------|
| LUKS | Linux | Standard, multiple keys |
| BitLocker | Windows | TPM + PIN |
| FileVault | macOS | Built-in |

## Important

1. **Use strong passphrase** (20+ chars)
2. **Backup header** before any changes
3. **Store recovery key safely**

## FDE Protects Against

- Physical theft of drive
- Data at rest exposure

## FDE Does NOT Protect Against

- Running system access
- Cold boot attacks
- Malware/ransomware
