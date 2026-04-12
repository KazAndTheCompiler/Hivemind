#!/bin/bash
# Home Cybersecurity Lab Setup - Project 6
# Sets up a personal security research environment

set -e

echo "
╔═══════════════════════════════════════════════════════╗
║     Home Cybersecurity Lab Setup - Project 6        ║
╚═══════════════════════════════════════════════════════╝
"

# Configuration
LAB_DIR="${LAB_DIR:-$HOME/security-lab}"
VM_BRIDGE="${VM_BRIDGE:-virbr0}"
ISOLATED_NETWORK="192.168.100.0/24"

echo "[*] Setting up lab at: $LAB_DIR"
mkdir -p "$LAB_DIR"/{{vms,samples,tools,notes,targets}

# Check for virtualization support
check_virtualization() {
    echo ""
    echo "[*] Checking virtualization support..."
    
    if grep -E '(vmx|svm)' /proc/cpuinfo > /dev/null 2>&1; then
        echo "    [+] Hardware virtualization: ENABLED (VT-x/AMD-V)"
    else
        echo "    [!] Warning: Hardware virtualization may be disabled in BIOS"
    fi
    
    if command -v virsh &> /dev/null; then
        echo "    [+] libvirt/KVM available"
    else
        echo "    [!] libvirt not installed (optional - for VMs)"
    fi
    
    if command -v docker &> /dev/null; then
        echo "    [+] Docker available"
    else
        echo "    [!] Docker not installed (optional - for containers)"
    fi
}

# Setup isolated network
setup_network() {
    echo ""
    echo "[*] Setting up isolated lab network..."
    
    # Create isolated bridge for lab VMs
    if ! ip link show lab0 &> /dev/null; then
        echo "    Creating bridge 'lab0'..."
        ip link add lab0 type bridge
        ip addr add 192.168.100.1/24 dev lab0
        ip link set lab0 up
    else
        echo "    Bridge 'lab0' already exists"
    fi
    
    # Setup NAT for internet access
    echo "    Setting up NAT for lab network..."
    iptables -t nat -A POSTROUTING -s $ISOLATED_NETWORK ! -d $ISOLATED_NETWORK -j MASQUERADE
    iptables -A FORWARD -i lab0 -j ACCEPT
    iptables -A FORWARD -o lab0 -m state --state RELATED,ESTABLISHED -j ACCEPT
    
    echo "    Lab network: $ISOLATED_NETWORK (gateway: 192.168.100.1)"
}

# Install security tools
install_tools() {
    echo ""
    echo "[*] Installing security research tools..."
    
    TOOLS=(
        # Network analysis
        "tcpdump"
        "wireshark-common"
        "nmap"
        "net-tools"
        "iputils-ping"
        
        # Web security
        "nikto"
        "dirb"
        "sqlmap"
        
        # Password attacks
        "john"
        "hashcat"
        "hydra"
        
        # Forensics
        "binwalk"
        "foremost"
        "strings"
        
        # Misc
        "netcat-openbsd"
        "socat"
        "curl"
        "wget"
        "git"
    )
    
    # Only install if apt is available
    if command -v apt-get &> /dev/null; then
        echo "    Detected Debian/Ubuntu - checking packages..."
        for tool in "${TOOLS[@]}"; do
            if dpkg -l "$tool" &> /dev/null; then
                echo "    [+] $tool already installed"
            else
                echo "    [*] Installing $tool..."
                apt-get install -y "$tool" &> /dev/null || echo "        (!) Failed to install $tool"
            fi
        done
    else
        echo "    [!] Not on Debian/Ubuntu - install tools manually"
    fi
    
    # Install Python security tools
    if command -v pip3 &> /dev/null; then
        echo ""
        echo "[*] Installing Python security tools..."
        pip3 install --quiet scapy requests beautifulsoup4 dnspython || true
    fi
}

# Setup target VMs/Dockers
setup_targets() {
    echo ""
    echo "[*] Creating target systems for testing..."
    
    # Create vulnerable web app for testing
    cat > "$LAB_DIR/targets/vulnerable-app/README.md" << 'EOF'
# Vulnerable Target - DO NOT EXPOSE TO INTERNET

This is a deliberately vulnerable web application for security testing.

## Included Vulnerabilities (For Practice Only)
- SQL Injection
- Cross-Site Scripting (XSS)
- Command Injection
- File Inclusion
- Authentication Bypass

## Usage
```bash
cd vulnerable-app
docker build -t vuln-app .
docker run -p 8080:80 vuln-app
```

## IMPORTANT
This image has NO security hardening.
Never expose this to the public internet.
EOF

    echo "    Created: $LAB_DIR/targets/vulnerable-app/"
    
    # Create practice targets directory
    cat > "$LAB_DIR/targets/README.md" << 'EOF'
# Security Testing Targets

This directory contains intentionally vulnerable systems for testing.

## Safe Testing Rules

1. **Never connect lab network to main network**
2. **Never expose targets to public internet**
3. **Use VLANs or separate physical interface for lab**
4. **Document all findings in notes/ directory**
5. **Only test on targets you own or have explicit permission to test**

## Target Systems

| Name | Purpose | Risk Level |
|------|---------|------------|
| vulnerable-app | Web app pentesting | Critical |
| DVWA | Web vulnerability practice | Critical |
| Metasploitable | General exploitation | Critical |
EOF
    
    echo "    Created: $LAB_DIR/targets/README.md"
}

# Create lab documentation
create_docs() {
    echo ""
    echo "[*] Creating lab documentation..."
    
    cat > "$LAB_DIR/README.md" << 'EOF'
# Home Cybersecurity Lab

## Purpose
Personal security research and penetration testing environment.

## Network Layout
```
Internet
    |
[Router/Gateway]
    |
    +--- Main Network (192.168.1.0/24) --- Home devices
    |
    +--- Lab Network (192.168.100.0/24) --- Security lab
              |
              +--- Attacker (this machine)
              +--- Target VMs
              +--- Isolated analysis tools
```

## Directory Structure
```
security-lab/
├── vms/           # Virtual machine images
├── samples/       # Malware samples (encrypted)
├── tools/         # Security tools and scripts
├── notes/         # Research notes and findings
└── targets/       # Deliberately vulnerable systems
```

## Lab Rules

1. **Isolation First** - Lab network must NOT route to main network
2. **No Internet Exposure** - Targets are for local testing only
3. **Document Everything** - Keep notes on all activities
4. **Safe Handling** - Handle malware samples with proper precautions
5. **Legal Compliance** - Only test systems you own or have permission to test

## Getting Started

1. Run `./setup-lab.sh` to configure environment
2. Review and customize `targets/` for your practice needs
3. Start with Project 7 (encryption) and work through projects
4. Always practice on vulnerable VMs, not production systems

## Tool Categories

| Category | Tools |
|----------|-------|
| Network Analysis | tcpdump, wireshark, nmap |
| Web Testing | nikto, dirb, sqlmap |
| Password | john, hashcat, hydra |
| Forensics | binwalk, foremost, volatility |
| Exploitation | metasploit-framework |
EOF
    
    echo "    Created: $LAB_DIR/README.md"
    
    # Create research notes template
    cat > "$LAB_DIR/notes/research-log.md" << 'EOF'
# Security Research Log

## Format for Each Session

### Date: YYYY-MM-DD
### Duration: X hours
### Objective: What you planned to do

## Activities Conducted

1. [Activity description]
   - Findings: ...
   - Commands used: ...
   - Results: ...

## Findings

### Vulnerabilities Found
| Severity | Description | Location | Remediation |
|----------|-------------|----------|-------------|
| | | | |

### Tools Tested
- Tool name: Results

## Challenges/Lessons Learned

## Next Steps

---

*Continue for each session*
EOF
    
    echo "    Created: $LAB_DIR/notes/research-log.md"
}

# Summary
show_summary() {
    echo ""
    echo "=================================================="
    echo "HOME CYBERSECURITY LAB SETUP COMPLETE"
    echo "=================================================="
    echo ""
    echo "Lab directory: $LAB_DIR"
    echo ""
    echo "Directory structure:"
    echo "  ├── vms/        - VM images"
    echo "  ├── samples/    - Malware samples"
    echo "  ├── tools/      - Security tools"
    echo "  ├── notes/      - Research documentation"
    echo "  └── targets/    - Vulnerable targets for testing"
    echo ""
    echo "Next steps:"
    echo "  1. Review $LAB_DIR/README.md"
    echo "  2. Set up virtual machines (VirtualBox/KVM)"
    echo "  3. Download vulnerable ISOs (DVWA, Metasploitable)"
    echo "  4. Start practicing with tools from Project 7 onwards"
    echo ""
    echo "Remember: Keep your lab ISOLATED from your main network!"
    echo ""
}

# Main
check_virtualization
install_tools
setup_targets
create_docs
show_summary
