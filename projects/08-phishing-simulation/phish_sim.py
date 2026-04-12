#!/usr/bin/env python3
"""
Phishing Awareness Simulation Toolkit - Project 8
Create simulated phishing campaigns for security awareness training.

STRICTLY FOR INTERNAL SECURITY AWARENESS TRAINING.
Must have explicit authorization from management before use.
"""

import os
import json
import datetime
import hashlib
import secrets
import argparse
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict

# Email templates for different phishing scenarios
PHISHING_TEMPLATES = {
    "password_expiry": {
        "name": "Password Expiry Alert",
        "subject": "URGENT: Your password expires in 24 hours",
        "from": "it-support@YOURCOMPANY.com",
        "body": """Dear {recipient_name},

Your password will expire in 24 hours.

To keep your account secure, please verify your credentials immediately:

[Verify Now]({phishing_link})

If you do not update your password, your account will be locked.

IT Department
""",
        "red_flags": [
            "Urgency tactics",
            "Generic greeting",
            "Suspicious link URL",
            "Threat of account lockout"
        ]
    },
    
    "package_delivery": {
        "name": "Package Delivery Notification", 
        "subject": "FedEx: Your package is waiting",
        "from": "delivery@fedex-notification.com",
        "body": """Hello {recipient_name},

Your package could not be delivered.

Tracking Number: {tracking_id}
Status: Held at customs - action required

Please confirm your shipping address and pay the customs fee:

[Confirm Details]({phishing_link})

Package will be returned to sender if not claimed within 48 hours.

FedEx Customer Service
""",
        "red_flags": [
            "Generic greeting",
            "Creates false urgency",
            "Requests payment information",
            "Suspicious sender domain"
        ]
    },
    
    "account_suspension": {
        "name": "Account Suspension Warning",
        "subject": "ALERT: Unusual sign-in activity detected",
        "from": "security@YOURBANK-SECURE.com",
        "body": """Dear {recipient_name},

We detected unusual sign-in activity on your account.

Location: {fake_location}
Device: Unknown
Time: {fake_time}

If this wasn't you, your account will be suspended:

[Secure My Account]({phishing_link})

Please verify your identity within 24 hours or lose access.

Security Team
""",
        "red_flags": [
            "Spoofed sender address",
            "Creates fear/anxiety",
            "Requests immediate action",
            "Vague location/device info"
        ]
    },
    
    "invoice_payment": {
        "name": "Outstanding Invoice",
        "subject": "RE: Invoice #{invoice_id} - Payment Overdue",
        "from": "accounts@VENDOR-NOTICE.com", 
        "body": """Dear {recipient_name},

This is a reminder that Invoice #{invoice_id} is now 30 days overdue.

Amount Due: ${amount}
Due Date: {due_date}

Please process this payment immediately to avoid service interruption:

[Pay Invoice]({phishing_link})

If you believe this email was sent in error, please contact our billing department.

Accounts Receivable
""",
        "red_flags": [
            "Creates payment urgency",
            "Requests immediate payment",
            "Suspicious vendor domain",
            "No direct contact information"
        ]
    }
}

@dataclass
class Campaign:
    """Phishing campaign tracking."""
    id: str
    name: str
    template: str
    start_date: str
    recipients: List[str]
    phishing_links: Dict[str, str]  # email -> link
    clicks: List[Dict]
    reports: List[str]  # emails who reported it
    
    def to_dict(self):
        return asdict(self)

