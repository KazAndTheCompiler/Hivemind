#!/bin/bash
# Full Disk Encryption Setup - Project 27
# LUKS/dm-crypt for Linux disk encryption

echo "
╔════════════════════════════════════════════════════════════════╗
║     Full Disk Encryption Setup - Project 27                  ║
╚════════════════════════════════════════════════════════════════╝

UNDERSTANDING FDE:

Full Disk Encryption (FDE) encrypts your entire drive,
protecting data at rest from physical theft.

TYPES OF ENCRYPTION:

1. LUKS (Linux Unified Key Setup)
   - Standard for Linux
   - Multiple passwords support
   - Key slots for backup keys

2. BitLocker (Windows)
   - TPM chip integration
   - Recovery keys
   - Auto-unlock options

3. FileVault2 (macOS)
   - Built-in Apple encryption
   - Recovery key management

LUKS SETUP (New Installation):

# During Ubuntu installation:
# 1. Select 'Encrypt the new Ubuntu installation'
# 2. Create strong passphrase
# 3. SAVE RECOVERY KEY SAFELY

LUKS SETUP (Existing System):

# Check current setup
lsblk
sudo cryptsetup luksDump /dev/sda5

# Encrypt swap
sudo cryptsetup luksAddKey /dev/sda5
sudo sed -i '/swap/s/none/cryptswap1/' /etc/fstab

MANAGE LUKS:

# Add backup passphrase
sudo cryptsetup luksAddKey /dev/sda5

# Backup header (IMPORTANT!)
sudo cryptsetup luksHeaderBackup /dev/sda5 --header-backup-file /path/to/header.bak

# Change passphrase
sudo cryptsetup luksChangeKey /dev/sda5

# Add new keyslot
sudo cryptsetup luksAddKey /dev/sda5

TIPS FOR FDE:

1. USE STRONG PASSPHRASE
   - Minimum 20 characters
   - Mix of character types
   - memorable but hard to guess

2. BACKUP HEADER
   - Header corruption = total data loss
   - Store backup securely offline

3. ENABLE TPM + PIN (Windows)
   - Physical security + memorized PIN

4. CONSIDER SUSPEND INSTEAD OF HIBERNATE
   - Sleep keeps key in memory
   - Hibernate writes key to disk

SECURITY VS CONVENIENCE:

| Setting | Security | Convenience |
|---------|----------|-------------|
| No encryption | None | Max |
| FDE only | High | Medium |
| FDE + TPM | High | High |
| FDE + TPM + PIN | Max | Low |

THREATS FDE DOESN'T PROTECT:

[!] FDE does NOT protect against:
- Running system (data in use)
- Cold boot attacks (memory remanence)
- Keyloggers and malware
- Network attacks
- User error

AFTER ENCRYPTION:

# Verify encryption status
sudo cryptsetup -v isLuks /dev/sda5

# Check keyslots
sudo cryptsetup luksDump /dev/sda5 | grep -i key

# Monitor for tampering
# (Check header hash periodically)
"

# Check if cryptsetup is available
if command -v cryptsetup &> /dev/null; then
    echo -e \"\\n[+] cryptsetup installed\"
    cryptsetup --version
else
    echo -e \"\\n[!] cryptsetup not installed\"
fi
