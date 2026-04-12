# Project 6: Create a personal cybersecurity lab at home

## Overview

A comprehensive guide and setup script for building a home cybersecurity research lab. The lab provides an isolated environment for practicing security techniques safely and legally.

## What You Need

### Minimum Requirements
- Computer with 8GB+ RAM (16GB recommended)
- 100GB+ free disk space
- Second network interface or VLAN capability
- Linux (Ubuntu/Debian recommended)

### Recommended Additions
- Virtualization software (KVM, VirtualBox, or VMware)
- Old hardware for dedicated targets
- Separate network switch for lab isolation

## Lab Architecture

```
Internet
    |
[Router/Gateway]
    |
    +--- Main Network (192.168.1.0/24) --- Home devices
    |
    +--- Lab Network (192.168.100.0/24) --- Security lab
              |
              +--- Attacker (your machine)
              +--- Target VMs (DVWA, Metasploitable, etc.)
              +--- Isolated analysis environment
```

## Quick Start

```bash
cd 06-home-lab

# Run automated setup
chmod +x setup-lab.sh
./setup-lab.sh

# Or manual setup:
mkdir -p ~/security-lab/{vms,samples,tools,notes,targets}
```

## What Gets Set Up

### 1. Network Isolation
- Dedicated bridge network for lab
- NAT configuration for controlled internet access
- Firewall rules to prevent lab-to-main network access

### 2. Security Tools
- **Network Analysis**: tcpdump, wireshark, nmap
- **Web Testing**: nikto, dirb, sqlmap
- **Password Attacks**: john, hashcat, hydra
- **Forensics**: binwalk, foremost, strings
- **Python Libraries**: scapy, requests, beautifulsoup4

### 3. Target Systems
- Vulnerable web application scaffold
- Practice target documentation
- Safe testing guidelines

### 4. Documentation
- Complete lab README
- Research log template
- Directory structure

## Directory Structure

```
security-lab/
├── README.md           # This file
├── setup-lab.sh       # Automated setup script
├── vms/              # Virtual machine images
├── samples/          # Malware samples (encrypted)
├── tools/            # Security tools and scripts
├── notes/            # Research notes and findings
│   └── research-log.md
└── targets/          # Deliberately vulnerable systems
    ├── vulnerable-app/
    └── README.md
```

## Safety Rules

### CRITICAL - Follow These at ALL Times

1. **Network Isolation**
   - Lab network must NOT route to main/home network
   - Use separate physical switch OR VLAN isolation
   - Double-check firewall rules before each session

2. **No Internet Exposure**
   - Vulnerable targets are for LOCAL testing only
   - Use NAT, not Bridged networking for VMs
   - Block all inbound connections to lab network

3. **Legal Compliance**
   - Only test systems you own
   - Only test systems with explicit written permission
   - Document all authorizations

4. **Safe Handling**
   - Never open suspicious files on main system
   - Use malware analysis VM for unknowns
   - Keep samples encrypted when not in use

## Practice Targets

| Target | Purpose | Download |
|--------|---------|----------|
| DVWA | Web vulnerabilities | dvwa.co.uk |
| Metasploitable | General exploitation | sourceforge.net/projects/metasploitable |
| OWASP WebGoat | Web app pentesting | owasp.org/www-project-webgoat |
| VulnHub VMs | Various vulnerabilities | vulnhub.com |

## Lab Expansion Ideas

- **Memory Analysis**: Add RAM capture and volatility
- **Malware Sandbox**: Isolated VM for analyzing suspicious files
- **Network IDS**: Set up Snort or Suricata
- **Logging System**: ELK stack for log analysis
- **VPN**: Secure remote access to lab

## Common Mistakes to Avoid

1. **Bridged Networking** - Accidentally exposing VMs to main network
2. **No Documentation** - Forgetting what you did and why
3. **Single VM for Everything** - Mixing malware analysis with testing
4. **Skipping Updates** - Outdated tools miss vulnerabilities
5. **Testing in Production** - Always use dedicated lab systems

## Session Checklist

Before each lab session:
- [ ] Verify lab network is isolated
- [ ] Check firewall rules
- [ ] Document objective for session
- [ ] Back up any important findings
- [ ] Start from known-clean state

After each lab session:
- [ ] Document all findings
- [ ] Clean up any malware samples
- [ ] Update tools and VMs
- [ ] Secure lab when not in use
