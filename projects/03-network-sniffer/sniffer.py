#!/usr/bin/env python3
"""
Network Packet Sniffer - Project 3
A basic packet sniffer using Python raw sockets.

EDUCATIONAL USE ONLY. Only sniff networks you own or have permission to monitor.
"""

import socket
import struct
import json
import datetime
import sys
import argparse
from pathlib import Path
from typing import Optional

# Protocol numbers
IP_PROTO_TCP = 6
IP_PROTO_UDP = 17
IP_PROTO_ICMP = 1

# Well-known ports
PORT_NAMES = {
    20: "FTP-DATA", 21: "FTP", 22: "SSH", 23: "TELNET", 25: "SMTP",
    53: "DNS", 80: "HTTP", 110: "POP3", 143: "IMAP", 443: "HTTPS",
    3306: "MYSQL", 3389: "RDP", 5432: "POSTGRES", 8080: "HTTP-ALT"
}

LOG_DIR = Path(__file__).parent / "logs"
PACKET_LOG = LOG_DIR / "packets.jsonl"
SUMMARY_LOG = LOG_DIR / "summary.json"
LOG_DIR.mkdir(exist_ok=True)

class PacketSniffer:
    def __init__(self, output_file=None, max_packets=0, filter_port=None):
        self.output_file = output_file or PACKET_LOG
        self.max_packets = max_packets
        self.filter_port = filter_port
        self.packet_count = 0
        self.protocol_stats = {"TCP": 0, "UDP": 0, "ICMP": 0, "OTHER": 0}
        self.port_stats = {}
        self.ip_stats = {}
        
    def parse_ip_header(self, data: bytes) -> dict:
        """Parse IPv4 header."""
        if len(data) < 20:
            return {}
        
        # First byte: version (4 bits) + IHL (4 bits)
        version_ihl = data[0]
        version = version_ihl >> 4
        ihl = version_ihl & 0x0F
        
        # Total length
        total_length = struct.unpack("!H", data[2:4])[0]
        
        # TTL
        ttl = data[8]
        
        # Protocol
        protocol = data[9]
        
        # Source IP
        src_ip = ".".join(str(b) for b in data[12:16])
        
        # Destination IP
        dst_ip = ".".join(str(b) for b in data[16:20])
        
        return {
            "version": version,
            "header_length": ihl * 4,
            "total_length": total_length,
            "ttl": ttl,
            "protocol": protocol,
            "src_ip": src_ip,
            "dst_ip": dst_ip
        }
    
    def parse_tcp_header(self, data: bytes) -> dict:
        """Parse TCP header."""
        if len(data) < 20:
            return {}
        
        src_port = struct.unpack("!H", data[0:2])[0]
        dst_port = struct.unpack("!H", data[2:4])[0]
        
        # Flags (byte 13)
        flags_byte = data[13]
        flags = {
            "FIN": bool(flags_byte & 0x01),
            "SYN": bool(flags_byte & 0x02),
            "RST": bool(flags_byte & 0x04),
            "PSH": bool(flags_byte & 0x08),
            "ACK": bool(flags_byte & 0x10),
        }
        
        return {
            "src_port": src_port,
            "dst_port": dst_port,
            "flags": flags
        }
    
    def parse_udp_header(self, data: bytes) -> dict:
        """Parse UDP header."""
        if len(data) < 8:
            return {}
        
        src_port = struct.unpack("!H", data[0:2])[0]
        dst_port = struct.unpack("!H", data[2:4])[0]
        length = struct.unpack("!H", data[4:6])[0]
        
        return {
            "src_port": src_port,
            "dst_port": dst_port,
            "length": length
        }
    
    def parse_packet(self, packet_data: bytes) -> Optional[dict]:
        """Parse a raw packet and extract relevant information."""
        try:
            ip_header = self.parse_ip_header(packet_data)
            if not ip_header:
                return None
            
            proto = ip_header.get("protocol", 0)
            protocol_name = "OTHER"
            
            result = {
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "src_ip": ip_header["src_ip"],
                "dst_ip": ip_header["dst_ip"],
                "ttl": ip_header["ttl"],
                "packet_length": len(packet_data)
            }
            
            # TCP
            if proto == IP_PROTO_TCP:
                protocol_name = "TCP"
                ip_header_len = ip_header.get("header_length", 20)
                tcp_data = packet_data[ip_header_len:ip_header_len+20]
                tcp_info = self.parse_tcp_header(tcp_data)
                result.update({
                    "protocol": "TCP",
                    "src_port": tcp_info.get("src_port", 0),
                    "dst_port": tcp_info.get("dst_port", 0),
                    "flags": tcp_info.get("flags", {}),
                    "src_service": PORT_NAMES.get(tcp_info.get("src_port", 0), "UNKNOWN"),
                    "dst_service": PORT_NAMES.get(tcp_info.get("dst_port", 0), "UNKNOWN")
                })
            
            # UDP
            elif proto == IP_PROTO_UDP:
                protocol_name = "UDP"
                ip_header_len = ip_header.get("header_length", 20)
                udp_data = packet_data[ip_header_len:ip_header_len+8]
                udp_info = self.parse_udp_header(udp_data)
                result.update({
                    "protocol": "UDP",
                    "src_port": udp_info.get("src_port", 0),
                    "dst_port": udp_info.get("dst_port", 0),
                    "src_service": PORT_NAMES.get(udp_info.get("src_port", 0), "DNS" if udp_info.get("src_port") == 53 else "UNKNOWN"),
                    "dst_service": PORT_NAMES.get(udp_info.get("dst_port", 0), "DNS" if udp_info.get("dst_port") == 53 else "UNKNOWN")
                })
            
            # ICMP
            elif proto == IP_PROTO_ICMP:
                protocol_name = "ICMP"
                result["protocol"] = "ICMP"
            
            else:
                result["protocol"] = f"PROTO-{proto}"
            
            # Filter by port if specified
            if self.filter_port:
                if result.get("src_port") != self.filter_port and result.get("dst_port") != self.filter_port:
                    return None
            
            return result
            
        except Exception as e:
            return None
    
    def log_packet(self, packet_info: dict):
        """Log packet to file and update stats."""
        # Print to console
        proto = packet_info.get("protocol", "UNKNOWN")
        src = packet_info.get("src_ip", "?")
        dst = packet_info.get("dst_ip", "?")
        
        if proto == "TCP":
            sport = packet_info.get("src_port", "?")
            dport = packet_info.get("dst_port", "?")
            flags = "".join(f for f, v in packet_info.get("flags", {}).items() if v)
            print(f"[{proto}] {src}:{sport} → {dst}:{dport} [{flags}]")
        elif proto == "UDP":
            sport = packet_info.get("src_port", "?")
            dport = packet_info.get("dst_port", "?")
            print(f"[{proto}] {src}:{sport} → {dst}:{dport}")
        elif proto == "ICMP":
            print(f"[{proto}] {src} → {dst}")
        else:
            print(f"[{proto}] {src} → {dst}")
        
        # Update stats
        self.protocol_stats[proto] = self.protocol_stats.get(proto, 0) + 1
        
        src_ip = packet_info.get("src_ip", "unknown")
        dst_ip = packet_info.get("dst_ip", "unknown")
        self.ip_stats[src_ip] = self.ip_stats.get(src_ip, 0) + 1
        self.ip_stats[dst_ip] = self.ip_stats.get(dst_ip, 0) + 1
        
        if "dst_port" in packet_info:
            port = packet_info["dst_port"]
            self.port_stats[port] = self.port_stats.get(port, 0) + 1
        
        # Write to log file
        with open(self.output_file, "a") as f:
            f.write(json.dumps(packet_info) + "\n")
    
    def print_stats(self):
        """Print summary statistics."""
        print("\n" + "="*50)
        print("PACKET SNIFFER STATISTICS")
        print("="*50)
        print(f"\nTotal packets: {self.packet_count}")
        
        print(f"\nProtocol breakdown:")
        for proto, count in sorted(self.protocol_stats.items(), key=lambda x: -x[1]):
            pct = (count / self.packet_count * 100) if self.packet_count > 0 else 0
            print(f"  {proto}: {count} ({pct:.1f}%)")
        
        if self.port_stats:
            print(f"\nTop destination ports:")
            for port, count in sorted(self.port_stats.items(), key=lambda x: -x[1])[:10]:
                name = PORT_NAMES.get(port, "UNKNOWN")
                print(f"  {port} ({name}): {count}")
        
        if self.ip_stats:
            print(f"\nMost active IPs:")
            for ip, count in sorted(self.ip_stats.items(), key=lambda x: -x[1])[:10]:
                print(f"  {ip}: {count} packets")
        
        # Save summary
        summary = {
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "total_packets": self.packet_count,
            "protocol_stats": self.protocol_stats,
            "port_stats": self.port_stats,
            "ip_stats": self.ip_stats
        }
        with open(SUMMARY_LOG, "w") as f:
            json.dump(summary, f, indent=2)
        print(f"\n[+] Summary saved to {SUMMARY_LOG}")
    
    def start(self, interface=None, count=0):
        """
        Start sniffing packets.
        
        Args:
            interface: Network interface to sniff on (None = all)
            count: Maximum packets to capture (0 = unlimited)
        """
        print(f"""
    ╔═══════════════════════════════════════════════════════╗
    ║     Network Packet Sniffer - Project 3              ║
    ║                                                       ║
    ║     EDUCATIONAL USE ONLY                              ║
    ║     Only sniff networks you own or have permission   ║
    ╚═══════════════════════════════════════════════════════╝
        """)
        
        print(f"[*] Starting sniffer...")
        print(f"[*] Output: {self.output_file}")
        print(f"[*] Max packets: {self.max_packets or 'unlimited'}")
        if self.filter_port:
            print(f"[*] Filter: port {self.filter_port}")
        print(f"[*] Press Ctrl+C to stop\n")
        
        try:
            # Create raw socket
            # AF_INET = IPv4, SOCK_RAW = raw packets, IPPROTO_TCP = catch TCP
            sniffer = socket.socket(socket.AF_INET, socket.SOCK_RAW, socket.IPPROTO_TCP)
            
            # Include IP headers
            sniffer.setsockopt(socket.IPPROTO_IP, socket.IP_HDRINCL, 1)
            
            # Set timeout for interruptibility
            sniffer.settimeout(1)
            
            print("[*] Sniffing... (you may need to generate some network traffic)\n")
            
            while True:
                try:
                    packet_data, addr = sniffer.recvfrom(65535)
                    packet_info = self.parse_packet(packet_data)
                    
                    if packet_info:
                        self.log_packet(packet_info)
                        self.packet_count += 1
                        
                        if self.max_packets > 0 and self.packet_count >= self.max_packets:
                            print(f"\n[*] Reached packet limit ({self.max_packets})")
                            break
                
                except socket.timeout:
                    continue
                except Exception as e:
                    if "Operation not permitted" in str(e):
                        print("[!] Need root privileges. Run with sudo.")
                        break
                    print(f"[!] Error: {e}")
                    continue
                    
        except KeyboardInterrupt:
            print("\n[!] Stopping sniffer...")
        finally:
            self.print_stats()

def main():
    parser = argparse.ArgumentParser(description="Network Packet Sniffer")
    parser.add_argument("-i", "--interface", help="Network interface")
    parser.add_argument("-c", "--count", type=int, default=0, help="Max packets (0=unlimited)")
    parser.add_argument("-p", "--port", type=int, help="Filter by port")
    parser.add_argument("-o", "--output", help="Output file")
    args = parser.parse_args()
    
    sniffer = PacketSniffer(
        output_file=args.output,
        max_packets=args.count,
        filter_port=args.port
    )
    
    sniffer.start(interface=args.interface)

if __name__ == "__main__":
    main()
