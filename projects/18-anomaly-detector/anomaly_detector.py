#!/usr/bin/env python3
"""
Anomaly Detection System - Project 18
Detect unusual system activities.

EDUCATIONAL USE ONLY. Only monitor systems you own or have permission to monitor.
"""

import os
import time
import json
import psutil
import threading
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass

@dataclass
class Anomaly:
    timestamp: str
    event_type: str
    description: str
    severity: str
    details: Dict

class AnomalyDetector:
    """System anomaly detector."""
    
    def __init__(self, baseline_file: str = "baseline.json"):
        self.baseline_file = baseline_file
        self.baseline = self._load_baseline()
        self.anomalies = []
        self.monitoring = False
    
    def _load_baseline(self) -> Dict:
        if Path(self.baseline_file).exists():
            with open(self.baseline_file) as f:
                return json.load(f)
        
        # Default baseline
        return {
            "cpu_percent": 50.0,
            "memory_percent": 80.0,
            "disk_percent": 90.0,
            "network_connections": 100,
            "process_count": 200
        }
    
    def _save_baseline(self):
        with open(self.baseline_file, "w") as f:
            json.dump(self.baseline, f, indent=2)
    
    def collect_metrics(self) -> Dict:
        """Collect current system metrics."""
        return {
            "cpu_percent": psutil.cpu_percent(interval=1),
            "memory_percent": psutil.virtual_memory().percent,
            "disk_percent": psutil.disk_usage('/').percent,
            "network_connections": len(psutil.net_connections()),
            "process_count": len(psutil.pids()),
            "timestamp": datetime.now().isoformat()
        }
    
    def detect_cpu_anomaly(self, current: float, threshold: float = None) -> Optional[Anomaly]:
        if threshold is None:
            threshold = self.baseline["cpu_percent"]
        
        if current > threshold:
            return Anomaly(
                timestamp=datetime.now().isoformat(),
                event_type="CPU",
                description=f"High CPU usage: {current:.1f}%",
                severity="HIGH",
                details={"current": current, "threshold": threshold}
            )
        return None
    
    def detect_memory_anomaly(self, current: float, threshold: float = None) -> Optional[Anomaly]:
        if threshold is None:
            threshold = self.baseline["memory_percent"]
        
        if current > threshold:
            return Anomaly(
                timestamp=datetime.now().isoformat(),
                event_type="MEMORY",
                description=f"High memory usage: {current:.1f}%",
                severity="HIGH",
                details={"current": current, "threshold": threshold}
            )
        return None
    
    def detect_network_anomaly(self, current: int) -> Optional[Anomaly]:
        threshold = self.baseline["network_connections"]
        
        if current > threshold * 2:
            return Anomaly(
                timestamp=datetime.now().isoformat(),
                event_type="NETWORK",
                description=f"Unusual network connections: {current}",
                severity="CRITICAL",
                details={"current": current, "baseline": threshold}
            )
        elif current > threshold:
            return Anomaly(
                timestamp=datetime.now().isoformat(),
                event_type="NETWORK",
                description=f"Elevated network connections: {current}",
                severity="MEDIUM",
                details={"current": current, "baseline": threshold}
            )
        return None
    
    def detect_new_process(self, current_pids: List[int], baseline_pids: List[int]) -> List[Anomaly]:
        new_pids = set(current_pids) - set(baseline_pids)
        anomalies = []
        
        for pid in new_pids:
            try:
                proc = psutil.Process(pid)
                name = proc.name()
                cmdline = proc.cmdline()
                
                if any(s in name.lower() for s in ['malware', 'virus', 'backdoor']):
                    anomalies.append(Anomaly(
                        timestamp=datetime.now().isoformat(),
                        event_type="PROCESS",
                        description=f"Suspicious new process: {name}",
                        severity="CRITICAL",
                        details={"pid": pid, "name": name, "cmdline": cmdline}
                    ))
                else:
                    anomalies.append(Anomaly(
                        timestamp=datetime.now().isoformat(),
                        event_type="PROCESS",
                        description=f"New process: {name}",
                        severity="LOW",
                        details={"pid": pid, "name": name, "cmdline": cmdline}
                    ))
            except:
                pass
        
        return anomalies
    
    def scan(self) -> List[Anomaly]:
        """Perform anomaly detection scan."""
        anomalies = []
        metrics = self.collect_metrics()
        
        # CPU check
        cpu_anomaly = self.detect_cpu_anomaly(metrics["cpu_percent"])
        if cpu_anomaly:
            anomalies.append(cpu_anomaly)
        
        # Memory check
        mem_anomaly = self.detect_memory_anomaly(metrics["memory_percent"])
        if mem_anomaly:
            anomalies.append(mem_anomaly)
        
        # Network check
        net_anomaly = self.detect_network_anomaly(metrics["network_connections"])
        if net_anomaly:
            anomalies.append(net_anomaly)
        
        self.anomalies.extend(anomalies)
        return anomalies
    
    def monitor_loop(self, interval: int = 60, duration: int = 3600):
        """Continuous monitoring loop."""
        self.monitoring = True
        baseline_pids = psutil.pids()
        end_time = time.time() + duration
        
        print(f"[*] Monitoring for {duration}s, checking every {interval}s...")
        
        while self.monitoring and time.time() < end_time:
            anomalies = self.scan()
            
            if anomalies:
                print(f"[!] Detected {len(anomalies)} anomalies:")
                for a in anomalies:
                    print(f"    {a.severity}: {a.description}")
            
            time.sleep(interval)
        
        print("[*] Monitoring complete")
    
    def stop_monitoring(self):
        self.monitoring = False
    
    def generate_report(self) -> str:
        """Generate anomaly report."""
        critical = [a for a in self.anomalies if a.severity == "CRITICAL"]
        high = [a for a in self.anomalies if a.severity == "HIGH"]
        medium = [a for a in self.anomalies if a.severity == "MEDIUM"]
        
        report = f"""
╔════════════════════════════════════════════════════════════════╗
║     ANOMALY DETECTION REPORT                                  ║
╚════════════════════════════════════════════════════════════════╝

Total Anomalies: {len(self.anomalies)}
Critical: {len(critical)}
High: {len(high)}
Medium: {len(medium)}

"""
        
        if critical:
            report += "CRITICAL:\n"
            for a in critical:
                report += f"  {a.timestamp}: {a.description}\n"
        
        if high:
            report += "\nHIGH:\n"
            for a in high:
                report += f"  {a.timestamp}: {a.description}\n"
        
        if medium:
            report += "\nMEDIUM:\n"
            for a in medium:
                report += f"  {a.timestamp}: {a.description}\n"
        
        if not self.anomalies:
            report += "[+] No anomalies detected.\n"
        
        return report

