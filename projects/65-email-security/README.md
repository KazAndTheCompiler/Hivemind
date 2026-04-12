# Email Security Assessment Tool
## EDUCATIONAL USE ONLY

**⚠️ WARNING: This tool is for authorized security testing and educational purposes ONLY.**

---

### Overview

Comprehensive email security assessment toolkit. Analyzes email infrastructure for vulnerabilities, SPF/DKIM/DMARC configuration issues, and phishing simulation.

### Features

- **SPF/DKIM/DMARC Analyzer**: Checks email authentication records
- **Email Header Analysis**: Deep inspection of email headers for security issues
- **Phishing Simulation**: Authorized phishing campaign testing
- **Email Gateway Testing**: Tests email security gateway effectiveness
- **Domain Configuration**: Verifies domain email security settings
- **Report Generation**: Detailed security assessment reports

### Usage

```bash
# Analyze domain email security
python3 email_security.py --domain example.com --analyze

# Analyze email headers
python3 email_security.py --headers "Full email headers..."

# Run phishing simulation
python3 email_security.py --phishing --targets target_list.txt

# Check domain for SPF/DKIM/DMARC
python3 email_security.py --check-auth example.com
```

### Configuration

Edit the SMTP settings in `email_security.py`:
```python
SMTP_CONFIG = {
    "relay": "mail.yourserver.com",
    "port": 587,
    "username": "your-user",
    "password": "your-password"
}
```

### ⚠️ Important

- Only run phishing simulations with explicit written authorization
- Never use this tool to impersonate entities without consent
- Follow all applicable laws and regulations regarding email testing

---

**Author**: SecDev Project
**License**: Educational Use Only