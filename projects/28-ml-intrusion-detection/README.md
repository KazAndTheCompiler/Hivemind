# Project 28: Use machine learning for intrusion detection

## Overview

Machine learning-based network intrusion detection system.

## Setup

```bash
cd 28-ml-intrusion-detection
python3 ml_ids.py
```

## How It Works

1. **Training** - Learn normal traffic patterns
2. **Detection** - Flag anomalies exceeding threshold

## ML Algorithms

| Algorithm | Best For |
|-----------|----------|
| Isolation Forest | Fast anomaly detection |
| One-Class SVM | Novel attack detection |
| Neural Networks | High accuracy |

## Features Used

- Packet size
- Port numbers
- Protocol type
- TCP flags
- IP addresses
