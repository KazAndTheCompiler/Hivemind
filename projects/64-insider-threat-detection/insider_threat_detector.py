#!/usr/bin/env python3
"""
Insider Threat Detection System
EDUCATIONAL USE ONLY - Authorize before monitoring
"""

import json
import hashlib
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Dict, List, Optional


class UserActivity:
    """Represents a user's activity record."""

    def __init__(self, user_id: str):
        self.user_id = user_id
        self.login_times = []
        self.activities = []
        self.data_transfers = []
        self.resource_access = defaultdict(int)
        self.privilege_changes = []

    def add_login(self, timestamp: datetime, ip: str):
        self.login_times.append({"timestamp": timestamp, "ip": ip})

    def add_activity(self, activity_type: str, resource: str, timestamp: datetime):
        self.activities.append({
            "type": activity_type,
            "resource": resource,
            "timestamp": timestamp
        })

    def add_data_transfer(self, amount: int, destination: str, timestamp: datetime):
        self.data_transfers.append({
            "amount": amount,
            "destination": destination,
            "timestamp": timestamp
        })


class InsiderThreatDetector:
    """Detects insider threats through behavioral analysis."""

    def __init__(self, sensitivity: str = "medium"):
        self.sensitivity = sensitivity
        self.users = {}
        self.baselines = {}
        self.alerts = []

        self.sensitivity_thresholds = {
            "low": {"data_transfer_mb": 5000, "login_deviation_hours": 6, "activity_deviation": 5},
            "medium": {"data_transfer_mb": 1000, "login_deviation_hours": 4, "activity_deviation": 3},
            "high": {"data_transfer_mb": 500, "login_deviation_hours": 2, "activity_deviation": 2}
        }

    def record_activity(self, user_id: str, activity_type: str, resource: str = "",
                       data_amount: int = 0, destination: str = "", ip: str = ""):
        """Record a user activity."""
        if user_id not in self.users:
            self.users[user_id] = UserActivity(user_id)

        user = self.users[user_id]

        if activity_type == "login":
            timestamp = datetime.now()
            user.add_login(timestamp, ip)
            self._check_login_anomaly(user_id)

        elif activity_type == "data_transfer":
            timestamp = datetime.now()
            user.add_data_transfer(data_amount, destination, timestamp)
            self._check_data_exfiltration(user_id, data_amount, destination)

        else:
            timestamp = datetime.now()
            user.add_activity(activity_type, resource, timestamp)
            self._check_activity_anomaly(user_id)

    def _check_login_anomaly(self, user_id: str):
        """Check for anomalous login patterns."""
        if user_id not in self.users:
            return

        user = self.users[user_id]
        if len(user.login_times) < 3:
            return

        threshold = self.sensitivity_thresholds[self.sensitivity]["login_deviation_hours"]

        recent = user.login_times[-5:]
        hours = [lt["timestamp"].hour for lt in recent]

        if max(hours) - min(hours) > threshold:
            self._alert(user_id, "LOGIN_ANOMALY",
                       f"Login times deviation > {threshold} hours",
                       severity="high")

    def _check_data_exfiltration(self, user_id: str, amount_mb: int, destination: str):
        """Check for suspicious data transfer."""
        threshold = self.sensitivity_thresholds[self.sensitivity]["data_transfer_mb"]

        if amount_mb > threshold:
            self._alert(user_id, "DATA_EXFILTRATION",
                       f"Large data transfer: {amount_mb} MB to {destination}",
                       severity="critical")

    def _check_activity_anomaly(self, user_id: str):
        """Check for unusual activity patterns."""
        if user_id not in self.users:
            return

        user = self.users[user_id]
        threshold = self.sensitivity_thresholds[self.sensitivity]["activity_deviation"]

        if len(user.activities) > threshold * 3:
            recent = user.activities[-threshold * 2:]
            types = [a["type"] for a in recent]
            unusual = set(types) - set(["login", "read", "write"])

            if unusual:
                self._alert(user_id, "ACTIVITY_ANOMALY",
                           f"Unusual activity types: {unusual}",
                           severity="medium")

    def _alert(self, user_id: str, alert_type: str, description: str, severity: str = "medium"):
        """Generate a security alert."""
        alert = {
            "timestamp": datetime.now().isoformat(),
            "user_id": user_id,
            "type": alert_type,
            "description": description,
            "severity": severity
        }
        self.alerts.append(alert)
        print(f"[ALERT] [{severity.upper()}] {alert_type} - User: {user_id}")
        print(f"        {description}")

    def build_baseline(self, user_id: str):
        """Build behavioral baseline for a user."""
        if user_id not in self.users:
            return

        user = self.users[user_id]
        baseline = {
            "avg_daily_logins": len(user.login_times) / max(1, (datetime.now() - datetime.now().replace(hour=0, minute=0, second=0)).days + 1),
            "common_hours": [lt["timestamp"].hour for lt in user.login_times[-30:]],
            "common_resources": list(user.resource_access.keys())[:10]
        }
        self.baselines[user_id] = baseline

    def generate_report(self) -> str:
        """Generate insider threat assessment report."""
        lines = ["=" * 60]
        lines.append("INSIDER THREAT DETECTION REPORT")
        lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"Sensitivity: {self.sensitivity}")
        lines.append("=" * 60)

        lines.append(f"\nUsers monitored: {len(self.users)}")
        lines.append(f"Total alerts: {len(self.alerts)}")

        critical = sum(1 for a in self.alerts if a["severity"] == "critical")
        high = sum(1 for a in self.alerts if a["severity"] == "high")
        medium = sum(1 for a in self.alerts if a["severity"] == "medium")

        lines.append(f"\nAlert Summary:")
        lines.append(f"  Critical: {critical}")
        lines.append(f"  High: {high}")
        lines.append(f"  Medium: {medium}")

        if self.alerts:
            lines.append("\n## Recent Alerts")
            for alert in self.alerts[-10:]:
                lines.append(f"\n  [{alert['timestamp']}] {alert['type']}")
                lines.append(f"  User: {alert['user_id']}")
                lines.append(f"  Severity: {alert['severity']}")
                lines.append(f"  {alert['description']}")

        lines.append("\n## Recommendations")
        lines.append("  1. Review critical alerts immediately")
        lines.append("  2. Interview users with anomalous behavior")
        lines.append("  3. Implement DLP solutions for sensitive data")
        lines.append("  4. Enable comprehensive logging on all systems")
        lines.append("  5. Conduct regular security awareness training")

        return "\n".join(lines)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Insider Threat Detection System")
    parser.add_argument("--monitor", action="store_true", help="Enable real monitoring")
    parser.add_argument("--logs", help="Log file to monitor")
    parser.add_argument("--sensitivity", choices=["low", "medium", "high"], default="medium")
    args = parser.parse_args()

    detector = InsiderThreatDetector(sensitivity=args.sensitivity)

    print("[*] Insider Threat Detection System initialized")
    print(f"[*] Sensitivity: {args.sensitivity}")

    import random
    test_users = ["jsmith", "mwilson", "admin"]
    activities = ["login", "file_access", "data_transfer", "privilege_change"]

    print("\n[*] Running simulation with test data...")
    for user in test_users:
        for _ in range(random.randint(5, 15)):
            activity = random.choice(activities)
            if activity == "login":
                detector.record_activity(user, "login", ip="192.168.1.100")
            elif activity == "data_transfer":
                detector.record_activity(user, "data_transfer", data_amount=random.randint(100, 3000),
                                       destination="external USB")
            else:
                detector.record_activity(user, activity, resource="/shared/sensitive")

    print("\n" + detector.generate_report())
