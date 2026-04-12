#!/usr/bin/env python3
"""
Two-Factor Authentication System - Project 12
Implements TOTP (Time-based One-Time Password) for secure authentication.

EDUCATIONAL USE ONLY. For production, use established libraries.
"""

import pyotp
import qrcode
import json
import hashlib
import time
from pathlib import Path
from typing import Dict, Optional

class TwoFactorAuth:
    """TOTP-based two-factor authentication."""
    
    def __init__(self, data_dir: Path = Path("data")):
        self.data_dir = data_dir
        self.data_dir.mkdir(exist_ok=True)
        self.secrets_file = data_dir / "secrets.json"
        self.secrets = self._load_secrets()
    
    def _load_secrets(self) -> Dict:
        if self.secrets_file.exists():
            with open(self.secrets_file) as f:
                return json.load(f)
        return {}
    
    def _save_secrets(self):
        with open(self.secrets_file, "w") as f:
            json.dump(self.secrets, f, indent=2)
    
    def generate_secret(self, username: str) -> str:
        """Generate a new secret for a user."""
        secret = pyotp.random_base32()
        self.secrets[username] = {
            "secret": secret,
            "created": time.time(),
            "active": True
        }
        self._save_secrets()
        return secret
    
    def get_provisioning_uri(self, username: str) -> str:
        """Get TOTP provisioning URI for authenticator apps."""
        if username not in self.secrets:
            raise ValueError(f"User {username} not found")
        
        secret = self.secrets[username]["secret"]
        totp = pyotp.TOTP(secret)
        return totp.provisioning_uri(
            name=username,
            issuer_name="SecDevProject"
        )
    
    def generate_qr_code(self, username: str, output_file: str = "qr.png"):
        """Generate QR code for easy scanning."""
        uri = self.get_provisioning_uri(username)
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(uri)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        img.save(output_file)
        return output_file
    
    def verify(self, username: str, token: str, window: int = 1) -> bool:
        """Verify a TOTP token."""
        if username not in self.secrets:
            return False
        
        secret = self.secrets[username]["secret"]
        totp = pyotp.TOTP(secret)
        
        # Check current and adjacent tokens (handles clock drift)
        for offset in range(-window, window + 1):
            if totp.verify(token, valid_window=abs(offset)):
                return True
        return False
    
    def get_current_token(self, username: str) -> str:
        """Get current token for testing (WARNING: exposes token!)."""
        if username not in self.secrets:
            raise ValueError(f"User {username} not found")
        
        secret = self.secrets[username]["secret"]
        totp = pyotp.TOTP(secret)
        return totp.now()
    
    def disable(self, username: str):
        """Disable 2FA for a user."""
        if username in self.secrets:
            self.secrets[username]["active"] = False
            self._save_secrets()
    
    def setup_user(self, username: str) -> Dict:
        """Interactive user setup."""
        secret = self.generate_secret(username)
        uri = self.get_provisioning_uri(username)
        qr_file = f"qr_{username}.png"
        self.generate_qr_code(username, qr_file)
        
        return {
            "username": username,
            "secret": secret,
            "provisioning_uri": uri,
            "qr_code_file": qr_file,
            "message": f"Scan QR code from {qr_file} with your authenticator app"
        }

def main():
    import sys
    
    tfa = TwoFactorAuth(Path("data"))
    
    if len(sys.argv) < 2:
        print("""
╔════════════════════════════════════════════════════════════════╗
║     Two-Factor Authentication System - Project 12           ║
╚════════════════════════════════════════════════════════════════╝

Usage:
  python3 twofa.py setup <username>    Setup 2FA for user
  python3 twofa.py verify <username> <token>  Verify token
  python3 twofa.py current <username>   Get current token (testing)
  python3 twofa.py disable <username>   Disable 2FA
        """)
        sys.exit(1)
    
    cmd = sys.argv[1]
    
    if cmd == "setup":
        username = sys.argv[2] if len(sys.argv) > 2 else "testuser"
        result = tfa.setup_user(username)
        print(f"\n[+] 2FA Setup for {username}")
        print(f"    Secret: {result['secret']}")
        print(f"    QR Code: {result['qr_code_file']}")
        print(f"    {result['message']}")
    
    elif cmd == "verify":
        if len(sys.argv) < 4:
            print("[!] Usage: twofa.py verify <username> <token>")
            sys.exit(1)
        username, token = sys.argv[2], sys.argv[3]
        
        if tfa.verify(username, token):
            print("[+] Token VALID - Authentication successful")
        else:
            print("[-] Token INVALID - Authentication failed")
    
    elif cmd == "current":
        username = sys.argv[2] if len(sys.argv) > 2 else "testuser"
        try:
            token = tfa.get_current_token(username)
            print(f"[*] Current token for {username}: {token}")
            print(f"    (Use this within 30 seconds)")
        except ValueError as e:
            print(f"[!] {e}")
    
    elif cmd == "disable":
        username = sys.argv[2] if len(sys.argv) > 2 else "testuser"
        tfa.disable(username)
        print(f"[-] 2FA disabled for {username}")

if __name__ == "__main__":
    main()
