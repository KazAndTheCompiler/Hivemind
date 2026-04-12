#!/usr/bin/env python3
"""
Insider Threat Detection Framework - Project 64
Behavioral analysis for insider threat detection.

EDUCATIONAL USE ONLY. For authorized security monitoring.
"""

import os
import sys
import json
from typing import Dict, List
from datetime import datetime, timedelta

class InsiderThreatDetector:
    """Behavioral analysis for insider threats."""
    
    RISK_BEHAVIORS = {
        'data_exfiltration': [
            {'pattern': 'large_upload', 'threshold': '100MB in 1 hour'},
            {'pattern': 'usb_transfer', 'threshold': 'Multiple large transfers'},
            {'pattern': 'cloud_upload', 'threshold': 'Non-approved cloud service'},
        ],
        'privilege_abuse': [
            {'pattern': 'unauthorized_access', 'threshold': 'Access to sensitive files'},
            {'pattern': 'permission_change', 'threshold': 'Self-elevation'},
            {'pattern': 'service_creation', 'threshold': 'New admin account'},
        ],
        'sabotage': [
            {'pattern': 'data_deletion', 'threshold': 'Large batch deletion'},
            {'pattern': 'system_modification', 'threshold': 'Security settings changed'},
            {'pattern': 'service_stop', 'threshold': 'Backup/antivirus disabled'},
        ],
        'credential_theft': [
            {'pattern': 'unusual_login', 'threshold': 'Off-hours admin access'},
            {'pattern': 'location_anomaly', 'threshold': 'Login from new location'},
            {'pattern': 'multiple_failures', 'threshold': '5+ failed logins'},
        ]
    }
    
    def __init__(self):
        self.user_baseline = {}
        self.alerts = []
    
    def profile_user(self, user_id: str, activities: List[Dict]) -> Dict:
        """Build behavioral profile for user."""
        profile = {
            'user_id': user_id,
            'typical_hours': set(),
            'typical_locations': set(),
            'typical_data_access': set(),
            'typical_volumes': {},
            'risk_score': 0
        }
        
        for activity in activities:
            if activity.get('timestamp'):
                hour = datetime.fromisoformat(activity['timestamp']).hour
                profile['typical_hours'].add(hour)
            
            if activity.get('location'):
                profile['typical_locations'].add(activity['location'])
            
            if activity.get('data_type'):
                profile['typical_data_access'].add(activity['data_type'])
        
        return profile
    
    def detect_anomaly(self, user_id: str, activity: Dict, baseline: Dict) -> Dict:
        """Detect if activity is anomalous."""
        risk_factors = []
        
        # Time anomaly
        if activity.get('timestamp'):
            hour = datetime.fromisoformat(activity['timestamp']).hour
            if hour not in baseline.get('typical_hours', {hour}):
                risk_factors.append({
                    'type': 'time_anomaly',
                    'description': f'Activity at unusual hour: {hour}:00',
                    'severity': 'medium'
                })
        
        # Location anomaly
        if activity.get('location'):
            if activity['location'] not in baseline.get('typical_locations', set()):
                risk_factors.append({
                    'type': 'location_anomaly',
                    'description': f'Login from new location: {activity["location"]}',
                    'severity': 'high'
                })
        
        # Data volume anomaly
        if activity.get('data_volume'):
            if activity['data_volume'] > 1000000000:  # 1GB
                risk_factors.append({
                    'type': 'volume_anomaly',
                    'description': f'Unusually large data transfer: {activity["data_volume"]} bytes',
                    'severity': 'high'
                })
        
        # Privilege anomaly
        if activity.get('privileged_action') and not baseline.get('is_admin', False):
            risk_factors.append({
                'type': 'privilege_anomaly',
                'description': 'Non-admin performed privileged action',
                'severity': 'critical'
            })
        
        severity_weights = {'critical': 10, 'high': 5, 'medium': 1, 'low': 1}
        risk_score = sum(severity_weights.get(f.get('severity', 'low'), 1) for f in risk_factors)
        
        return {
            'user_id': user_id,
            'activity': activity,
            'risk_factors': risk_factors,
            'risk_score': risk_score,
            'timestamp': datetime.now().isoformat()
        }
    
    def generate_alert(self, detection: Dict) -> str:
        """Generate alert from detection."""
        severity_colors = {
            'critical': 'RED',
            'high': 'ORANGE',
            'medium': 'YELLOW'
        }
        
        score = detection['risk_score']
        if score >= 10:
            severity = 'critical'
        elif score >= 5:
            severity = 'high'
        else:
            severity = 'medium'
        
        color = severity_colors.get(severity, 'WHITE')
        
        msg = f"""
INSIDER THREAT ALERT
{'=' * 50}

SEVERITY: {severity.upper()} ({color})
User: {detection['user_id']}
Risk Score: {score}
Time: {detection['timestamp']}

Risk Factors:
"""
        
        for factor in detection['risk_factors']:
            msg += f"  - {factor['description']} ({factor['severity']})\n"
        
        return msg

