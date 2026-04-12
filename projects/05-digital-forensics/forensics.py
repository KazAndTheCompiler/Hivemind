#!/usr/bin/env python3
"""
Digital Forensics Toolkit - Project 5
Core forensic analysis techniques:
- File signature detection
- Metadata extraction
- Timeline analysis
- Hash analysis
- File carving

EDUCATIONAL USE ONLY. Only analyze files/disks you own or have permission to examine.
"""

import os
import sys
import json
import hashlib
import datetime
import struct
import argparse
from pathlib import Path
from typing import Optional, Dict, List, Tuple
from collections import defaultdict

# Common file signatures (magic bytes)
FILE_SIGNATURES = {
    b"\x89PNG\r\n\x1a\n": ("PNG", "image/png"),
    b"\xff\xd8\xff": ("JPEG", "image/jpeg"),
    b"GIF87a": ("GIF", "image/gif"),
    b"GIF89a": ("GIF", "image/gif"),
    b"RIFF": ("AVI/WAV", "video/x-msvideo"),
    b"%PDF": ("PDF", "application/pdf"),
    b"\x7fELF": ("ELF", "application/x-elf"),
    b"MZ": ("EXE/DLL", "application/x-msdownload"),
    b"PK\x03\x04": ("ZIP", "application/zip"),
    b"Rar!": ("RAR", "application/vnd.rar"),
    b"\x1f\x8b": ("GZIP", "application/gzip"),
    b"OLDMEDIK": ("ODS", "application/vnd.oasis.opendocument.spreadsheet"),
    b"\x00\x00\x01\x00": ("ICO", "image/x-icon"),
    b"BM": ("BMP", "image/bmp"),
    b"II\x2a\x00": ("TIFF", "image/tiff"),
    b"MM\x00\x2a": ("TIFF", "image/tiff"),
    b"SQLite format 3": ("SQLite", "application/vnd.sqlite3"),
    b"\x00\x00\x00\x15": ("JP2", "image/jp2"),
    b"\xca\xfe\xba\xbe": ("JAVA CLASS", "application/java-vm"),
    b"OTTO": ("OTF", "font/otf"),
    b"\\x00\\x01\\x00\\x00": ("TTF", "font/ttf"),
}

# Carving signatures (begin and end markers)
CARVE_SIGNATURES = {
    "JPEG": (b"\xff\xd8\xff", b"\xff\xd9", ".jpg"),
    "PNG": (b"\x89PNG\r\n\x1a\n", None, ".png"),
    "GIF": (b"GIF87a", b"\x00\x3b", ".gif"),
    "ZIP": (b"PK\x03\x04", b"PK\x05\x06", ".zip"),
    "PDF": (b"%PDF", b"%%EOF", ".pdf"),
}

