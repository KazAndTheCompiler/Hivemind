#!/usr/bin/env python3
"""
Steganography Detection Tools - Project 69
Detect hidden data in images and files.

EDUCATIONAL USE ONLY. For understanding steganography and forensics.
"""

import os
import sys
import zlib
import struct
from pathlib import Path
from typing import Dict, List, Optional

class SteganographyDetector:
    """Detect hidden data in files."""
    
    def __init__(self):
        self.signatures = {
            'jpg': [b'\xFF\xD8\xFF\xE0', b'\xFF\xD8\xFF\xE1'],
            'png': [b'\x89PNG\r\n\x1a\n'],
            'gif': [b'GIF87a', b'GIF89a'],
            'bmp': [b'BM'],
        }
    
    def analyze_jpg(self, file_path: str) -> Dict:
        """Analyze JPEG for hidden data."""
        results = {
            'file': file_path,
            'type': 'JPEG',
            'anomalies': [],
            'hidden_data_suspected': False
        }
        
        with open(file_path, 'rb') as f:
            data = f.read()
        
        # Check for extra data after EOF marker
        eof_marker = b'\xFF\xD9'
        last_eof = data.rfind(eof_marker)
        
        if last_eof != len(data) - 2:
            extra_data = len(data) - last_eof - 2
            if extra_data > 100:
                results['anomalies'].append({
                    'type': 'Extra data after EOF',
                    'size': extra_data,
                    'description': 'Possible hidden data appended'
                })
                results['hidden_data_suspected'] = True
        
        # Check for appended ZIP
        if b'PK\x03\x04' in data[data.rfind(eof_marker):]:
            results['anomalies'].append({
                'type': 'ZIP signature after EOF',
                'description': 'Possible embedded archive'
            })
            results['hidden_data_suspected'] = True
        
        # Check for increased entropy in last segment
        segments = data.split(b'\xFF\xD8')
        if len(segments) > 2:
            last_segment = segments[-1]
            entropy = self.calculate_entropy(last_segment)
            if entropy > 7.5:  # High entropy suggests encryption/compression
                results['anomalies'].append({
                    'type': 'High entropy in final segment',
                    'value': entropy,
                    'description': 'Possible encrypted/compressed data'
                })
        
        return results
    
    def analyze_png(self, file_path: str) -> Dict:
        """Analyze PNG for hidden data."""
        results = {
            'file': file_path,
            'type': 'PNG',
            'anomalies': [],
            'hidden_data_suspected': False
        }
        
        with open(file_path, 'rb') as f:
            data = f.read()
        
        # Check for appended data
        iend = data.find(b'IEND\x00\x00\x00\x00')
        if iend != -1:
            after_iend = data[iend + 8:]
            if len(after_iend) > 100:
                results['anomalies'].append({
                    'type': 'Data after IEND chunk',
                    'size': len(after_iend),
                    'description': 'Possible hidden data'
                })
                results['hidden_data_suspected'] = True
        
        # Check for abnormal chunk sizes
        chunk_count = data.count(b'IHDR')
        if chunk_count > 1:
            results['anomalies'].append({
                'type': 'Multiple IHDR chunks',
                'count': chunk_count,
                'description': 'Potential steganography marker'
            })
        
        return results
    
    def analyze_file(self, file_path: str) -> Dict:
        """Analyze file for steganography."""
        ext = Path(file_path).suffix.lower()
        
        if ext == '.jpg' or ext == '.jpeg':
            return self.analyze_jpg(file_path)
        elif ext == '.png':
            return self.analyze_png(file_path)
        else:
            return {
                'file': file_path,
                'type': 'Unknown',
                'anomalies': [],
                'hidden_data_suspected': False
            }
    
    def calculate_entropy(self, data: bytes) -> float:
        """Calculate Shannon entropy of data."""
        if not data:
            return 0.0
        
        entropy = 0.0
        for i in range(256):
            freq = data.count(bytes([i])) / len(data)
            if freq > 0:
                entropy -= freq * (freq ** 0.5)  # Simplified
        
        # Simplified entropy calculation
        from math import log2
        freq_map = {}
        for byte in data:
            freq_map[byte] = freq_map.get(byte, 0) + 1
        
        entropy = 0.0
        for count in freq_map.values():
            prob = count / len(data)
            entropy -= prob * log2(prob)
        
        return entropy
    
    def extract_lsb(self, file_path: str, output_path: str) -> bool:
        """Extract LSB (Least Significant Bit) hidden data."""
        try:
            with open(file_path, 'rb') as f:
                data = bytearray(f.read())
            
            # Extract LSBs
            lsb_data = []
            for i, byte in enumerate(data):
                if i % 8 == 7:  # Every 8th byte carries LSBs
                    lsb_data.append(byte & 1)
            
            # Convert bits to bytes
            result = bytearray()
            for i in range(0, len(lsb_data) - 7, 8):
                byte = 0
                for j in range(8):
                    byte |= (lsb_data[i + j] << j)
                result.append(byte)
            
            # Remove null bytes (likely padding)
            while result and result[-1] == 0:
                result = result[:-1]
            
            # Save extracted data
            with open(output_path, 'wb') as f:
                f.write(bytes(result))
            
            return True
        except Exception as e:
            print(f"[!] Extraction error: {e}")
            return False
    
    def generate_report(self, results: Dict) -> str:
        """Generate steganography analysis report."""
        report = f\"\"\"
