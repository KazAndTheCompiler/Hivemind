# Project 18: Build a tool to detect unusual activities

## Overview

System anomaly detection for identifying suspicious activities.

## Usage

```bash
cd 18-anomaly-detector
pip install psutil

# Single scan
python3 anomaly_detector.py scan

# Monitor for 1 hour
python3 anomaly_detector.py monitor 3600
```

## Detection Types

| Type | What It Detects |
|------|-----------------|
| CPU | Unusual CPU spikes |
| Memory | Memory exhaustion |
| Network | Connection floods |
| Process | New suspicious processes |

## Anomaly Severity

| Level | Meaning |
|-------|---------|
| CRITICAL | Immediate attention needed |
| HIGH | Significant issue |
| MEDIUM | Worth investigating |