def main():
    print("""
INSIDER THREAT DETECTION - Project 64

EDUCATIONAL USE ONLY
For authorized security monitoring only

INSIDER THREAT CATEGORIES:

1. MALICIOUS INSIDER
   - Employee stealing data
   - Sabotaging systems
   - Selling credentials

2. NEGLIGENT INSIDER
   - Clicking phishing links
   - Sharing credentials
   - Ignoring security policies

3. COMPROMISED INSIDER
   - Credentials stolen by external actor
   - Malware on workstation
   - Session hijacking

DETECTION METHODS:

| Method | What It Catches |
|--------|----------------|
| DLP (Data Loss Prevention) | Large data transfers |
| UEBA (User Entity Behavior Analytics) | Anomalous behavior |
| CASB (Cloud Access Security Broker) | Shadow IT |
| SIEM Correlation | Pattern detection |

KEY INDICATORS:

DATA EXFILTRATION:
- Large uploads to personal cloud
- USB device usage
- Email to personal addresses
- Access to unusual files

PRIVILEGE ABUSE:
- Accessing files outside role
- Account modifications
- Service account usage

SABOTAGE:
- Service disruption
- Security settings changed
- Backup deletion

BEHAVIORAL BASELINES:

For each user, track:
- Normal work hours
- Typical locations
- Common file access
- Data transfer volumes
- Command usage patterns

ANOMALY SCORING:

Risk scores based on:
- Severity of risk factor
- Number of anomalies
- Time since baseline deviation
- Correlation with other alerts

RESPONSE PLAYBOOK:

CRITICAL (Score >= 10):
1. Isolate user session
2. Disable accounts
3. Escalate to security team
4. Preserve evidence

HIGH (Score >= 5):
1. Alert security analyst
2. Monitor user activity
3. Interview supervisor
4. Document findings

MEDIUM (Score >= 1):
1. Log for investigation
2. Schedule review
3. Add to watch list

TOOLS FOR INSIDER THREAT:

- Splunk UBA
- Microsoft Defender for Insider
- Code42
- Digital Guardian
- Forcepoint

LEGAL CONSIDERATIONS:

- Privacy regulations (GDPR, CCPA)
- Employee monitoring policies
- Audit requirements
- Chain of custody

SECURITY CHECKLIST:

[ ] DLP deployed
[ ] UEBA configured
[ ] Logging enabled (all activities)
[ ] Baseline profiles created
[ ] Anomaly detection tuned
[ ] Response playbooks documented
[ ] Legal review completed
[ ] Employee notification policy

""")
    
    detector = InsiderThreatDetector()
    
    # Demo
    print("\n[*] Running demo detection...\n")
    
    demo_user = 'user123'
    demo_activity = {
        'timestamp': datetime.now().isoformat(),
        'action': 'large_upload',
        'data_volume': 5000000000,
        'destination': 'personal-cloud.com',
        'location': 'Foreign Country'
    }
    
    baseline = {
        'typical_hours': {9, 10, 11, 12, 13, 14, 15, 16, 17},
        'typical_locations': {'Office', 'Home'},
        'typical_data_access': {'documents', 'spreadsheets'},
        'is_admin': False
    }
    
    detection = detector.detect_anomaly(demo_user, demo_activity, baseline)
    print(f"User: {detection['user_id']}")
    print(f"Risk Score: {detection['risk_score']}")
    print(f"Risk Factors: {len(detection['risk_factors'])}")

if __name__ == "__main__":
    main()
