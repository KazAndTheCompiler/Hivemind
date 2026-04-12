#!/usr/bin/env python3
"""
Rootkit Analysis Guide - Project 31
Understanding and detecting rootkits.

EDUCATIONAL USE ONLY. For understanding rootkit detection.
"""

def main():
    print("""
╔════════════════════════════════════════════════════════════════╗
║     Rootkit Analysis Guide - Project 31                       ║
╚════════════════════════════════════════════════════════════════╝

WHAT IS A ROOTKIT?

A rootkit is malware designed to provide persistent, stealthy
access to a computer while hiding its presence.

TYPES OF ROOTKITS:

| Type | Level | Examples |
|------|-------|----------|
| User-mode | Application | Keyloggers, trojanized binaries |
| Kernel-mode | OS Kernel | Loadable kernel modules |
| Bootkit | MBR/VBR | Master Boot Record infections |
| Firmware | UEFI/BIOS | Hardest to detect |
| Virtual | Hypervisor | Subverts entire OS |

USER-MODE ROOTKITS:

- Modify applications (ls, ps, netstat)
- Hook system calls
- Hide processes/files/connections
- Keyloggers, backdoors

KERNEL-MODE ROOTKITS:

- Load as kernel modules (Linux)
- Hook system calls at kernel level
- Modify kernel data structures
- Direct kernel object manipulation

BOOTKITS:

- Infect Master Boot Record (MBR)
- Execute before OS boots
- Evade OS-based detection
- Used by advanced attackers

DETECTION METHODS:

1. BEHAVIOR ANALYSIS
   - Unusual network traffic
   - Unexpected system behavior
   - Performance degradation
   
2. MEMORY FORENSICS
   - Volatility Framework
   - Cold boot attack
   - Memory dump analysis
   
3. INTEGRITY CHECKING
   - Compare against known-good files
   - Tripwire
   - AIDE (Advanced Intrusion Detection Environment)

4. BEHAVIOR-BASED
   - rkhunter (Linux)
   - chkrootkit (Linux)
   - GMER (Windows)

LINUX ROOTKIT DETECTION:

# Check for suspicious LKM (Loadable Kernel Modules)
lsmod
cat /proc/modules
grep -r "hide" /proc/modules

# Check system calls
strace -p <pid>

# Use rkhunter
sudo rkhunter --check

# Use chkrootkit
sudo chkrootkit

WINDOWS ROOTKIT DETECTION:

# System file checker
sfc /scannow

# Autoruns (Sysinternals)
autoruns.exe

# GMER
# - Rootkit detection
# - Service analysis
# - Registry analysis

RED HAT SYSTEM ANALYSIS:

# Check running services
systemctl list-units

# Check init scripts
ls -la /etc/init.d/

# Audit system calls
ausearch -k privilege_escalation

COMMON ROOTKIT TECHNIQUES:

1. PROCESS HIDING
   - Remove from process list
   - Hook fork/exec syscalls
   
2. FILE HIDING
   - Remove from directory listing
   - Hook getdents syscall
   
3. CONNECTION HIDING
   - Remove from netstat output
   - Hook /proc/net/tcp read
   
4. KEYLOGGER
   - Keyboard interrupt hooking
   - Keyboard buffer reading

FAMOUS ROOTKITS:

- Stuxnet (2010) - Iranian nuclear, USB + rootkit
- Flame (2012) - Middle East cyber-espionage
- Hidden Wasp (2019) - Linux/Ethereum theft
- TrickBot (2016+) - Banking trojan + rootkit

REMEDIATION:

1. IDENTIFY COMPROMISE
   - Unusual behavior
   - Security tool alerts
   
2. ISOLATE SYSTEM
   - Disconnect network
   - Preserve evidence
   
3. REBUILD FROM CLEAN SOURCE
   - Rootkits persist deep in system
   - Reinstall is often only sure fix
   
4. PATCH AND HARDEN
   - Update all software
   - Enable secure boot
   - Implement UEFI password

PREVENTION:

- Secure boot enabled
- Minimal installed software
- Regular security updates
- Strong passwords
- MFA on all accounts
- Application whitelisting
- Host-based intrusion detection

""")

if __name__ == "__main__":
    main()
