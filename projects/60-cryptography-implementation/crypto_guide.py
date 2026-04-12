#!/usr/bin/env python3
"""
Cryptography Implementation Guide - Project 60
Proper crypto implementation patterns.

EDUCATIONAL USE ONLY. For learning cryptographic principles.
"""

import os
import sys
import hashlib
import hmac
import secrets
import base64
from typing import Optional, Tuple

class SecureCryptoImplementation:
    """Educational crypto implementation guide."""
    
    @staticmethod
    def generate_symmetric_key(bits: int = 256) -> bytes:
        """Generate a random symmetric key."""
        return secrets.token_bytes(bits // 8)
    
    @staticmethod
    def generate_nonce(size: int = 12) -> bytes:
        """Generate a random nonce (IV)."""
        return secrets.token_bytes(size)
    
    @staticmethod
    def simple_xor_encrypt(plaintext: bytes, key: bytes) -> bytes:
        """Simple XOR encryption (EDUCATIONAL ONLY - NOT SECURE)."""
        result = bytearray()
        for i, byte in enumerate(plaintext):
            result.append(byte ^ key[i % len(key)])
        return bytes(result)
    
    @staticmethod
    def hash_password(password: str, salt: Optional[bytes] = None, rounds: int = 100000) -> Tuple[bytes, bytes]:
        """Secure password hashing with PBKDF2."""
        if salt is None:
            salt = secrets.token_bytes(32)
        
        key = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt,
            rounds,
            dklen=32
        )
        
        return key, salt
    
    @staticmethod
    def verify_password(password: str, stored_hash: bytes, salt: bytes, rounds: int = 100000) -> bool:
        """Verify password against stored hash."""
        computed_hash, _ = SecureCryptoImplementation.hash_password(password, salt, rounds)
        return hmac.compare_digest(computed_hash, stored_hash)
    
    @staticmethod
    def compute_hash(data: bytes, algorithm: str = 'sha256') -> str:
        """Compute cryptographic hash."""
        h = hashlib.new(algorithm)
        h.update(data)
        return h.hexdigest()
    
    @staticmethod
    def compute_hmac(data: bytes, key: bytes, algorithm: str = 'sha256') -> str:
        """Compute HMAC (keyed hash)."""
        m = hmac.new(key, data, hashlib.new(algorithm).name)
        return m.hexdigest()
    
    @staticmethod
    def derive_key(password: str, salt: bytes, key_length: int = 32) -> bytes:
        """Derive key using HKDF-like expansion."""
        # Simplified - use proper HKDF in production
        key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000, dklen=key_length)
        return key

def demonstrate_weak_crypto():
    """Show why simple crypto is insecure."""
    print("\n[!] DEMONSTRATION: Weak Crypto Failures\n")
    
    # Weak XOR can be broken
    key = b'secret'
    plaintext = b"Password: hunter2"
    ciphertext = SecureCryptoImplementation.simple_xor_encrypt(plaintext, key)
    
    print(f"Original: {plaintext}")
    print(f"Key: {key}")
    print(f"Ciphertext (hex): {ciphertext.hex()}")
    
    # Brute force XOR (small key space)
    print("\n[*] Attempting to break XOR encryption...")
    for test_key in range(256):
        test_key_bytes = bytes([test_key])
        decrypted = SecureCryptoImplementation.simple_xor_encrypt(ciphertext, test_key_bytes)
        if b'Password' in decrypted:
            print(f"[+] Found key: {test_key_bytes} -> {decrypted}")
            break

