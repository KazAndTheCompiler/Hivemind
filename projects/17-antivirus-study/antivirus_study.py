#!/usr/bin/env python3
"""
Antivirus Study Guide - Project 17
Understanding how antivirus software works.

EDUCATIONAL USE ONLY. For understanding AV detection mechanisms.
"""

import hashlib
import struct
import os
from pathlib import Path
from typing import List, Dict, Optional

class AntivirusConcepts:
    """Study guide for antivirus detection methods."""
    
    @staticmethod
    def calculate_file_hash(file_path: str) -> Dict[str, str]:
        """Calculate multiple hashes of a file."""
        md5 = hashlib.md5()
        sha1 = hashlib.sha1()
        sha256 = hashlib.sha256()
        
        with open(file_path, "rb") as f:
            while chunk := f.read(8192):
                md5.update(chunk)
                sha1.update(chunk)
                sha256.update(chunk)
        
        return {
            "md5": md5.hexdigest(),
            "sha1": sha1.hexdigest(),
            "sha256": sha256.hexdigest()
        }
    
    @staticmethod
    def detect_entropy(data: bytes) -> float:
        """Calculate Shannon entropy to detect UPX/obfuscated files."""
        if not data:
            return 0.0
        
        frequency = [0] * 256
        for byte in data:
            frequency[byte] += 1
        
        entropy = 0.0
        length = len(data)
        
        for count in frequency:
            if count > 0:
                probability = count / length
                entropy -= probability * (probability.bit_length() - 1)
        
        return entropy
    
    @staticmethod
    def detect_pe_signatures(data: bytes) -> List[Dict]:
        """Detect common PE (Windows executable) signatures."""
        signatures = []
        
        # MZ header (DOS stub)
        if data[:2] == b'MZ':
            signatures.append({
                "name": "MZ Header (PE Executable)",
                "offset": 0,
                "description": "Standard Windows executable marker"
            })
        
        # PE header
        pe_offset = struct.unpack("<I", data[60:64])[0] if len(data) > 64 else 0
        if pe_offset > 0 and pe_offset < len(data) - 4:
            if data[pe_offset:pe_offset+4] == b'PE\x00\x00':
                signatures.append({
                    "name": "PE Header",
                    "offset": pe_offset,
                    "description": "Portable Executable format marker"
                })
        
        # Common suspicious imports
        suspicious_imports = [
            (b'GetProcAddress', 'GetProcAddress - Dynamic API resolution'),
            (b'LoadLibrary', 'LoadLibrary - DLL loading'),
            (b'VirtualAlloc', 'VirtualAlloc - Memory allocation'),
            (b'WriteProcessMemory', 'WriteProcessMemory - Process injection'),
            (b'CreateRemoteThread', 'CreateRemoteThread - Code injection'),
            (b'URLDownloadToFile', 'URLDownloadToFile - Suspicious download'),
            (b'WinExec', 'WinExec - Shell execution'),
        ]
        
        for pattern, desc in suspicious_imports:
            if pattern in data:
                signatures.append({
                    "name": "Suspicious Import",
                    "detail": desc,
                    "description": "Potentially malicious imported function"
                })
        
        # Strings analysis
       Suspicious_strings = [
            (b'http://', 'HTTP URL - Network activity'),
            (b'cmd.exe', 'Command execution'),
            (b'powershell', 'PowerShell - Script execution'),
            (b'\\temp\\', 'Temp directory access'),
            (b'\\System32\\', 'System32 access'),
        ]
        
        for pattern, desc in Suspicious_strings:
            if pattern in data.lower():
                signatures.append({
                    "name": "Suspicious String",
                    "detail": desc,
                    "description": "Indicates potentially malicious behavior"
                })
        
        return signatures
    
    @staticmethod
    def scan_file(file_path: str) -> Dict:
        """Scan a file for suspicious characteristics."""
        result = {
            "file": file_path,
            "size": os.path.getsize(file_path),
            "hashes": {},
            "entropy": 0.0,
            "signatures": [],
            "warnings": []
        }
        
        # Calculate hashes
        result["hashes"] = AntivirusConcepts.calculate_file_hash(file_path)
        
        # Read file for analysis
        with open(file_path, "rb") as f:
            data = f.read(1024 * 1024)  # First 1MB
        
        # Check entropy
        result["entropy"] = AntivirusConcepts.detect_entropy(data)
        
        if result["entropy"] > 7.0:
            result["warnings"].append("High entropy - possibly packed/encrypted")
        
        if result["entropy"] < 3.0:
            result["warnings"].append("Very low entropy - possibly benign")
        
        # PE analysis
        if data[:2] == b'MZ':
            result["signatures"] = AntivirusConcepts.detect_pe_signatures(data)
        
        # Size check
        if result["size"] > 10 * 1024 * 1024:
            result["warnings"].append("Large file - may be stage 1 loader")
        
        if result["size"] < 1000:
            result["warnings"].append("Very small file - may be dropper")
        
        return result

def main():
    print("""
╔════════════════════════════════════════════════════════════════╗
║     Antivirus Study Guide - Project 17                        ║
║                                                                ║
║     Understanding AV detection mechanisms                     ║
╚════════════════════════════════════════════════════════════════╝

This module teaches how antivirus software works:

1. SIGNATURE DETECTION
   - MD5/SHA1 hashes of known malware
   - YARA rules
   - PE header signatures

2. HEURISTIC ANALYSIS
   - Entropy calculation (packed = high entropy)
   - Suspicious API calls
   - Abnormal file locations

3. BEHAVIORAL ANALYSIS
   - Sandbox execution
   - System call monitoring
   - Network activity detection

4. REPUTATION
   - File hash databases (VirusTotal)
   - Certificate validation
   - Publisher trust

COMMON DETECTION METHODS:

| Method | What It Detects |
|--------|-----------------|
| Hash matching | Known malware by exact hash |
| String scanning | Suspicious URLs, commands |
| PE analysis | Import tables, sections |
| Entropy | Packed/encrypted payloads |
| Sandbox | Malicious behavior when run |

YARA RULE EXAMPLE:

rule Suspicious_PE {
    strings:
        $mz = "MZ"
        $pe = "PE"
        $cmd = "cmd.exe"
    condition:
        $mz and $pe and $cmd
}

TOOLS FOR ANALYSIS:

- VirusTotal (virustotal.com) - Hash lookup
- YARA - Pattern matching
- PEStudio - PE analysis
- Detect It Easy (DiE) - Entropy/packing detection
- REMnux - Malware analysis Linux distro
""")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
        if Path(file_path).exists():
            result = AntivirusConcepts.scan_file(file_path)
            print(f"\n[+] Scan Results for {file_path}")
            print(f"    Size: {result['size']} bytes")
            print(f"    Entropy: {result['entropy']:.2f}")
            print(f"    SHA256: {result['hashes'].get('sha256', 'N/A')}")
            
            if result['warnings']:
                print("\nWarnings:")
                for w in result['warnings']:
                    print(f"    [!] {w}")
            
            if result['signatures']:
                print("\nSignatures Found:")
                for s in result['signatures']:
                    print(f"    [*] {s['name']}: {s.get('detail', s.get('description', ''))}")
        else:
            print(f"[!] File not found: {file_path}")
    else:
        print("\nUsage: python3 antivirus_study.py <file_to_analyze>")
