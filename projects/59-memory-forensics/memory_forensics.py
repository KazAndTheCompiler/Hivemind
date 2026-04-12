#!/usr/bin/env python3
"""
Memory Forensics Framework - Project 59
Analyze memory dumps for forensic evidence.

EDUCATIONAL USE ONLY. For authorized forensic investigations.
"""

import os
import sys
import struct

def main():
    print("""
╔════════════════════════════════════════════════════════════════╗
║     Memory Forensics Framework - Project 59                  ║
║                                                                ║
║     EDUCATIONAL USE ONLY                                       ║
║     Only analyze memory from systems you own/have permission   ║
╚════════════════════════════════════════════════════════════════╝

MEMORY FORENSICS OVERVIEW:

Memory analysis reveals:
- Running processes (including hidden)
- Active network connections
- Decrypted passwords
- Malware artifacts
- User activity at time of capture

ACQUIRING MEMORY:

# LiME (Linux Memory Extractor)
insmod lime.ko \"path=./mem.lime format=lime\"

# AVML (Azure VM Memory)
avml mem.lime

# WinPMEM (Windows)
winpmem_2.3.exe mem.raw

# macOS
sudo osascript -e 'do shell script \"lldb -K mem.snap\"'

VOLATILITY FRAMEWORK:

# Profile detection
vol -f mem.lime imageinfo

# Process analysis
vol -f mem.lime pslist           # List processes
vol -f mem.lime psscan           # Scan for hidden
vol -f mem.lime pstree           # Process tree
vol -f mem.lime dlllist          # Loaded DLLs

# Network analysis
vol -f mem.lime netscan          # Network connections
vol -f mem.lime connections      # Active connections
vol -f mem.lime sockscan        # Socket scan

# Registry analysis
vol -f mem.lime hivelist         # List hives
vol -f mem.lime printkey         # Key analysis
vol -f mem.lime userassist       # Userassist entries

# Malware detection
vol -f mem.lime malfind          # Find injected code
vol -f mem.lime yarascan         # YARA scanning
vol -f mem.lime apihooks         # API hooks

# Credential extraction
vol -f mem.lime hashdump         # SAM hashes
vol -f mem.lime lsadump          # LSA secrets
vol -f mem.lime mimikatz         # Cleartext passwords

MEMORY FORENSICS WORKFLOW:

1. ACQUIRE (use write blocker!)
2. Verify integrity (hash)
3. Profile identification
4. Process analysis (look for anomalies)
5. Network analysis (C2 connections)
6. Registry analysis (persistence)
7. File artifacts (what was accessed)
8. Malware analysis (memory resident)

COMMON ARTIFACTS:

| Artifact | What It Shows |
|----------|--------------|
| pslist | Running processes |
| netscan | Network connections |
| malfind | Injected code |
| dlllist | Loaded DLLs |
| cmdhist | Command history |
| consoles | Console output |
| envvar | Environment variables |
| timeliner | Timeline of events |

DETECTING ROOTKITS IN MEMORY:

# Check for hidden processes (psscan vs pslist)
vol -f mem.lime pslist > pslist.txt
vol -f mem.lime psscan > psscan.txt
diff pslist.txt psscan.txt

# Check for API hooks
vol -f mem.lime apihooks

# Check for hidden modules
vol -f mem.lime modscan

# Check for suspicious threads
vol -f mem.lime threads

MALWARE ANALYSIS IN MEMORY:

# Identify suspicious processes
vol -f mem.lime pslist | grep -E \"svchost|explorer|lsass\"

# Check process memory regions
vol -f mem.lime memmap -p <PID>

# Dump suspicious process
vol -f mem.lime procdump -p <PID> -D output/

# Scan with YARA
vol -f mem.lime yarascan -y malware.yar

RECOVERING ARTIFACTS:

# Browser history
vol -f mem.lime chromehistory

# Recent files
vol -f mem.lime recentfiles

# Clipboard contents
vol -f mem.lime clipboard

# Passwords (if in memory)
vol -f mem.lime mimikatz

WINDOWS MEMORY STRUCTURE:

# System process (PID 4)
# smss.exe (session manager)
# csrss.exe (client-server runtime)
# wininit.exe (Windows initialization)
# services.exe (Services control manager)
# lsass.exe (Local Security Authority)
# svchost.exe (Host processes)

# Key processes to examine:
- lsass.exe (credentials)
- explorer.exe (user activity)
- browser processes (history)

LINUX MEMORY STRUCTURE:

# PID 1 - init/systemd
# kernel threads
# user processes

# Key areas:
- /proc (process information)
- kernel structures
- network buffers
- userland memory

ANALYSIS PLATFORMS:

| Tool | OS | Features |
|------|-----|----------|
| Volatility 3 | Win/Linux/Mac | Open source, extensible |
| Rekall | Win/Linux | Cloud integration |
| Redline | Windows | Commercial (Mandiant) |
| AXIOM | Win/Mac | Magnet Forensics |

YARA IN MEMORY:

# Create malware YARA rule
rule RansomNote {
    strings:
        $s1 = \"Your files have been encrypted\" ascii
        $s2 = \".onion\" ascii
    condition:
        2 of them
}

# Scan memory
vol -f mem.lime yarascan -y ransomware.yar

FORENSIC REPORTING:

Document:
1. Memory acquisition (how, when, hash)
2. System information (OS, hostname)
3. Findings (processes, connections)
4. Timeline (events in order)
5. Indicators (IOCs)
6. Conclusions

SECURITY CHECKLIST:

[ ] Memory acquisition tool ready
[ ] Write blocker used
[ ] Hash verification documented
[ ] Volatility profile matched
[ ] All processes analyzed
[ ] Network connections checked
[ ] Persistence mechanisms identified
[ ] Malware analyzed with YARA
[ ] IOCs extracted and documented
[ ] Chain of custody maintained

TOOLS:

| Tool | Purpose |
|------|---------|
| Volatility 3 | Memory analysis |
| LiME | Linux acquisition |
| AVML | Cloud VM acquisition |
| WinPMEM | Windows acquisition |
| Rekall | Cloud forensics |
| FTK Imager | Memory imaging |
| Redline | Commercial analysis |

""")

if __name__ == "__main__":
    main()