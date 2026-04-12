#!/usr/bin/env python3
"""
Binary Analysis Framework - Project 43
Static and dynamic analysis for compiled binaries.

EDUCATIONAL USE ONLY. Only analyze binaries you have permission to study.
"""

import os
import sys
import subprocess
import hashlib
from pathlib import Path
from typing import Dict, List, Optional

class BinaryAnalyzer:
    """Binary analysis framework."""
    
    def __init__(self, binary_path: str):
        self.binary_path = binary_path
        self.results = {}
    
    def calculate_hashes(self) -> Dict[str, str]:
        """Calculate file hashes."""
        hashes = {}
        
        with open(self.binary_path, 'rb') as f:
            data = f.read()
        
        hashes['md5'] = hashlib.md5(data).hexdigest()
        hashes['sha1'] = hashlib.sha1(data).hexdigest()
        hashes['sha256'] = hashlib.sha256(data).hexdigest()
        
        return hashes
    
    def get_file_info(self) -> Dict:
        """Get basic file information."""
        info = {}
        
        stat = os.stat(self.binary_path)
        info['size'] = stat.st_size
        info['modified'] = stat.st_mtime
        
        # Use file command
        try:
            result = subprocess.run(['file', self.binary_path], capture_output=True, text=True)
            info['type'] = result.stdout.strip()
        except:
            info['type'] = 'unknown'
        
        return info
    
    def extract_strings(self, min_length: int = 4) -> List[str]:
        """Extract printable strings."""
        strings = []
        
        with open(self.binary_path, 'rb') as f:
            data = f.read()
        
        current = []
        for byte in data:
            if 32 <= byte <= 126:
                current.append(chr(byte))
            else:
                if len(current) >= min_length:
                    strings.append(''.join(current))
                current = []
        
        return strings
    
    def search_suspicious_strings(self, strings: List[str]) -> List[str]:
        """Search for suspicious strings."""
        suspicious = []
        
        patterns = [
            'password', 'login', 'admin', 'root',
            'http://', 'https://', 'ftp://',
            'cmd.exe', 'powershell', 'bash',
            'eval(', 'exec(', 'system(',
            '0x', '0x00', '\\x00',
            '/bin/', '/dev/', '/etc/',
            'register', 'license', 'key',
            'crypto', 'encrypt', 'decrypt'
        ]
        
        for s in strings:
            s_lower = s.lower()
            for pattern in patterns:
                if pattern.lower() in s_lower:
                    suspicious.append(s[:100])
                    break
        
        return suspicious
    
    def check_compilation_timestamp(self) -> Optional[str]:
        """Try to find compilation timestamp."""
        strings = self.extract_strings()
        
        for s in strings:
            # Look for date patterns
            if len(s) == 19 and s[4] == '-' and s[7] == '-':
                return s
        
        return None
    
    def basic_disassembly_info(self) -> Dict:
        """Get basic disassembly hints."""
        info = {}
        
        # Check for ELF (Linux)
        with open(self.binary_path, 'rb') as f:
            magic = f.read(4)
        
        if magic == b'\\x7fELF':
            info['format'] = 'ELF (Linux)'
        elif magic.startswith(b'MZ'):
            info['format'] = 'PE (Windows)'
        elif magic == b'\\xfe\\xed\\xfa\\xce':
            info['format'] = 'Mach-O (macOS)'
        else:
            info['format'] = 'unknown'
        
        return info
    
    def analyze(self) -> Dict:
        """Full binary analysis."""
        print(f"[*] Analyzing: {self.binary_path}")
        
        results = {
            'path': self.binary_path,
            'hashes': self.calculate_hashes(),
            'info': self.get_file_info(),
            'format': self.basic_disassembly_info(),
            'strings_count': 0,
            'suspicious_strings': []
        }
        
        strings = self.extract_strings()
        results['strings_count'] = len(strings)
        results['suspicious_strings'] = self.search_suspicious_strings(strings[:500])
        
        return results
    
    def generate_report(self, results: Dict) -> str:
        """Generate analysis report."""
        report = f"""
╔════════════════════════════════════════════════════════════════╗
║     BINARY ANALYSIS REPORT                                 ║
╚════════════════════════════════════════════════════════════════╝

FILE: {results['path']}
Format: {results['format']['format']}
Size: {results['info']['size']:,} bytes

────────────────────────────────────────────────────────────────
HASHES
────────────────────────────────────────────────────────────────

MD5:    {results['hashes']['md5']}
SHA1:   {results['hashes']['sha1']}
SHA256: {results['hashes']['sha256']}

────────────────────────────────────────────────────────────────
STRINGS ANALYSIS
────────────────────────────────────────────────────────────────

Total strings: {results['strings_count']}
Suspicious found: {len(results['suspicious_strings'])}

"""
        
        if results['suspicious_strings']:
            report += "Suspicious strings:\\n"
            for s in results['suspicious_strings'][:20]:
                report += f"  - {s}\\n"
        
        report += """
────────────────────────────────────────────────────────────────
NEXT STEPS
────────────────────────────────────────────────────────────────

1. Use IDA Pro or Ghidra for full disassembly
2. Run in sandbox for dynamic analysis
3. Check VirusTotal for known malware
4. Analyze network behavior
5. Check for persistence mechanisms

"""
        
        return report

def main():
    print("""
╔════════════════════════════════════════════════════════════════╗
║     Binary Analysis Framework - Project 43                    ║
║                                                                ║
║     EDUCATIONAL USE ONLY                                       ║
║     Only analyze binaries you have permission to study        ║
╚════════════════════════════════════════════════════════════════╝

ANALYSIS APPROACHES:

1. STATIC ANALYSIS
   - File hashes
   - Strings extraction
   - Format identification
   - Disassembly (IDA, Ghidra)

2. DYNAMIC ANALYSIS
   - Run in sandbox
   - Monitor file system
   - Monitor network
   - Debugging

ANALYSIS TOOLS:

| Tool | Purpose |
|------|---------|
| IDA Pro | Professional disassembler |
| Ghidra | Free disassembler (NSA) |
| radare2 | Command-line analysis |
| x64dbg | Windows debugger |
| Cutter | GUI for radare2 |
| Binary Ninja | Commercial disassembler |

FILE FORMATS:

| Format | Platform | Detection |
|--------|----------|-----------|
| ELF | Linux | \\x7fELF |
| PE | Windows | MZ header |
| Mach-O | macOS | FEEDFACE/FACEFACE |

COMMON MALWARE INDICATORS:

- Strings with URLs/IPs
- Suspicious API calls (VirtualAlloc, CreateProcess)
- High entropy sections (packed/encrypted)
- Embedded resources
- Persistence mechanisms

""")
    
    if len(sys.argv) > 1:
        binary_path = sys.argv[1]
        
        if not Path(binary_path).exists():
            print(f"[!] File not found: {binary_path}")
            sys.exit(1)
        
        analyzer = BinaryAnalyzer(binary_path)
        results = analyzer.analyze()
        print(analyzer.generate_report(results))
    else:
        print("[*] Usage: python3 binary_analyzer.py <binary_file>")

if __name__ == "__main__":
    main()