class PhishSimulator:
    """Phishing awareness campaign manager."""
    
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.campaigns_file = data_dir / "campaigns.json"
        self.campaigns = self._load_campaigns()
    
    def _load_campaigns(self) -> Dict:
        if self.campaigns_file.exists():
            with open(self.campaigns_file) as f:
                return json.load(f)
        return {}
    
    def _save_campaigns(self):
        with open(self.campaigns_file, "w") as f:
            json.dump(self.campaigns, f, indent=2)
    
    def generate_tracking_id(self) -> str:
        """Generate unique campaign ID."""
        return hashlib.sha256(secrets.token_bytes(32)).hexdigest()[:12].upper()
    
    def generate_phishing_link(self, campaign_id: str, email: str) -> str:
        """Generate tracking link for a recipient."""
        token = hashlib.sha256(f"{campaign_id}:{email}".encode()).hexdigest()[:16]
        return f"https://YOURTRAINING.internal/phish/click?id={campaign_id}&t={token}"
    
    def create_campaign(self, name: str, template_key: str, 
                       recipients: List[str], start_date: Optional[str] = None) -> Campaign:
        """Create a new phishing awareness campaign."""
        campaign_id = self.generate_tracking_id()
        
        if start_date is None:
            start_date = datetime.datetime.now(datetime.timezone.utc).isoformat()
        
        # Generate unique links per recipient
        links = {email: self.generate_phishing_link(campaign_id, email) 
                 for email in recipients}
        
        campaign = Campaign(
            id=campaign_id,
            name=name,
            template=template_key,
            start_date=start_date,
            recipients=recipients,
            phishing_links=links,
            clicks=[],
            reports=[]
        )
        
        self.campaigns[campaign_id] = campaign.to_dict()
        self._save_campaigns()
        
        return campaign
    
    def generate_emails(self, campaign: Campaign) -> List[Dict]:
        """Generate phishing emails for a campaign."""
        template = PHISHING_TEMPLATES.get(campaign.template, PHISHING_TEMPLATES["password_expiry"])
        
        emails = []
        for email in campaign.recipients:
            # Extract name from email
            name = email.split("@")[0].replace(".", " ").title()
            
            # Generate fake context
            context = {
                "recipient_name": name,
                "phishing_link": campaign.phishing_links[email],
                "tracking_id": secrets.token_hex(4).upper(),
                "fake_location": secrets.choice(["Moscow, Russia", "Beijing, China", "Unknown"]),
                "fake_time": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
                "invoice_id": secrets.randbelow(90000) + 10000,
                "amount": f"{secrets.randbelow(900) + 100}.00",
                "due_date": (datetime.datetime.now() - datetime.timedelta(days=30)).strftime("%Y-%m-%d")
            }
            
            body = template["body"].format(**context)
            
            emails.append({
                "to": email,
                "from": template["from"],
                "subject": template["subject"],
                "body": body,
                "red_flags": template["red_flags"],
                "tracking_link": campaign.phishing_links[email]
            })
        
        return emails
    
    def track_click(self, campaign_id: str, token: str) -> bool:
        """Record a click on a phishing link."""
        if campaign_id not in self.campaigns:
            return False
        
        campaign = self.campaigns[campaign_id]
        campaign["clicks"].append({
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "token": token
        })
        
        self._save_campaigns()
        return True
    
    def track_report(self, campaign_id: str, email: str):
        """Record a user reporting the phishing email (good behavior!)."""
        if campaign_id not in self.campaigns:
            return False
        
        if email not in self.campaigns[campaign_id]["reports"]:
            self.campaigns[campaign_id]["reports"].append(email)
            self._save_campaigns()
        return True
    
    def get_campaign_stats(self, campaign_id: str) -> Optional[Dict]:
        """Get statistics for a campaign."""
        if campaign_id not in self.campaigns:
            return None
        
        campaign = self.campaigns[campaign_id]
        total_recipients = len(campaign["recipients"])
        clicks = len(campaign["clicks"])
        reports = len(campaign["reports"])
        
        return {
            "campaign_id": campaign_id,
            "name": campaign["name"],
            "total_recipients": total_recipients,
            "clicks": clicks,
            "click_rate": f"{(clicks/total_recipients*100):.1f}%" if total_recipients else "0%",
            "reports": reports,
            "report_rate": f"{(reports/total_recipients*100):.1f}%" if total_recipients else "0%",
            "ignored": total_recipients - clicks - reports,
            "ignored_rate": f"{((total_recipients-clicks-reports)/total_recipients*100):.1f}%" if total_recipients else "0%"
        }
    
    def generate_report(self, campaign_id: str) -> str:
        """Generate a formatted awareness report."""
        stats = self.get_campaign_stats(campaign_id)
        if not stats:
            return "Campaign not found."
        
        campaign = self.campaigns[campaign_id]
        template_info = PHISHING_TEMPLATES.get(campaign["template"], {})
        
        report = f"""
╔════════════════════════════════════════════════════════════════╗
║     PHISHING AWARENESS CAMPAIGN REPORT                         ║
╚════════════════════════════════════════════════════════════════╝

Campaign: {stats['name']}
Campaign ID: {campaign_id}
Template: {template_info.get('name', 'Unknown')}
Started: {campaign['start_date']}

────────────────────────────────────────────────────────────────
AWARENESS METRICS
────────────────────────────────────────────────────────────────

Total Recipients:     {stats['total_recipients']}
Clicked Link:         {stats['clicks']} ({stats['click_rate']})
Reported to IT:       {stats['reports']} ({stats['report_rate']})
No Action Taken:      {stats['ignored']} ({stats['ignored_rate']})

────────────────────────────────────────────────────────────────
RED FLAGS IN TEMPLATE
────────────────────────────────────────────────────────────────

"""
        
        for flag in template_info.get("red_flags", []):
            report += f"  • {flag}\n"
        
        report += """
────────────────────────────────────────────────────────────────
RECOMMENDATIONS
────────────────────────────────────────────────────────────────

"""
        
        click_rate = int(stats['click_rate'].replace('%', ''))
        if click_rate > 20:
            report += "[!] HIGH RISK: Over 20% click rate suggests training needed.\n"
        elif click_rate > 5:
            report += "[~] MODERATE: Some users fell for phishing, consider refresher training.\n"
        else:
            report += "[+] GOOD: Low click rate indicates good awareness.\n"
        
        report += "\n[+] Consider recognizing employees who reported the phishing email.\n"
        
        return report