╔════════════════════════════════════════════════════════════════╗
║     STEGANOGRAPHY ANALYSIS REPORT                           ║
╚════════════════════════════════════════════════════════════════╝

File: {results['file']}
Type: {results['type']}

Hidden Data Suspected: {'YES' if results['hidden_data_suspected'] else 'No'}

"""
        
        if results['anomalies']:
            report += "\nAnomalies Detected:\n"
            for anomaly in results['anomalies']:
                report += f"  - {anomaly['type']}\n"
                if 'description' in anomaly:
                    report += f"    {anomaly['description']}\n"
        
        return report

def main():
    print(\"\"\"
╔════════════════════════════════════════════════════════════════╗
║     Steganography Detection Tools - Project 69                ║
║                                                                ║
║     EDUCATIONAL USE ONLY                                       ║
║     For understanding steganography and forensics             ║
╚════════════════════════════════════════════════════════════════╝

WHAT IS STEGANOGRAPHY?

Hiding data within other data:
- Images (LSB insertion)
- Audio (LSB, frequency manipulation)
- Video (frame insertion)
- Documents (metadata, whitespace)

COMMON TECHNIQUES:

1. LSB (Least Significant Bit)
   - Hide bits in image pixels
   - Change last bit of color values
   - Hard to detect visually

2. STEGANOGRAPHIC TOOLS
   - OpenStego
   - Steghide
   - zsteg
   - jp4steg

3. METADATA MANIPULATION
   - Insert text in EXIF
   - Modify timestamps
   - Add comments

DETECTION APPROACHES:

1. STATISTICAL ANALYSIS
   - Chi-square test
   - Entropy analysis
   - Noise analysis

2. VISUAL ANALYSIS
   - Compare original vs suspect
   - Amplify differences
   - Color channel analysis

3. FORMAT ANALYSIS
   - Check for appended data
   - Chunk analysis
   - Signature verification

TOOLS:

| Tool | Purpose |
|------|---------|
| zsteg | PNG/BMP steganalysis |
| steghide | Steganography tool |
| OpenStego | Steganography tool |
| exiftool | Metadata analysis |
| binwalk | Binary analysis |
| hexdump | Hex view |

USAGE:

# Analyze image
python3 stego_detector.py image.jpg

# Extract LSB
python3 stego_detector.py --extract image.jpg output.txt

# Scan directory
for f in *.jpg; do python3 stego_detector.py \"\$f\"; done

DETECTION LIMITATIONS:

- New steganography methods may evade detection
- Steganalysis is not 100% reliable
- Some methods are computationally undetectable
- Always consider source reliability

LEGAL CONSIDERATIONS:

- Steganography itself is not illegal
- Use for legitimate forensics
- Don't use for hiding illicit content
- Document chain of custody

SECURITY CHECKLIST:

[ ] Analyze suspicious images
[ ] Check for appended data
[ ] Verify entropy patterns
[ ] Extract and examine metadata
[ ] Document all findings
[ ] Maintain chain of custody

\"\"\")
    
    if len(sys.argv) > 1:
        detector = SteganographyDetector()
        
        if sys.argv[1] == '--extract' and len(sys.argv) >= 4:
            detector.extract_lsb(sys.argv[2], sys.argv[3])
        else:
            results = detector.analyze_file(sys.argv[1])
            print(detector.generate_report(results))
    else:
        print(\"[*] Usage: python3 stego_detector.py <image_file>\")
        print(\"    Or: python3 stego_detector.py --extract <file> <output>\")

if __name__ == \"__main__\":
    main()