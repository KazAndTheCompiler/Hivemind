# Threat Intelligence Platform
## EDUCATIONAL USE ONLY

**⚠️ WARNING: This tool is for authorized security testing and educational purposes ONLY. Unauthorized access to systems is illegal.**

---

### Overview

Threat intelligence aggregation platform that collects, correlates, and analyzes indicators of compromise (IOCs) from multiple sources.

### Features

- **MISP Integration**: Connect to MISP instances for IOC sharing
- **AlienVault OTX**: Pull pulse data from Open Threat Exchange
- **MITRE ATT&CK**: Map IOCs to attack frameworks
- **IOC Enrichment**: VirusTotal, AbuseIPDB lookups
- **Dashboard**: Visual threat landscape overview

### Setup

```bash
# Install dependencies
pip install requests scheduled polling schedule

# Configure API keys in threat_intel.py
MISP_KEY = "your-misp-api-key"
OTX_KEY = "your-otx-api-key"
VT_KEY = "your-virustotal-api-key"

# Run
python3 threat_intel.py
```

### Configuration

Edit the API keys section in `threat_intel.py`:
```python
CONFIG = {
    "misp_url": "https://your-misp-instance/events",
    "misp_key": "YOUR_MISP_KEY",
    "otx_key": "YOUR_OTX_KEY",
    "vt_key": "YOUR_VIRUSTOTAL_KEY",
    "min_score": 50  # Minimum threat score to include
}
```

### Dashboard

Run the dashboard:
```bash
python3 dashboard.py
```

Access at: `http://localhost:5000`

---

**Author**: SecDev Project
**License**: Educational Use Only