#!/bin/bash
# IoT Security Assessment - Project 42
# Security testing for Internet of Things devices

echo "
╔════════════════════════════════════════════════════════════════╗
║     IoT Security Assessment - Project 42                     ║
╚════════════════════════════════════════════════════════════════╝

IOT SECURITY LANDSCAPE:

IoT devices often have:
- Weak default credentials
- No firmware updates
- Insecure protocols
- Limited processing power for crypto

COMMON VULNERABILITIES:

| Category | Issue | Risk |
|----------|-------|------|
| Authentication | Default passwords | Full device control |
| Communication | Unencrypted MQTT/CoAP | Data interception |
| Firmware | No updates | Known CVEs |
| Cloud | Weak APIs | Backend compromise |
| Physical | UART/JTAG exposed | Firmware extraction |

ASSESSMENT METHODOLOGY:

1. RECONNAISSANCE
   - Find device on network
   - Identify model/firmware version
   - Check Shodan, Censys for exposure

2. INTERFACE ANALYSIS
   - Web interface (admin panel)
   - Mobile app (API calls)
   - Cloud integration
   - Physical ports (UART, JTAG)

3. COMMUNICATION ANALYSIS
   - MQTT topics and auth
   - CoAP endpoints
   - HTTP API calls
   - BLE/Zigbee traffic

4. VULNERABILITY TESTING
   - Default credential check
   - Protocol analysis
   - Firmware extraction
   - Cloud API testing

COMMON PORTS/SERVICES:

| Port | Protocol | Risk |
|------|----------|------|
| 1883 | MQTT | Unencrypted traffic |
| 5683 | CoAP | Unencrypted traffic |
| 80/443 | HTTP/HTTPS | Web vulnerabilities |
| 8080 | HTTP Alt | Admin interfaces |
| 23 | Telnet | Clear text credentials |
| 22 | SSH | Brute force |

FIRMWARE ANALYSIS:

# Download firmware (from vendor or device)
# Binwalk for extraction
binwalk -e firmware.bin

# Analyze filesystem
find _firmware.extracted -type f -name \"*.conf\" -o -name \"*.pem\" -o -name \"*.key\"

# Analyze binary
strings firmware.bin | grep -i password
strings firmware.bin | grep -i http

# Use Firmwalker
./firmwalker.sh firmware.bin ./output/

HARDWARE ANALYSIS:

# UART identification
# Connect to UART pins (TX, RX, GND)
# Common baud rates: 115200, 57600, 9600

# JTAG analysis
# Use OpenOCD + JTAG debugger
openocd -f interface.cfg -f target.cfg

# SPI flash extraction
# Use flashrom to read SPI chip
flashrom -r firmware.bin -c MX25L6406E

MOBILE APP ANALYSIS:

# Decompile APK
apktool d app.apk

# Analyze network traffic
# Use Burp Suite proxy
# Intercept API calls

# Find hardcoded credentials
grep -r \"password\" ./app/
grep -r \"api_key\" ./app/

SECURITY CHECKLIST:

[ ] Change default credentials
[ ] Enable encryption (TLS)
[ ] Disable unused services
[ ] Update firmware regularly
[ ] Use strong WiFi passwords
[ ] Segment IoT on separate VLAN
[ ] Monitor device behavior
[ ] Review cloud/integration security

TOOLS:

| Tool | Purpose |
|------|---------|
| binwalk | Firmware extraction |
| Firmwalker | Firmware analysis |
| MQTT.fx | MQTT testing |
| Wireshark | Protocol analysis |
| AFL | Fuzzing |
| FirmAE | Firmware emulation |

"

# Check for tools
echo -e \"\\n[*] Checking available tools...\"
for tool in binwalk nmap mqttfx; do
    if command -v $tool &> /dev/null; then
        echo \"[+] $tool installed\"
    else
        echo \"[-] $tool not found\"
    fi
done