def main():
    import sys
    
    detector = AnomalyDetector()
    
    print("""
╔════════════════════════════════════════════════════════════════╗
║     Anomaly Detection System - Project 18                     ║
║                                                                ║
║     EDUCATIONAL USE ONLY                                       ║
║     Only monitor systems you own or have permission         ║
╚════════════════════════════════════════════════════════════════╝

Usage:
  python3 anomaly_detector.py scan     - Single scan
  python3 anomaly_detector.py monitor  - Continuous monitoring
  python3 anomaly_detector.py baseline - Collect baseline
    """)
    
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        
        if cmd == "scan":
            anomalies = detector.scan()
            if anomalies:
                print(f"[!] Found {len(anomalies)} anomalies:")
                for a in anomalies:
                    print(f"  {a.severity}: {a.description}")
            else:
                print("[+] No anomalies detected")
        
        elif cmd == "monitor":
            duration = int(sys.argv[2]) if len(sys.argv) > 2 else 3600
            try:
                detector.monitor_loop(duration=duration)
            except KeyboardInterrupt:
                detector.stop_monitoring()
            print(detector.generate_report())
        
        elif cmd == "baseline":
            print("[*] Collecting baseline...")
            for i in range(5):
                m = detector.collect_metrics()
                print(f"    Sample {i+1}: CPU {m['cpu_percent']:.1f}%, Mem {m['memory_percent']:.1f}%")
                time.sleep(1)
            print("[+] Baseline collected")
    
    else:
        print(detector.generate_report())

if __name__ == "__main__":
    main()