def main():
    parser = argparse.ArgumentParser(description="Phishing Awareness Simulator")
    subparsers = parser.add_subparsers(dest="command")
    
    # Create campaign
    create_parser = subparsers.add_parser("create", help="Create a phishing campaign")
    create_parser.add_argument("name", help="Campaign name")
    create_parser.add_argument("-t", "--template", default="password_expiry",
                              choices=list(PHISHING_TEMPLATES.keys()),
                              help="Phishing template to use")
    create_parser.add_argument("-r", "--recipients", nargs="+", required=True,
                              help="Recipient email addresses")
    
    # List campaigns
    list_parser = subparsers.add_parser("list", help="List all campaigns")
    
    # Generate emails
    gen_parser = subparsers.add_parser("generate", help="Generate phishing emails")
    gen_parser.add_argument("campaign_id", help="Campaign ID")
    
    # Show report
    report_parser = subparsers.add_parser("report", help="Show campaign report")
    report_parser.add_argument("campaign_id", help="Campaign ID")
    
    # Simulate click (for testing)
    click_parser = subparsers.add_parser("simulate-click", help="Simulate a click")
    click_parser.add_argument("campaign_id", help="Campaign ID")
    
    args = parser.parse_args()
    
    if args.command is None:
        print("""
╔════════════════════════════════════════════════════════════════╗
║     Phishing Awareness Simulation Toolkit - Project 8         ║
║                                                                ║
║     STRICTLY FOR INTERNAL SECURITY AWARENESS TRAINING        ║
║     Requires management authorization before use               ║
╚════════════════════════════════════════════════════════════════╝

Usage:
  python3 phish_sim.py create "April Training" -t password_expiry -r user1@company.com user2@company.com
  python3 phish_sim.py list
  python3 phish_sim.py generate CAMPAIGN_ID
  python3 phish_sim.py report CAMPAIGN_ID

Available Templates:
  password_expiry    - Fake password expiration warning
  package_delivery   - Fake FedEx delivery notification
  account_suspension - Fake account breach alert
  invoice_payment    - Fake overdue invoice

WARNING: Only use on accounts you own or have explicit permission to test.
        """)
        return
    
    data_dir = Path(__file__).parent / "data"
    sim = PhishSimulator(data_dir)
    
    if args.command == "create":
        campaign = sim.create_campaign(args.name, args.template, args.recipients)
        print(f"[+] Created campaign: {campaign.id}")
        print(f"    Template: {args.template}")
        print(f"    Recipients: {len(args.recipients)}")
        
    elif args.command == "list":
        if not sim.campaigns:
            print("[*] No campaigns created yet.")
        for cid, camp in sim.campaigns.items():
            print(f"\n{cid}: {camp['name']}")
            stats = sim.get_campaign_stats(cid)
            if stats:
                print(f"    Clicks: {stats['clicks']} | Reports: {stats['reports']}")
    
    elif args.command == "generate":
        if args.campaign_id not in sim.campaigns:
            print("[!] Campaign not found")
            return
        
        campaign = Campaign(**sim.campaigns[args.campaign_id])
        emails = sim.generate_emails(campaign)
        
        output_dir = data_dir / "emails" / args.campaign_id
        output_dir.mkdir(parents=True, exist_ok=True)
        
        for i, email in enumerate(emails):
            with open(output_dir / f"email_{i+1}.txt", "w") as f:
                f.write(f"To: {email['to']}\n")
                f.write(f"From: {email['from']}\n")
                f.write(f"Subject: {email['subject']}\n")
                f.write(f"\n{email['body']}\n")
        
        print(f"[+] Generated {len(emails)} emails in {output_dir}/")
        
    elif args.command == "report":
        print(sim.generate_report(args.campaign_id))

if __name__ == "__main__":
    main()
