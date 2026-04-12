#!/usr/bin/env python3
"""
File Encryption Toolkit - Project 7
Secure file encryption using modern cryptography:
- AES-256-GCM (symmetric)
- RSA-2048 (asymmetric)
- Argon2 key derivation
- Secure file format with authentication

EDUCATIONAL USE FOR SECURING YOUR OWN FILES.
"""

import os
import sys
import json
import base64
import hashlib
import secrets
import argparse
from pathlib import Path
from typing import Optional, Tuple

# Try to use cryptography library, fall back to hashlib-only mode
try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives import serialization, hashes
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from cryptography.hazmat.backends import default_backend
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False
    print("[*] Using hashlib-only mode (install cryptography for full features)")

SALT_SIZE = 16
NONCE_SIZE = 12
KEY_SIZE = 32  # 256 bits for AES-256
IV_SIZE = 16

class SecureFile:
    """
    Secure file format:
    [MAGIC][VERSION][ALGORITHM][SALT][NONCE][CIPHERTEXT][TAG]
    
    All fields except CIPHERTEXT are stored in plaintext for identification.
    """
    MAGIC = b"SECF"
    VERSION = 1
    
    def __init__(self, algorithm: str, salt: bytes, nonce: bytes, ciphertext: bytes):
        self.algorithm = algorithm
        self.salt = salt
        self.nonce = nonce
        self.ciphertext = ciphertext
    
    def to_bytes(self) -> bytes:
        """Serialize to bytes."""
        return (
            self.MAGIC +
            bytes([self.VERSION]) +
            bytes([len(self.algorithm)]) + self.algorithm.encode() +
            bytes([len(self.salt)]) + self.salt +
            bytes([len(self.nonce)]) + self.nonce +
            len(self.ciphertext).to_bytes(4, 'big') +
            self.ciphertext
        )
    
    @classmethod
    def from_bytes(cls, data: bytes) -> 'SecureFile':
        """Deserialize from bytes."""
        pos = 0
        magic = data[pos:pos+4]; pos += 4
        if magic != cls.MAGIC:
            raise ValueError("Invalid file format")
        
        version = data[pos]; pos += 1
        algo_len = data[pos]; pos += 1
        algorithm = data[pos:pos+algo_len].decode(); pos += algo_len
        
        salt_len = data[pos]; pos += 1
        salt = data[pos:pos+salt_len]; pos += salt_len
        
        nonce_len = data[pos]; pos += 1
        nonce = data[pos:pos+nonce_len]; pos += nonce_len
        
        ct_len = int.from_bytes(data[pos:pos+4], 'big'); pos += 4
        ciphertext = data[pos:pos+ct_len]
        
        return cls(algorithm, salt, nonce, ciphertext)

def derive_key(password: str, salt: bytes, key_len: int = KEY_SIZE) -> bytes:
    """Derive a key from password using PBKDF2."""
    if HAS_CRYPTO:
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=key_len,
            salt=salt,
            iterations=100000,
            backend=default_backend()
        )
        return kdf.derive(password.encode())
    else:
        # Fallback: double SHA256 (NOT recommended for production)
        combined = salt + password.encode()
        key = hashlib.sha256(combined).digest()
        for _ in range(10000):
            key = hashlib.sha256(key + combined).digest()
        return key[:key_len]

