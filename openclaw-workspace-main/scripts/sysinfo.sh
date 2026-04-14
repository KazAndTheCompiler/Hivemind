#!/bin/bash
# Sysinfo - outputs structured JSON with system info

hostname_val=$(hostname)
uptime_val=$(uptime -p 2>/dev/null || uptime)
mem_free_kb=$(free -k 2>/dev/null | awk '/Mem:/ {print $4}' || echo "N/A")
disk_free_kb=$(df -k / | awk 'NR==2 {print $4}' || echo "N/A")
load_avg=$(uptime | awk -F'load average:' '{print $2}' | sed 's/ //g' || echo "N/A")

cat <<EOF
{
  "hostname": "$hostname_val",
  "uptime": "$uptime_val",
  "memory_free": "$mem_free_kb KB",
  "disk_free": "$disk_free_kb KB",
  "load_avg": "$load_avg"
}
EOF
