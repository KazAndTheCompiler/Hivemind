#!/bin/bash
# Embedded Systems Security - Project 57

echo "
╔════════════════════════════════════════════════════════════════╗
║     Embedded Systems Security - Project 57                   ║
╚════════════════════════════════════════════════════════════════╝

EMBEDDED SECURITY CHALLENGES:

- Limited compute resources (no heavy crypto)
- Often no OS updates
- Physical exposure
- Factory default credentials
- Unencrypted communications

COMMON VULNERABILITIES:

| Issue | Risk | Mitigation |
|-------|------|-------------|
| Default passwords | Full control | Change on first boot |
| UART/JTAG exposed | Firmware extraction | Disable in production |
| No OTA updates | Exploits unpatched | Secure update mechanism |
| Plain text comms | Data interception | TLS/mTLS |
| No secure boot | Rootkits | Signed firmware |

FIRMWARE SECURITY:

# Firmware extraction
## UART/JTAG access
# 1. Identify UART pins (TX, RX, GND)
# 2. Connect at 115200 baud
# 3. Interrupt boot to get shell

## SPI flash extraction
# 1. Remove SPI chip
# 2. Read with flashrom
flashrom -r firmware.bin -c MX25L6406E

# Binwalk for analysis
binwalk -e firmware.bin
binwalk -A firmware.bin  # Entropy analysis

FIRMWARE ANALYSIS:

# Extract filesystem
cd _firmware.extracted
find . -type f -name \"*.conf\" -o -name \"*.pem\" -o -name \"*.key\"

# Analyze binaries
strings firmware.bin | grep -i password
strings firmware.bin | grep -i http

# Firmwalker script
./firmwalker.sh firmware.bin output/

REVERSING EMBEDDED BINARIES:

# Identify architecture
file binary
readelf -h binary | grep Machine

# Common: MIPS, ARM, PowerPC, x86

# Cross-compile binutils
apt install binutils-mips-linux-gnu
mips-linux-gnu-objdump -d binary > disassembly.txt

SECURE BOOT FOR EMBEDDED:

1. ROM Bootloader (immutable)
2. Signed first-stage loader
3. Public key in eFuse/OTP
4. Chain of trust to application

OTA (Over-The-Air) UPDATES:

# Secure update process
1. Server signs firmware with private key
2. Device has public key embedded
3. Device verifies signature before flash
4. Atomic update with rollback capability

# Delta updates (bandwidth efficient)
# Minimal bootloader for recovery

CRYPTOGRAPHIC ACCELERATORS:

# Many MCUs have crypto blocks
# Use hardware AES/SHA when available

# Example: STM32
HAL_CRYP_Encrypt(&hcryp, plaintext, 16, key);

MEMORY SAFETY:

# Stack canaries
# -fstack-protector

# No dynamic allocation (reduce heap attacks)
# Static analysis with Astrée

NETWORK SECURITY:

# TLS for all comms
# mTLS for device-to-device

# Use lightweight crypto
# - AES-128 (not AES-256 for speed)
# - ChaCha20-Poly1305
# - Ed25519 for signatures

SECURE STORAGE:

# eFuse/OTP for keys (one-time programmable)
# Cannot read back after lock!

# Encrypted flash regions
# TPM-like secure element

COMMON EMBEDDED PLATFORMS:

| Platform | Security Features |
|----------|-------------------|
| ESP32 | Secure boot, flash encryption |
| STM32 | TrustZone, secure OTP |
| Raspberry Pi | Secure boot (with TPM) |
| Arduino | Limited - use secure modules |

SECURITY CHECKLIST:

[ ] Change default credentials
[ ] Disable debug interfaces (UART/JTAG)
[ ] Enable secure boot
[ ] Sign all firmware updates
[ ] Use TLS for all network comms
[ ] Secure key storage (eFuse/secure element)
[ ] Encrypt firmware storage
[ ] Implement anti-rollback
[ ] Add hardware watchdog (detect lockup)
[ ] Consider secure element/TPM

FIRMWARE ANALYSIS TOOLS:

| Tool | Purpose |
|------|---------|
| binwalk | Firmware extraction |
| firmware-mod-kit | Extractor toolkit |
| FirmWalker | Security scanner |
| FirmAE | Firmware emulation |
|angr | Binary analysis |
| Ghidra | Disassembler (ARM/MIPS) |

PHYSICAL SECURITY:

1. Encapsulation ( epoxy potting)
2. Tamper detection (mesh, switches)
3. Zeroize on tamper (memory wipe)
4. Shielding (EMI protection)
5. Secure enclosures

ANALYSIS ENVIRONMENTS:

# QEMU for emulation
qemu-system-arm -M vexpress-a9 -kernel zImage -dtb dts.dtb

# FirmAE (Firmware Analysis and Emulation)
./run.sh openwrt.bin

# Attify伞 (firmware analysis Docker)
docker run -it attify/firmware-analysis

"

# Check for tools
echo -e \"\\n[*] Checking embedded tools...\"
for tool in binwalk stlink openocd; do
    if command -v $tool &> /dev/null 2>&1; then
        echo \"[+] $tool installed\"
    else
        echo \"[-] $tool not found\"
    fi
done