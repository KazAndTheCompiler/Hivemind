# Project 5: Learn digital forensic analysis skills

## Overview

A comprehensive digital forensics toolkit demonstrating core forensic techniques for analyzing files and disk images.

## ⚠️ Legal Warning

**Only use this on:**
- Files you own
- Systems you have explicit written permission to analyze
- Educational and training environments

**Never use this for:**
- Unauthorized analysis of others' data
- Examining files obtained illegally
- Any form of unauthorized surveillance

## Techniques Demonstrated

### 1. File Signature Detection
Identifies file types by examining "magic bytes" - the first few bytes that uniquely identify file formats.

| Signature | File Type |
|-----------|-----------|
| `\x89PNG\r\n\x1a\n` | PNG image |
| `\xff\xd8\xff` | JPEG image |
| `PK\x03\x04` | ZIP archive |
| `%PDF` | PDF document |
| `\x7fELF` | Linux executable |
| `MZ` | Windows executable |

### 2. Cryptographic Hashing
Calculates MD5, SHA1, and SHA256 hashes for:
- File integrity verification
- Known malware comparison (VirusTotal, etc.)
- Evidence authentication

### 3. Metadata Extraction
Extracts filesystem metadata:
- Creation, modification, access times
- File size
- Permissions
- Symlink status

### 4. String Extraction
Pulls readable ASCII/Unicode strings from binary files to find:
- URLs and IP addresses
- File paths
- Configuration data
- Embedded messages

### 5. File Carving
Extracts files from raw disk images based on:
- Known header/footer markers
- File structure analysis
- No filesystem metadata required

## Quick Start

```bash
cd 05-digital-forensics

# Analyze a single file
python3 forensics.py suspicious.pdf

# Full analysis with report
python3 forensics.py evidence.img -o report.json

# Carve files from disk image
python3 forensics.py disk.img --carve --carve-dir extracted/

# Analyze a directory
python3 forensics.py /path/to/evidence/ -o directory_report.json
```

## Sample Output

```
[*] Target: suspicious.pdf

[*] Calculating hashes...
    MD5: d41d8cd98f00b204e9800998ecf8427e
    SHA1: da39a3ee5e6b4b0d3255bfef95601890afd80709
    SHA256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855

[*] Detecting file type...
    Detected: PDF (application/pdf)

[*] Extracting metadata...
    size_bytes: 1024567
    created: 2026-04-10T15:30:00+00:00
    modified: 2026-04-11T08:45:00+00:00
    permissions: 644

[*] Extracting strings (min length: 4)...
    Found 156 unique strings
        /Type /Page
        /Producer (Acrobat Distiller)
        http://example.com/malware.zip
```

## Common Forensic Use Cases

1. **Incident Response** - Analyzing compromised systems
2. **Malware Analysis** - Identifying and extracting malicious code
3. **E-Discovery** - Legal evidence gathering
4. **Data Recovery** - Retrieving deleted files
5. **Chain of Custody** - Proving file integrity

## Professional Tools (For Reference)

- **The Sleuth Kit (TSK)** - Filesystem forensics
- **Autopsy** - GUI for TSK
- **Volatility** - Memory forensics
- **FTK** - Comprehensive forensic toolkit
- **EnCase** - Enterprise forensic platform
- **X-Ways Forensics** - Advanced disk analysis

## Digital Evidence Principles

1. **Chain of Custody** - Document who had access at all times
2. **Write Protection** - Never work on original evidence
3. **Hash Verification** - Prove evidence wasn't modified
4. **Timelines** - Reconstruct events from timestamps
5. **Multiple Copies** - Always work from copies

## Files

```
05-digital-forensics/
├── forensics.py       # Main forensic toolkit
├── README.md         # This file
├── carved/          # Carved files output
└── report.json       # Analysis report (generated)
```
