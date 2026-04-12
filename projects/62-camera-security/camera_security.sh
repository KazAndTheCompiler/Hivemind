#!/bin/bash
# Camera Security Assessment - Project 62

echo "
╔════════════════════════════════════════════════════════════════╗
║     Camera Security Assessment - Project 62                   ║
╚════════════════════════════════════════════════════════════════╝

IOT CAMERA VULNERABILITIES:

Common issues:
- Default credentials
- Unencrypted video streams
- No firmware updates
- Cloud reliance for features
- Weak WiFi security

CAMERA SECURITY AUDIT:

1. NETWORK ENUMERATION

# Find cameras on network
nmap -p 80,443,554,8080 192.168.1.0/24

# Check for RTSP (Real Time Streaming Protocol)
nmap -p 554 --script=rtsp-url-brute 192.168.1.0/24

# Check for ONVIF (Open Network Video Interface Forum)
curl -X GET http://camera-ip:80/onvif/device_service

2. DEFAULT CREDENTIALS

Common defaults:
- admin:admin
- admin:123456
- admin:password
- user:user
- Administrator:admin

Check manufacturer defaults:
- Hikvision: admin:admin
- Dahua: admin:admin
- Axis: root:pass
- Foscam: admin:\\

3. PROTOCOL TESTING

# RTSP (usually port 554)
rtsp://camera-ip:554/stream1

# ONVIF discovery
ws-discovery probe onvif://localhost/

# HTTP interface
curl -v http://camera-ip/

# Check for Telnet
nmap -p 23 camera-ip

4. VIDEO STREAM ANALYSIS

# Wireshark capture
# Filter: rtsp or http

# Check for unencrypted streams
# Unencrypted = anyone can watch

SECURITY ISSUES FOUND:

| Issue | Risk | Fix |
|-------|------|-----|
| Default password | Critical | Change immediately |
| HTTP (no TLS) | High | Enable HTTPS |
| UPnP enabled | High | Disable UPnP |
| Firmware outdated | High | Update firmware |
| No MAC filtering | Medium | Enable MAC whitelist |
| WPS enabled | Medium | Disable WPS |

HARDENING CAMERAS:

NETWORK SEGMENTATION:

# Put cameras on isolated VLAN
# Create camera VLAN 10
# Allow only specific traffic

iptables -A FORWARD -i camera-vlan -o internet -j ACCEPT
iptables -A FORWARD -i camera-vlan -d internal-net -j DROP

# Block camera-to-camera communication
# Cameras should only reach NVR/cloud

ACCESS CONTROL:

# Strong passwords (20+ chars)
# Two-factor authentication if available
# IP whitelist for access

# Disable unused services
# - UPnP
# - ONVIF (if not needed)
# - Telnet

FIRMWARE UPDATES:

# Check manufacturer regularly
# Enable auto-update if available
# Verify update authenticity (hash)

SECURITY CHECKLIST:

[ ] Change default password
[ ] Enable HTTPS
[ ] Disable UPnP
[ ] Disable WPS
[ ] Update firmware
[ ] Segregate camera VLAN
[ ] Enable MAC filtering
[ ] Remove Telnet/SSH if unused
[ ] Use strong WiFi WPA3
[ ] Monitor access logs
[ ] Regular security audits

CAMERA TYPES TO AUDIT:

| Type | Protocols | Ports |
|------|-----------|-------|
| IP Camera | RTSP, ONVIF, HTTP | 80, 443, 554, 8000 |
| NVR | HTTP, SSH, RTSP | 80, 443, 22, 554 |
| Baby Monitor | Proprietary, Cloud | Varies |
| Doorbell Cam | HTTPS, Cloud | 443 |

TOOLS:

| Tool | Purpose |
|------|---------|
| nmap | Network scanning |
| ONVIF Scanner | ONVIF discovery |
| Wireshark | Protocol analysis |
| THC-IPV6 | Attack toolkit |

MANUFACTURER SPECIFIC:

HIKVISION:
- Default: admin/admin
- Path: /doc/page/login.asp
- DVR: /ISAPI/Streaming/channels

DAHUA:
- Default: admin/admin
- Path: /cgi-bin/usermgr.cgi
- Config: /cgi-bin/configManager.cgi

AMCREST:
- Default: admin:admin
- Path: /cgi-bin/login.cgi

REOLINK:
- Default: admin:password
- Path: /cgi-bin/api.cgi

"

# Check for tools
echo -e \"\\n[*] Checking security tools...\"
for tool in nmap wireshark; do
    if command -v $tool &> /dev/null 2>&1; then
        echo \"[+] $tool installed\"
    else
        echo \"[-] $tool not found\"
    fi
done