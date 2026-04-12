# Project 8: Simulate a phishing campaign for awareness

## ⚠️ CRITICAL LEGAL AND ETHICAL REQUIREMENTS

**This tool is STRICTLY for authorized internal security awareness training.**

Before using this toolkit, you MUST have:
- [ ] Written authorization from management
- [ ] Legal review of your country's laws on phishing simulations
- [ ] HR involvement in communication to employees
- [ ] Easy opt-out mechanism for employees
- [ ] Clear "This was a test" disclosure after the campaign

**Consequences of unauthorized use:**
- Criminal charges in many jurisdictions
- Immediate termination
- Civil lawsuits
- Regulatory fines

## Purpose

Phishing simulations are a legitimate and valuable security awareness tool. When done properly, they:
- Teach employees to recognize phishing attempts
- Measure organizational security awareness
- Identify users who need additional training
- Test incident response procedures

## How It Works

### Campaign Flow

1. **Create Campaign** - Define targets, template, timing
2. **Generate Emails** - Create realistic phishing emails
3. **Send to Test Group** - Measure who clicks
4. **Track Results** - Count clicks vs reports
5. **Generate Report** - Measure awareness levels
6. **Provide Training** - Help employees improve

### Phishing Templates

| Template | Scenario | Red Flags |
|----------|----------|-----------|
| Password Expiry | Fake password expiration | Urgency, generic greeting |
| Package Delivery | FedEx fake notification | Payment request, urgency |
| Account Suspension | Fake breach alert | Fear tactics, suspicious domain |
| Invoice Payment | Fake overdue invoice | Payment urgency, vendor impersonation |

## Quick Start

```bash
cd 08-phishing-simulation

# Create a test campaign
python3 phish_sim.py create "April Awareness Test" \
    -t password_expiry \
    -r employee1@company.com employee2@company.com

# Generate the phishing emails
python3 phish_sim.py generate CAMPAIGN_ID

# Check results
python3 phish_sim.py report CAMPAIGN_ID

# List all campaigns
python3 phish_sim.py list
```

## Red Flags to Teach

### Urgency Tactics
- "Act now!"
- "24 hours only"
- "Account will be suspended"

### Suspicious Elements
- Generic greetings ("Dear Customer")
- Spelling/grammar errors
- Mismatched URLs
- Unexpected attachments
- Requests for sensitive information

### Sender Analysis
- Spoofed domains (lookalike.com vs realcompany.com)
- Free email services for business matters
- Pressure to use personal email

## Awareness Metrics

| Metric | What It Measures |
|--------|-----------------|
| Click Rate | % of users who clicked the link |
| Report Rate | % of users who reported to IT |
| Ignore Rate | % who did neither |

### Target Rates

| Rate | Assessment |
|------|------------|
| < 5% click | Excellent awareness |
| 5-15% click | Normal, needs ongoing training |
| 15-30% click | Concerning, needs urgent training |
| > 30% click | Critical, comprehensive program needed |

## Ethical Campaign Guidelines

### BEFORE the Campaign

1. **Announce Training** - Let employees know security testing happens
2. **Set Clear Rules** - Define what's acceptable testing
3. **Prepare Response** - Have training ready for those who fail
4. **Get Sign-Off** - Management, HR, Legal all approve

### AFTER the Campaign

1. **Immediate Disclosure** - Announce "That was a test"
2. **No Shaming** - Focus on learning, not blame
3. **Offer Training** - Help employees improve
4. **Track Progress** - Measure improvement over time

### Communication Template

```
Subject: Upcoming Security Awareness Training

Starting [DATE], our IT team will conduct periodic phishing 
simulation exercises as part of our ongoing security training.

These are learning opportunities, not tests. If you receive a 
suspicious email that looks like phishing, report it to [CONTACT].

If you click on a simulated phishing link, don't worry - you'll 
automatically receive brief training materials.

Our goal is to keep everyone informed, not to get anyone in trouble.

Questions? Contact [IT SECURITY EMAIL]
```

## What NOT To Do

- [ ] Send to executives without warning
- [ ] Use real-looking but fake government credentials
- [ ] Threaten employees who click
- [ ] Test on contractors without their company's approval
- [ ] Exceed the scope of authorized testing
- [ ] Track clicks for punishment rather than training

## Files

```
08-phishing-simulation/
├── phish_sim.py       # Main simulation toolkit
├── README.md         # This file
└── data/
    ├── campaigns.json  # Campaign tracking
    └── emails/         # Generated phishing emails
```

## Real Professional Tools

For production use, consider:
- **KnowBe4** - Comprehensive phishing platform
- **Proofpoint** - Enterprise security awareness
- **Cofense** - Phishing detection and response
- **Mimecast** - Email security with simulation

These provide better tracking, reporting, and training integration.