class ForensicToolkit:
    def __init__(self, target_path: str):
        self.target = Path(target_path)
        self.results = {
            "target": str(self.target),
            "analysis_time": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "type": None,
            "size": None,
            "hashes": {},
            "signatures": [],
            "metadata": {},
            "strings": [],
            "carved_files": []
        }
    
    def calculate_hashes(self) -> Dict[str, str]:
        """Calculate multiple hashes of the file."""
        print("[*] Calculating hashes...")
        
        md5 = hashlib.md5()
        sha1 = hashlib.sha1()
        sha256 = hashlib.sha256()
        
        try:
            with open(self.target, "rb") as f:
                while chunk := f.read(65536):
                    md5.update(chunk)
                    sha1.update(chunk)
                    sha256.update(chunk)
            
            self.results["hashes"] = {
                "MD5": md5.hexdigest(),
                "SHA1": sha1.hexdigest(),
                "SHA256": sha256.hexdigest()
            }
            
            for algo, hash_val in self.results["hashes"].items():
                print(f"    {algo}: {hash_val}")
                
        except Exception as e:
            print(f"[!] Error calculating hashes: {e}")
        
        return self.results["hashes"]
    
    def detect_file_type(self) -> Tuple[Optional[str], Optional[str]]:
        """Detect file type by magic bytes."""
        print("[*] Detecting file type...")
        
        try:
            with open(self.target, "rb") as f:
                header = f.read(1024)
            
            for signature, (name, mime) in FILE_SIGNATURES.items():
                if header.startswith(signature):
                    self.results["type"] = {"name": name, "mime": mime}
                    print(f"    Detected: {name} ({mime})")
                    return name, mime
            
            # Try more detailed detection
            import mimetypes
            mime = mimetypes.guess_type(str(self.target))[0]
            if mime:
                print(f"    Detected (mimetype): {mime}")
                self.results["type"] = {"name": self.target.suffix, "mime": mime}
                return self.target.suffix, mime
            
            print(f"    Unknown file type")
            return None, None
            
        except Exception as e:
            print(f"[!] Error detecting file type: {e}")
            return None, None
    
    def extract_metadata(self) -> Dict:
        """Extract file metadata."""
        print("[*] Extracting metadata...")
        
        try:
            stat = self.target.stat()
            self.results["metadata"] = {
                "size_bytes": stat.st_size,
                "created": datetime.datetime.fromtimestamp(stat.st_ctime, datetime.timezone.utc).isoformat(),
                "modified": datetime.datetime.fromtimestamp(stat.st_mtime, datetime.timezone.utc).isoformat(),
                "accessed": datetime.datetime.fromtimestamp(stat.st_atime, datetime.timezone.utc).isoformat(),
                "permissions": oct(stat.st_mode)[-3:],
                "is_symlink": stat.st_symlink() if hasattr(stat, 'st_symlink') else False
            }
            
            for key, val in self.results["metadata"].items():
                print(f"    {key}: {val}")
                
        except Exception as e:
            print(f"[!] Error extracting metadata: {e}")
        
        return self.results["metadata"]
    
    def extract_strings(self, min_length=4) -> List[str]:
        """Extract printable strings from binary."""
        print(f"[*] Extracting strings (min length: {min_length})...")
        
        try:
            with open(self.target, "rb") as f:
                data = f.read()
            
            current = []
            strings = []
            
            for byte in data:
                if 32 <= byte <= 126:  # Printable ASCII
                    current.append(chr(byte))
                else:
                    if len(current) >= min_length:
                        strings.append("".join(current))
                    current = []
            
            # Don't forget the last string
            if len(current) >= min_length:
                strings.append("".join(current))
            
            # Deduplicate while preserving order
            seen = set()
            unique_strings = []
            for s in strings:
                if s not in seen:
                    seen.add(s)
                    unique_strings.append(s)
            
            self.results["strings"] = unique_strings[:1000]  # Limit to first 1000
            print(f"    Found {len(unique_strings)} unique strings (showing first 20)")
            for s in unique_strings[:20]:
                print(f"        {s}")
            
            return unique_strings
            
        except Exception as e:
            print(f"[!] Error extracting strings: {e}")
            return []
    
    def carve_files(self, output_dir: Path) -> List[Path]:
        """Carve files from disk image or binary blob."""
        print("[*] Attempting file carving...")
        
        carved = []
        
        try:
            output_dir.mkdir(parents=True, exist_ok=True)
            
            with open(self.target, "rb") as f:
                data = f.read()
            
            for file_type, (start_marker, end_marker, ext) in CARVE_SIGNATURES.items():
                print(f"    Carving {file_type} files...")
                
                start_pos = 0
                count = 0
                
                while True:
                    # Find next start marker
                    start_idx = data.find(start_marker, start_pos)
                    if start_idx == -1:
                        break
                    
                    # Find end marker
                    if end_marker:
                        end_idx = data.find(end_marker, start_idx + len(start_marker))
                        if end_idx == -1:
                            break
                        file_data = data[start_idx:end_idx + len(end_marker)]
                    else:
                        # No end marker, take reasonable size
                        file_data = data[start_idx:start_idx + 10 * 1024 * 1024]  # 10MB max
                        end_idx = start_idx + len(file_data)
                    
                    # Save carved file
                    carved_name = f"carved_{file_type}_{count:04d}{ext}"
                    carved_path = output_dir / carved_name
                    
                    with open(carved_path, "wb") as out:
                        out.write(file_data)
                    
                    carved.append(carved_path)
                    count += 1
                    start_pos = end_idx + 1
                    
                    print(f"        Carved: {carved_name} ({len(file_data)} bytes)")
            
            self.results["carved_files"] = [str(p) for p in carved]
            
        except Exception as e:
            print(f"[!] Error carving files: {e}")
        
        return carved
    
    def analyze_timeline(self, files: List[Path]) -> Dict:
        """Create a timeline of file activities."""
        print("[*] Analyzing file timeline...")
        
        timeline = []
        
        for f in files:
            try:
                stat = f.stat()
                timeline.append({
                    "path": str(f),
                    "created": datetime.datetime.fromtimestamp(stat.st_ctime, datetime.timezone.utc).isoformat(),
                    "modified": datetime.datetime.fromtimestamp(stat.st_mtime, datetime.timezone.utc).isoformat(),
                    "size": stat.st_size
                })
            except:
                pass
        
        # Sort by modification time
        timeline.sort(key=lambda x: x["modified"])
        
        print(f"    Timeline includes {len(timeline)} files")
        return {"timeline": timeline}
    
    def generate_report(self, output_file: Optional[Path] = None) -> str:
        """Generate a forensic analysis report."""
        report = json.dumps(self.results, indent=2)
        
        if output_file:
            with open(output_file, "w") as f:
                f.write(report)
            print(f"\n[+] Report saved to: {output_file}")
        
        return report
    
    def run_full_analysis(self, output_file: Optional[Path] = None) -> Dict:
        """Run complete forensic analysis."""
        print(f"""
    ╔═══════════════════════════════════════════════════════╗
    ║     Digital Forensics Toolkit - Project 5            ║
    ║                                                       ║
    ║     EDUCATIONAL USE ONLY                              ║
    ║     Only analyze files/disks you own or have        ║
    ║     explicit permission to examine                    ║
    ╚═══════════════════════════════════════════════════════╝
        """)
        
        print(f"[*] Target: {self.target}\n")
        
        if not self.target.exists():
            print(f"[!] Target does not exist: {self.target}")
            return {}
        
        if self.target.is_file():
            self.calculate_hashes()
            print()
            self.detect_file_type()
            print()
            self.extract_metadata()
            print()
            self.extract_strings()
            print()
            
        elif self.target.is_dir():
            print(f"[*] Analyzing directory with {len(list(self.target.rglob('*')))} items")
            timeline = self.analyze_timeline(list(self.target.rglob('*')))
            self.results["metadata"]["item_count"] = len(list(self.target.rglob('*')))
            self.results["timeline"] = timeline
        
        print("\n" + self.generate_report(output_file))
        
        return self.results

def main():
    parser = argparse.ArgumentParser(description="Digital Forensics Toolkit")
    parser.add_argument("target", help="File or directory to analyze")
    parser.add_argument("-o", "--output", help="Output report file")
    parser.add_argument("--carve", action="store_true", help="Attempt file carving")
    parser.add_argument("--carve-dir", default="carved", help="Directory for carved files")
    parser.add_argument("--strings", action="store_true", help="Extract strings")
    parser.add_argument("--no-hash", action="store_true", help="Skip hash calculation")
    args = parser.parse_args()
    
    toolkit = ForensicToolkit(args.target)
    
    if args.target.is_dir():
        args.no_hash = True  # Don't hash directories
    
    results = toolkit.run_full_analysis(Path(args.output) if args.output else None)
    
    if args.carve and args.target.is_file():
        carved = toolkit.carve_files(Path(args.carve_dir))
        print(f"\n[+] Carved {len(carved)} files")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 forensics.py <file_or_directory> [options]")
        print("")
        print("Examples:")
        print("  python3 forensics.py suspicious.pdf")
        print("  python3 forensics.py /path/to/disk.img --carve")
        print("  python3 forensics.py evidence/ -o report.json")
        sys.exit(1)
    
    main()
