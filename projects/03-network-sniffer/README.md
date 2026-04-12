# Project 3: Build a tool to sniff network traffic

## Overview

A basic packet sniffer using Python raw sockets. Captures and analyzes TCP/UDP/ICMP packets, logs them to JSON, and provides traffic statistics.

## ⚠️ Legal Warning

**Only use this on:**
- Networks you own
- Systems you have explicit permission to monitor
- Educational/demo environments

**Never use this for:**
- Intercepting other people's network traffic
- Unauthorized surveillance
- Any illegal activity

## What It Does

- Captures TCP, UDP, and ICMP packets
- Extracts source/destination IPs and ports
- Identifies TCP flags (SYN, ACK, FIN, RST, PSH)
- Maps ports to known services (HTTP, SSH, DNS, etc.)
- Logs all packets to JSON for later analysis
- Provides traffic statistics (protocol breakdown, top IPs, top ports)

## Quick Start

```bash
cd 03-network-sniffer

# Run with sudo (required for raw sockets)
sudo python3 sniffer.py

# Capture only 100 packets
sudo python3 sniffer.py -c 100

# Filter by port (e.g., only HTTP/HTTPS)
sudo python3 sniffer.py -p 80 -p 443

# Save to custom file
sudo python3 sniffer.py -o /tmp/capture.json
```

## Sample Output

```
[*] Sniffing...

[TCP] 192.168.1.100:54321 → 142.250.185.14:443 [SYN]
[TCP] 142.250.185.14:443 → 192.168.1.100:54321 [SYN, ACK]
[TCP] 192.168.1.100:54321 → 142.250.185.14:443 [ACK]
[UDP] 192.168.1.100:54353 → 8.8.8.8:53
[TCP] 192.168.1.100:54321 → 142.250.185.14:443 [PSH, ACK]
[ICMP] 192.168.1.1 → 192.168.1.100

==================================================
PACKET SNIFFER STATISTICS
==================================================

Total packets: 47

Protocol breakdown:
  TCP: 42 (89.4%)
  UDP: 4 (8.5%)
  ICMP: 1 (2.1%)

Top destination ports:
  443 (HTTPS): 28
  80 (HTTP): 12
  53 (DNS): 4

Most active IPs:
  142.250.185.14: 30 packets
  8.8.8.8: 4 packets
  192.168.1.1: 2 packets

[+] Summary saved to logs/summary.json
```

## Log Format

### packets.jsonl (JSON Lines)
```json
{"timestamp": "2026-04-12T10:30:00+00:00", "protocol": "TCP", "src_ip": "192.168.1.100", "dst_ip": "142.250.185.14", "src_port": 54321, "dst_port": 443, "ttl": 64, "packet_length": 60, "flags": {"FIN": false, "SYN": true, "RST": false, "PSH": false, "ACK": true}}
```

## How It Works

1. **Raw Sockets** - Create a raw socket with `IPPROTO_TCP` to receive IP packets
2. **IP Header Parsing** - Extract source/destination IP, TTL, protocol number
3. **TCP/UDP Header Parsing** - Extract ports and TCP flags
4. **Service Detection** - Map port numbers to known service names
5. **Statistics** - Aggregate packet counts by protocol, IP, and port

## Limitations

- Requires root/sudo privileges
- Only captures incoming packets to this host (not full network)
- Doesn't capture all protocols without proper interface binding
- Limited to IPv4 (no IPv6)

## Production Tools (For Learning)

- **Wireshark** - Full-featured packet analyzer with GUI
- **tcpdump** - Command-line packet analyzer
- **Scapy** - Python library for packet manipulation
- **Ettercap** - Man-in-the-middle toolkit

## Security Notes

Understanding packet sniffing helps you:

1. **Detect network reconnaissance** - Unusual traffic patterns
2. **Identify exfiltration** - Large outbound data transfers
3. **Spot malicious traffic** - C2 communications, data leaks
4. **Implement network monitoring** - IDS/IPS systems
5. **Use encryption** - Why plain HTTP is dangerous

## Files

```
03-network-sniffer/
├── sniffer.py       # Main sniffer script
├── README.md        # This file
└── logs/
    ├── packets.jsonl  # Captured packets
    └── summary.json   # Traffic statistics
```