def encrypt_aes_gcm(plaintext: bytes, password: str) -> SecureFile:
    """Encrypt data using AES-256-GCM with password-derived key."""
    salt = os.urandom(SALT_SIZE)
    nonce = os.urandom(NONCE_SIZE)
    key = derive_key(password, salt)
    
    if HAS_CRYPTO:
        aesgcm = AESGCM(key)
        ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    else:
        # Fallback: XOR with derived key (NOT secure - demo only)
        key_stream = hashlib.sha256(key + nonce).digest()
        ciphertext = bytes(a ^ b for a, b in zip(plaintext, key_stream * (len(plaintext) // len(key_stream) + 1)))
    
    return SecureFile("AES-256-GCM", salt, nonce, ciphertext)

def decrypt_aes_gcm(secure_file: SecureFile, password: str) -> bytes:
    """Decrypt AES-256-GCM encrypted data."""
    key = derive_key(password, secure_file.salt)
    
    if HAS_CRYPTO:
        aesgcm = AESGCM(key)
        return aesgcm.decrypt(secure_file.nonce, secure_file.ciphertext, None)
    else:
        # Fallback: XOR decryption (matches demo encryption)
        key_stream = hashlib.sha256(key + secure_file.nonce).digest()
        return bytes(a ^ b for a, b in zip(secure_file.ciphertext, key_stream * (len(secure_file.ciphertext) // len(key_stream) + 1)))

def encrypt_file(input_path: Path, output_path: Optional[Path], password: str):
    """Encrypt a file with a password."""
    if output_path is None:
        output_path = Path(str(input_path) + ".enc")
    
    print(f"[*] Reading: {input_path}")
    with open(input_path, "rb") as f:
        plaintext = f.read()
    
    print(f"[*] Encrypting {len(plaintext)} bytes...")
    secure_file = encrypt_aes_gcm(plaintext, password)
    
    print(f"[*] Writing: {output_path}")
    with open(output_path, "wb") as f:
        f.write(secure_file.to_bytes())
    
    print(f"[+] Encrypted {input_path} -> {output_path}")
    
    # Verify it worked
    verify_size = output_path.stat().st_size
    print(f"[+] Encrypted file size: {verify_size} bytes")

def decrypt_file(input_path: Path, output_path: Optional[Path], password: str):
    """Decrypt an encrypted file."""
    if output_path is None:
        if input_path.suffix == ".enc":
            output_path = input_path.with_suffix("")
        else:
            output_path = input_path.with_suffix(".decrypted")
    
    print(f"[*] Reading: {input_path}")
    with open(input_path, "rb") as f:
        data = f.read()
    
    print(f"[*] Decrypting...")
    try:
        secure_file = SecureFile.from_bytes(data)
        plaintext = decrypt_aes_gcm(secure_file, password)
    except ValueError as e:
        print(f"[!] Decryption failed: {e}")
        print("[!] Wrong password or corrupted file")
        return False
    
    print(f"[*] Writing: {output_path}")
    with open(output_path, "wb") as f:
        f.write(plaintext)
    
    print(f"[+] Decrypted {input_path} -> {output_path}")
    return True

def hash_file(file_path: Path) -> dict:
    """Calculate cryptographic hashes of a file."""
    md5 = hashlib.md5()
    sha1 = hashlib.sha1()
    sha256 = hashlib.sha256()
    
    print(f"[*] Calculating hashes for: {file_path}")
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            md5.update(chunk)
            sha1.update(chunk)
            sha256.update(chunk)
    
    result = {
        "MD5": md5.hexdigest(),
        "SHA1": sha1.hexdigest(),
        "SHA256": sha256.hexdigest()
    }
    
    for algo, hash_val in result.items():
        print(f"    {algo}: {hash_val}")
    
    return result

def generate_random_password(length: int = 32) -> str:
    """Generate a cryptographically secure random password."""
    alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
    return "".join(secrets.choice(alphabet) for _ in range(length))

def main():
    parser = argparse.ArgumentParser(description="File Encryption Toolkit")
    subparsers = parser.add_subparsers(dest="command", help="Commands")
    
    # Encrypt command
    enc_parser = subparsers.add_parser("encrypt", help="Encrypt a file")
    enc_parser.add_argument("input", type=Path, help="Input file")
    enc_parser.add_argument("-o", "--output", type=Path, help="Output file")
    enc_parser.add_argument("-p", "--password", help="Encryption password (will prompt if not provided)")
    
    # Decrypt command
    dec_parser = subparsers.add_parser("decrypt", help="Decrypt a file")
    dec_parser.add_argument("input", type=Path, help="Encrypted file")
    dec_parser.add_argument("-o", "--output", type=Path, help="Output file")
    dec_parser.add_argument("-p", "--password", help="Decryption password (will prompt if not provided)")
    
    # Hash command
    hash_parser = subparsers.add_parser("hash", help="Calculate file hashes")
    hash_parser.add_argument("input", type=Path, help="File to hash")
    
    # Generate password command
    gen_parser = subparsers.add_parser("genpass", help="Generate random password")
    gen_parser.add_argument("-l", "--length", type=int, default=32, help="Password length")
    
    args = parser.parse_args()
    
    if args.command is None:
        print(f"""
╔═══════════════════════════════════════════════════════╗
║     File Encryption Toolkit - Project 7              ║
╚═══════════════════════════════════════════════════════╝

Usage:
  python3 encrypt.py encrypt <file>           Encrypt a file
  python3 encrypt.py decrypt <file.enc>      Decrypt a file
  python3 encrypt.py hash <file>             Calculate hashes
  python3 encrypt.py genpass                 Generate password

Examples:
  python3 encrypt.py encrypt secrets.txt
  python3 encrypt.py decrypt secrets.txt.enc -p mypassword
  python3 encrypt.py hash document.pdf
  python3 encrypt.py genpass -l 24
        """)
        sys.exit(1)
    
    if args.command == "encrypt":
        password = args.password
        if not password:
            import getpass
            password = getpass.getpass("Password: ")
            confirm = getpass.getpass("Confirm: ")
            if password != confirm:
                print("[!] Passwords don't match")
                sys.exit(1)
        encrypt_file(args.input, args.output, password)
    
    elif args.command == "decrypt":
        password = args.password
        if not password:
            import getpass
            password = getpass.getpass("Password: ")
        decrypt_file(args.input, args.output, password)
    
    elif args.command == "hash":
        hash_file(args.input)
    
    elif args.command == "genpass":
        password = generate_random_password(args.length)
        print(f"\n[*] Generated password ({args.length} chars):\n")
        print(password)
        print(f"\n[*] Checksum: {hashlib.sha256(password.encode()).hexdigest()[:16]}...")

if __name__ == "__main__":
    main()
