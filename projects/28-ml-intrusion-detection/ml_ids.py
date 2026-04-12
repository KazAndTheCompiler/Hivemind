#!/usr/bin/env python3
"""
ML-Based Intrusion Detection - Project 28
Using machine learning for network anomaly detection.

EDUCATIONAL USE ONLY. Only use on networks you own or have permission to monitor.
"""

import os
import sys
import json
import time
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple
from dataclasses import dataclass

# Simple ML implementation without external dependencies
class SimpleMLIDS:
    """Simple ML-based intrusion detection system."""
    
    def __init__(self):
        self.baseline = None
        self.threshold = 3.0  # Standard deviations
        self.features = []
    
    def extract_features(self, packet_data: Dict) -> List[float]:
        """Extract features from network packet."""
        features = []
        
        # Basic features
        features.append(packet_data.get('packet_size', 0))
        features.append(packet_data.get('src_port', 0))
        features.append(packet_data.get('dst_port', 0))
        features.append(1 if packet_data.get('protocol') == 'TCP' else 0)
        features.append(1 if packet_data.get('protocol') == 'UDP' else 0)
        
        # Derived features
        features.append(len(str(packet_data.get('flags', ''))))
        features.append(1 if packet_data.get('src_ip', '').startswith('192.168') else 0)
        
        return features
    
    def calculate_zscore(self, value: float, mean: float, std: float) -> float:
        if std == 0:
            return 0
        return abs((value - mean) / std)
    
    def train(self, normal_traffic: List[Dict]):
        """Train on normal traffic to establish baseline."""
        print("[*] Training on normal traffic...")
        
        all_features = []
        for packet in normal_traffic:
            features = self.extract_features(packet)
            all_features.append(features)
        
        self.features = np.array(all_features)
        
        # Calculate mean and std for each feature
        self.baseline = {
            'mean': np.mean(self.features, axis=0),
            'std': np.std(self.features, axis=0)
        }
        
        print(f"[+] Trained on {len(normal_traffic)} samples")
        return self
    
    def detect_anomaly(self, packet: Dict) -> Tuple[bool, float]:
        """Detect if packet is anomalous."""
        if self.baseline is None:
            return False, 0.0
        
        features = np.array(self.extract_features(packet))
        
        # Calculate z-scores
        zscores = self.calculate_zscore(
            features,
            self.baseline['mean'],
            self.baseline['std']
        )
        
        max_zscore = float(np.max(zscores))
        
        # Flag as anomaly if any feature exceeds threshold
        is_anomaly = max_zscore > self.threshold
        
        return is_anomaly, max_zscore
    
    def generate_baseline_traffic(self, count: int = 1000) -> List[Dict]:
        """Generate synthetic normal traffic for training."""
        print(f"[*] Generating {count} baseline traffic samples...")
        
        traffic = []
        for _ in range(count):
            traffic.append({
                'packet_size': np.random.randint(64, 1500),
                'src_port': np.random.choice([80, 443, 22, 8080]),
                'dst_port': np.random.choice([443, 80, 22, 3306]),
                'protocol': np.random.choice(['TCP', 'TCP', 'UDP']),
                'flags': 'A',
                'src_ip': '192.168.1.' + str(np.random.randint(1, 255))
            })
        
        return traffic
    
    def simulate_attack(self) -> Dict:
        """Simulate an attack packet."""
        return {
            'packet_size': 15000,  # Unusually large
            'src_port': 12345,      # Unusual port
            'dst_port': 22,        # SSH
            'protocol': 'TCP',
            'flags': 'S',          # SYN flood
            'src_ip': '10.0.0.' + str(np.random.randint(1, 255))
        }

def main():
    print("""
╔════════════════════════════════════════════════════════════════╗
║     ML-Based Intrusion Detection - Project 28                ║
║                                                                ║
║     EDUCATIONAL USE ONLY                                       ║
║     Only use on networks you own or have permission to monitor ║
╚════════════════════════════════════════════════════════════════╝

HOW ML-BASED IDS WORKS:

1. TRAINING PHASE
   - Collect normal traffic samples
   - Learn baseline patterns
   - Calculate feature statistics

2. DETECTION PHASE
   - Extract features from new traffic
   - Compare against baseline
   - Flag anomalies exceeding threshold

COMMON ML ALGORITHMS:

| Algorithm | Pros | Cons |
|-----------|------|------|
| Isolation Forest | Fast, unsupervised | Requires tuning |
| One-Class SVM | Good for anomalies | Slow on large data |
| Neural Networks | High accuracy | Needs lots of data |
| Random Forest | Robust | May miss novel attacks |

FEATURES FOR NETWORK IDS:

- Packet size
- Port numbers
- Protocol type
- TCP flags
- Connection duration
- Bytes transferred
- Request frequency
    """)
    
    # Simple demo
    ids = SimpleMLIDS()
    
    # Generate baseline
    baseline = ids.generate_baseline_traffic(500)
    ids.train(baseline)
    
    # Test with normal traffic
    print("\n[*] Testing with normal traffic...")
    normal_packet = {
        'packet_size': 512,
        'src_port': 443,
        'dst_port': 8080,
        'protocol': 'TCP',
        'flags': 'A',
        'src_ip': '192.168.1.100'
    }
    
    is_anomaly, score = ids.detect_anomaly(normal_packet)
    print(f"    Normal packet: anomaly={is_anomaly}, score={score:.2f}")
    
    # Test with attack
    print("\n[*] Testing with attack traffic...")
    attack_packet = ids.simulate_attack()
    is_anomaly, score = ids.detect_anomaly(attack_packet)
    print(f"    Attack packet: anomaly={is_anomaly}, score={score:.2f}")

if __name__ == "__main__":
    main()
