# Camera Security Assessment Tool
## EDUCATIONAL USE ONLY

**⚠️ WARNING: This tool is for authorized security testing and educational purposes ONLY. Unauthorized access to camera systems is illegal.**

---

### Overview

Security assessment tool for IP cameras and NVR systems. Identifies common vulnerabilities in surveillance infrastructure.

### Features

- **Camera Discovery**: Passive and active network scanning
- **Default Credential Check**: Tests common camera manufacturer defaults
- **RTSP Stream Analysis**: Checks stream authentication requirements
- **ONVIF Analysis**: Tests ONVIF protocol security
- **Firmware Version Detection**: Identifies outdated firmware
- **Report Generation**: Detailed security assessment reports

### Usage

```bash
# Basic scan
python3 camera_security.py --target 192.168.1.0/24

# Specific camera
python3 camera_security.py --target 192.168.1.100 --port 554

# Full report
python3 camera_security.py --target 192.168.1.0/24 --report report.txt
```

### Configuration

Edit the credentials list in `camera_security.py`:
```python
DEFAULT_CREDENTIALS = [
    ("admin", "admin"),
    ("admin", "123456"),
    ("admin", ""),
    ("viewer", "viewer"),
]
```

### Safe Testing

- Only test cameras YOU own or have written authorization for
- Never use default credentials on production systems without authorization
- Document all testing activities

---

**Author**: SecDev Project
**License**: Educational Use Only