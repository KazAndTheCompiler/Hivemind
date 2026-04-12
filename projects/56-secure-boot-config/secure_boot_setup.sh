#!/bin/bash
# Secure Boot Configuration - Project 56

echo "
╔════════════════════════════════════════════════════════════════╗
║     Secure Boot Configuration - Project 56                    ║
╚════════════════════════════════════════════════════════════════╝

SECURE BOOT OVERVIEW:

Secure Boot is a UEFI feature that ensures only signed
bootloaders and OS kernels can execute during boot.

HOW SECURE BOOT WORKS:

1. Platform trust starts with hardware (root of trust)
2. UEFI firmware contains trusted certificates
3. Bootloader must be signed by trusted certificate
4. Kernel loaded must be signed
5. Boot chain continues with dm-verity, IMA, etc.

KEY COMPONENTS:

| Component | Purpose |
|-----------|---------|
| Platform Key (PK) | Top-level key, sets policy |
| Key Exchange Key (KEK) | Access to database updates |
| DB (Signature Database) | Allowed signatures/keys |
| DBX (Forbidden Database) | Revoked signatures/keys |
| VarStore | NVRAM for keys and signatures |

VERIFYING SECURE BOOT:

# Linux
mokutil --sb-state
# Expected: SecureBoot enabled

# Windows
bcdedit /enum all | findstr /C:\"secureboot\"

CHECK SIGNATURES:

# Check kernel signature
sbverify --chain kernel.efi.signed

# Check signatures in UEFI
certsigcheck file.efi

SIGNING KERNELS:

# Sign kernel for Secure Boot
sbsign --key MOK.priv --cert MOK.pem --output vmlinuz.signed vmlinuz

# Sign bootloader
sbkeysign --key MOK.priv --cert MOK.pem --output grubx64.signed grubx64.efi

CREATING MOK (Machine Owner Keys):

# Generate keys
openssl req -new -x509 -newkey rsa:4096 -keyout MOK.priv \\
    -out MOK.pem -days 3650 -subj \"/CN=My Machine/\"
openssl x509 -in MOK.pem -out MOK.der -outform DER

# Enroll key (one-time via MokManager)
mokutil --import MOK.der
# Reboot, enter MOKManager, confirm import

GRUB SECURITY:

# Verify GRUB signature
grub2-emu --sbat grub.cfg

# Check bootloader signed
ls -la /boot/efi/EFI/*/grubx64.efi

KERNEL SECURITY FEATURES:

# Enable lockdown mode (confidential computing)
cat /proc/sys/kernel lockdown
# Values: none, integrity, confidentiality

# Enable module signature enforcement
echo 1 > /sys/module/module/parameters/sig_enforce

# dm-verity for root integrity
# mount -o verity root-device /mnt

IMA (Integrity Measurement Architecture):

# Enable IMA
echo 1 > /sys/kernel/security/ima/tlv_enabled

# Measure all executables
echo > /sys/kernel/security/ima/policy

SECURE BOOT BEST PRACTICES:

1. ENABLE SECURE BOOT
   - Keep it enabled in UEFI
   - Don't disable for convenience

2. USE LINUX DISTRO KEYS
   - Ubuntu, Fedora keys enrolled
   - Add your own MOK for custom kernels

3. KEEP KEYS SECURE
   - Backup MOK.priv safely
   - Hardware security module recommended

4. UPDATE DBX REGULARLY
   - Intel & AMD publish revocations
   - UEFI updates include DBX updates

5. MONITOR BOOT WARNINGS
   - Any boot warning could indicate compromise

TROUBLESHOOTING:

# If boot fails after enabling:
# 1. Check if OS supports Secure Boot
# 2. Verify kernel is signed
# 3. Check DBX for inadvertently blocked key

# Disable temporarily (not recommended)
# bcdedit /set secureboot off  (Windows)

SECURE BOOT IN KUBERNETES:

# UEFI secure boot for K8s nodes
# Enable in BIOS/UEFI
# Use signed kernel
# Enable dm-verity for container images

SECURITY CHECKLIST:

[ ] Secure Boot enabled in UEFI
[ ] Platform Key installed
[ ] Signature Database configured
[ ] Forbidden Database (DBX) updated
[ ] All bootloaders signed
[ ] Kernel signed and verified
[ ] IMA measuring integrity
[ ] dm-verity for root filesystem
[ ] Lockdown mode enabled
[ ] Boot logging configured

"

# Check status
echo -e \"\\n[*] Checking Secure Boot status...\"
if command -v mokutil &> /dev/null; then
    mokutil --sb-state 2>/dev/null || echo \"Not available in VM\"
else
    echo \"mokutil not installed\"
fi