def main():
    print("""
╔════════════════════════════════════════════════════════════════╗
║     Cryptography Implementation - Project 60                  ║
╚════════════════════════════════════════════════════════════════╝

WHY PROPER CRYPTO MATTERS:

- Weak crypto can be broken in seconds
- Implementation flaws cause breaches
- Crypto libraries exist for a reason
- Roll your own = security disaster

COMMON MISTAKES TO AVOID:

1. ROLL YOUR OWN CRYPTO
   - NEVER create your own crypto algorithms
   - Use established libraries
   - Crypto is hard - experts get it wrong

2. USE WEAK ALGORITHMS
   - MD5, SHA1 for passwords: BROKEN
   - DES, 3DES: BROKEN
   - RC4: BROKEN
   - ECB mode: BROKEN (pattern leakage)

3. HARDCODE KEYS
   - Keys in code = compromised
   - Use key management systems
   - Environment variables / secrets manager

4. REUSE NONCES/IVs
   - Each encryption needs unique IV/nonce
   - Predictable IVs compromise security

5. NO AUTHENTICATION
   - Encrypt-then-MAC
   - Don't just encrypt (manipulation possible)

SECURE PATTERNS:

SYMMETRIC ENCRYPTION (AES-256-GCM):

# Python with cryptography library
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

key = AESGCM.generate_key(bit_length=256)
aesgcm = AESGCM(key)
nonce = secrets.token_bytes(12)  # 96-bit nonce
ciphertext = aesgcm.encrypt(nonce, plaintext, None)

# ALWAYS includes authentication tag

ASYMMETRIC ENCRYPTION (RSA-OAEP or ECIES):

# Use libsodium (recommended)
# seal() for public key encryption
# secretbox() for symmetric

PASSWORD HASHING (Argon2id, bcrypt, scrypt):

# Argon2id (winner of Password Hashing Competition)
# Parameters:
#   Memory: 64 MB
#   Time: 3 iterations
#   Parallelism: 4

# Python example with argon2-cffi
from argon2 import PasswordHasher
ph = PasswordHasher(
    memory_cost=65536,
    time_cost=3,
    parallelism=4
)
hash = ph.hash(\"password\")
ph.verify(hash, \"password\")

KEY MANAGEMENT:

1. NEVER store keys in code
2. Use HSM for production keys
3. Key rotation (automate)
4. Key derivation for different purposes
5. Secure key destruction

PROPER HASHING:

| Use Case | Algorithm |
|----------|-----------|
| Password hashing | Argon2id, bcrypt, scrypt |
| Integrity checks | SHA-256, SHA-3 |
| HMAC | SHA-256 + secret key |
| Random generation | secrets module (CSPRNG) |

SIGNATURES:

# Ed25519 (recommended)
# Fast, secure, small signatures

# RSA with PSS (if Ed25519 unavailable)
# Minimum 2048-bit, prefer 4096-bit

PROTOCOL SECURITY:

1. TLS 1.3 (minimum)
   - Disable TLS 1.0, 1.1, 1.2 if possible
   - Use modern cipher suites
   - Enable HSTS

2. Certificate pinning
   - Pin public key or certificate
   - Backup pin for rotation

3. Perfect forward secrecy
   - ECDHE key exchange
   - Session keys not recoverable

SECURITY CHECKLIST:

[ ] No custom crypto algorithms
[ ] AES-256-GCM for symmetric encryption
[ ] RSA-4096 or Ed25519 for asymmetric
[ ] Argon2id for password hashing
[ ] Unique nonces/IVs per encryption
[ ] Encrypt-then-MAC pattern
[ ] Keys from secure key management
[ ] TLS 1.3 with strong cipher suites
[ ] Certificate pinning
[ ] Forward secrecy enabled

CRYPTO LIBRARIES:

| Language | Recommended Library |
|----------|-------------------|
| Python | cryptography, libsodium |
| Go | Go standard library (crypto) |
| Rust | ring, libsodium |
| Java | Bouncy Castle (Lightweight) |
| C/C++ | libsodium, OpenSSL (with care) |

COMMON ATTACKS:

1. SIDE-CHANNEL ATTACKS
   - Timing attacks on comparison
   - Power analysis
   - Fix: Constant-time operations

2. CHOSEN CIPHERTEXT
   - Padding oracle (CBC)
   - Fix: Use AES-GCM (authenticated)

3. KEY REUSE
   - Same key for encryption + HMAC
   - Fix: Derive separate keys

4. IV REUSE
   - Nonce collision
   - Fix: Counter-based nonce

""")

    # Run demonstration
    demonstrate_weak_crypto()

if __name__ == "__main__":
    main()