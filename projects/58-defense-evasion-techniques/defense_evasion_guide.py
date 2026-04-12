#!/usr/bin/env python3
"""
Defense Evasion Techniques - Project 58
Understanding how adversaries evade detection.

EDUCATIONAL USE ONLY. For understanding detection mechanisms and improving defenses.
"""

import os
import sys

def main():
    print("""
╔════════════════════════════════════════════════════════════════╗
║     Defense Evasion Techniques - Project 58                   ║
║                                                                ║
║     EDUCATIONAL USE ONLY                                       ║
║     For understanding detection and improving defenses        ║
╚════════════════════════════════════════════════════════════════╝

WHY STUDY EVASION?

To DEFEND, you must understand OFFENSE:
- Know common techniques
- Identify detection gaps
- Build better controls
- Test your defenses

MITRE ATT&CK DEFENSE EVASION (TA0005):

COMMON TECHNIQUES:

T1070 - Indicator Removal
  └─ Delete evidence: logs, files, events
  
T1027 - Obfuscated Files or Information
  └─ Encrypt payloads, XOR encoding, base64
  
T1036 - Masquerading
  └─ Rename malware as system files
  
T1036.004 - Rootkit
  └─ Hide processes, files, connections
  
T1054 - Indicator Blocking
  └─ Prevent event log collection
  
T1068 - Exploitation for Privilege Escalation
  └─ Use exploits to bypass restrictions
  
T1099 - Timestomp
  └─ Modify file timestamps

EVASION TECHNIQUES BY CATEGORY:

1. FILE-BASED EVASION

   # Rename system files
   copy malware.exe C:\\\\Windows\\\\System32\\\\svchost.exe
   
   # Masquerade as Windows update
   rename malware.exe windows-update.exe
   
   # Double extension
   document.pdf.exe (if hide extensions disabled)

2. PROCESS EVESION

   # Process injection
   - Inject into legitimate process (explorer.exe)
   - Use process hollowing
   - APC queue injection
   
   # Parent process spoofing
   - Spawn from legitimate parent (svchost)
   - Use PPID spoofing

3. NETWORK-BASED EVASION

   # Port hopping
   - Tunnel through port 443 (HTTPS)
   - DNS tunneling
   - ICMP tunneling
   
   # Domain fronting
   - Use CDN to mask C2 (apex.cloudfront.net)
   - Fronted domains look like legitimate CDN
   
   # Slow beaconing
   - C2 communication every 24 hours
   - Jitter to avoid pattern detection

4. LOGGING BYPASS

   # Clear logs
   wevtutil cl System
   wevtutil cl Security
   
   # Disable logging
   reg add \"HKLM\\\\SYSTEM\\\\CurrentControlSet\\\\Services\\\\EventLog\" /v Start /t REG_DWORD /d 4
   
   # Modify timestamps (timestomp)
   powershell Set-ItemProperty -Path file.exe -Name LastWriteTime -Value \"01/01/2000\"

5. ENCRYPTION/ENCODING

   # XOR with key
   data XOR key = encrypted
   
   # Custom encryption (not AES-standard)
   
   # Base64 multiple rounds
   
   # Polymorphic (changes per victim)

6. ANTI-ANALYSIS

   # Detect VM/sandbox
   if (isVirtualBox() || isVMware()) exit();
   
   # Check for debugger
   if (IsDebuggerPresent()) exit();
   
   # Timing checks
   sleep(1000 * 60 * 10)  # Delay execution
   if (elapsed < threshold) exit();

DETECTION OPPORTUNITIES:

| Evasion | Detection | Gap |
|---------|-----------|-----|
| Renamed binary | File integrity monitoring | No hash baseline |
| Process injection | EDR with behavior detection | Signature only |
| Log clearing | SIEM alert on clear event | Not monitored |
| Network tunneling | NDR for DNS exfil | DNS not monitored |
| VM detection | Analyze samples in bare metal | Forensics only |

DEFENSIVE MEASURES:

1. FILE INTEGRITY MONITORING
   - CIS benchmarks baseline
   - AIDE, OSSEC, Wazuh
   - Alert on unexpected changes

2. ENDPOINT DETECTION
   - EDR with behavior analytics
   - CrowdStrike, Carbon Black, SentinelOne
   - Not just signature-based

3. LOGGING ENHANCEMENT
   - Enable PowerShell script block logging
   - Enable Windows Security event logging
   - Forward to SIEM

4. NETWORK DETECTION
   - Deep packet inspection
   - DNS monitoring for tunneling
   - SSL/TLS inspection
   - Netflow analysis for beaconing

5. MEMORY PROTECTION
   - Enable Windows Defender Credential Guard
   - Enable HVCI (Hypervisor-protected code integrity)
   - Control flow guard (CFG)

SECURITY CHECKLIST:

[ ] File integrity monitoring enabled
[ ] EDR with behavior detection deployed
[ ] Logging forwarded to SIEM
[ ] Network monitoring for tunneling
[ ] PowerShell logging enabled
[ ] Windows Defender credential guard
[ ] HVCI/code integrity enabled
[ ] Regular purple team exercises
[ ] Table-top exercises for evasion scenarios

PURPLE TEAM EXERCISES:

1. Red team uses evasion techniques
2. Blue team detects (or misses)
3. Document gaps
4. Improve detection rules
5. Re-test

COMMON DETECTION RULES (SIGMA):

# Detect log clearing
title: Windows Event Log Cleared
logsource:
  product: windows
  service: application
detection:
  selection:
    EventID: 1102
  condition: selection

# Detect timestomp
title: File Timestomp
logsource:
  product: windows
detection:
  selection:
    Image|endswith: 'cmd.exe'
    CommandLine|contains: 'Set-ItemProperty'
  filter:
    CommandLine|contains: LastWriteTime

# Detect suspicious service
title: Suspicious Service Creation
logsource:
  product: windows
  service: system
detection:
  selection:
    EventID: 7045
    ImagePath|contains:
      - 'temp'
      - 'appdata'
  condition: selection

""")

if __name__ == "__main__":
    main()