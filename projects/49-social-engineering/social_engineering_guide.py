#!/usr/bin/env python3
"""
Social Engineering Toolkit - Project 49
Phishing and social engineering awareness.

EDUCATIONAL USE ONLY. Only use for authorized security awareness training.
"""

import os
import sys
import time
import random

def main():
    print("""
╔════════════════════════════════════════════════════════════════╗
║     Social Engineering Awareness - Project 49                  ║
║                                                                ║
║     EDUCATIONAL USE ONLY                                       ║
║     Only use for authorized security awareness training        ║
╚════════════════════════════════════════════════════════════════╝

WHAT IS SOCIAL ENGINEERING?

Manipulating people into:
- Giving up sensitive information
- Downloading malware
- Transferring money
- Bypassing security controls

COMMON ATTACK VECTORS:

| Vector | Description | Example |
|--------|-------------|---------|
| Phishing | Fake emails | CEO fraud |
| Vishing | Voice calls | Tech support scam |
| Smishing | SMS attacks | Fake bank alert |
| Impersonation | In-person | Tailgating |
| Pretexting | Fabricated scenario | IT support call |

PHISHING email ELEMENTS:

1. SENDER SPOOFING
   - Similar domain: admin@company-support.com vs admin@company.com
   - Display name manipulation: "IT Support" <fake@evil.com>

2. URGENCY
   - "Your account will be deleted!"
   - "Immediate action required"
   - "Urgent: Wire transfer needed"

3. FEAR
   - "Your account has been compromised!"
   - "Legal action pending"
   - "FBI investigation"

4. CURIOSITY
   - "Your invoice is attached"
   - "Exclusive deal inside"
   - "See who viewed your profile"

RED FLAGS TO TRAIN:

[ ] Unexpected email from unknown sender
[ ] Generic greeting ("Dear Customer")
[ ] Urgency or fear tactics
[ ] Request for sensitive data
[ ] Suspicious links (hover to check)
[ ] Spelling/grammar errors
[ ] Mismatched sender address
[ ] Unexpected attachments

SPEAR PHISHING:

Targeted attacks on specific individuals:
- Research target (LinkedIn, Facebook)
- Gather context (job role, projects)
- Craft personalized message
- Exploit trust relationships

CEO FRAUD (Business Email Compromise):

1. Research CFO/CEO on LinkedIn
2. Create similar email domain
3. Send urgent wire transfer request
4. Finance department transfers funds

DEFENSE TRAINING CHECKLIST:

[ ] Verify sender email address
[ ] Don't click, hover first
[ ] Check for spelling errors
[ ] Verify via separate channel
[ ] Report suspicious emails
[ ] Use MFA on all accounts
[ ] Regular security awareness training
[ ] Phishing simulations

REPORTING SUSPICIOUS EMAILS:

- Don't reply or click links
- Report to security team
- Forward as attachment (not forward)
- Delete after reporting

SECURITY AWARENESS TRAINING:

1. PHISHING SIMULATIONS
   - Send simulated phishing emails
   - Track click rates
   - Train those who fail
   
2. AWARENESS COURSES
   - Annual mandatory training
   - Scenario-based learning
   - Gamification

3. INCIDENT REPORTING
   - Easy reporting button
   - No blame culture
   - Quick feedback loop

COMMON SCAMS:

| Type | Red Flags |
|------|-----------|
| Tech Support | Unsolicited call, pop-up warning |
| IRS Scam | Threat of arrest, payment demanded |
| Grandparent | Grandchild in trouble, urgent money |
| Romance | Never meet, money requests |
| Lottery | You won!, processing fee |
| Romance | Long distance, never video chat |

HOW TO VERIFY:

1. Call the person directly (known number)
2. Ask security team
3. Check with manager
4. Verify via official channel

""")

if __name__ == "__main__":
    main()