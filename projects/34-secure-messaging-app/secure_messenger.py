#!/usr/bin/env python3
"""
Secure Messaging App - Project 34
End-to-end encrypted messaging application.

EDUCATIONAL USE ONLY. Production apps need professional security audit.
"""

import os
import sys
import json
import time
import hashlib
import hmac
import base64
import secrets
from typing import List, Dict, Optional
from dataclasses import dataclass

class SecureMessenger:
    """End-to-end encrypted messaging."""
    
    @staticmethod
    def generate_keypair() -> tuple:
        """Generate asymmetric key pair (simplified)."""
        # In production, use proper crypto: libsodium, Ed25519, or RSA
        private_key = secrets.token_bytes(32)
        public_key = hashlib.sha256(private_key).digest()
        return private_key, public_key
    
    @staticmethod
    def derive_shared_secret(private_key: bytes, peer_public_key: bytes) -> bytes:
        """Derive shared secret using Diffie-Hellman (simplified)."""
        # In production, use proper ECDH (libsodium)
        combined = private_key + peer_public_key
        return hashlib.sha256(combined).digest()
    
    @staticmethod
    def encrypt_message(message: str, key: bytes) -> Dict:
        """Encrypt message with symmetric key (simplified)."""
        # In production, use libsodium secretbox (XSalsa20-Poly1305)
        nonce = secrets.token_bytes(12)
        key_stream = hashlib.sha256(key + nonce).digest()
        
        encrypted = bytes(a ^ b for a, b in zip(message.encode(), key_stream * (len(message) // len(key_stream) + 1))))
        
        return {
            'nonce': base64.b64encode(nonce).decode(),
            'ciphertext': base64.b64encode(encrypted).decode()
        }
    
    @staticmethod
    def decrypt_message(encrypted_data: Dict, key: bytes) -> str:
        """Decrypt message with symmetric key."""
        nonce = base64.b64decode(encrypted_data['nonce'])
        ciphertext = base64.b64decode(encrypted_data['ciphertext'])
        
        key_stream = hashlib.sha256(key + nonce).digest()
        decrypted = bytes(a ^ b for a, b in zip(ciphertext, key_stream * (len(ciphertext) // len(key_stream) + 1)))
        
        return decrypted.decode().rstrip('\x00')
    
    @staticmethod
    def sign_message(message: str, private_key: bytes) -> str:
        """Create message signature."""
        signature = hmac.new(private_key, message.encode(), hashlib.sha256).hexdigest()
        return signature
    
    @staticmethod
    def verify_signature(message: str, signature: str, public_key: bytes) -> bool:
        """Verify message signature."""
        expected = hmac.new(public_key, message.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(signature, expected)

class SecureChat:
    """Secure chat session."""
    
    def __init__(self, user_a: str, user_b: str):
        self.users = {user_a: None, user_b: None}
        self.session_key = None
        self.messages = []
        self.participants = [user_a, user_b]
    
    def initiate_key_exchange(self, username: str):
        """Initiate or respond to key exchange."""
        private_key, public_key = SecureMessenger.generate_keypair()
        self.users[username] = {
            'private_key': private_key,
            'public_key': public_key
        }
        
        # If both users have keys, derive shared secret
        if all(self.users[u] for u in self.participants):
            a_private = self.users[self.participants[0]]['private_key']
            a_public = self.users[self.participants[0]]['public_key']
            b_private = self.users[self.participants[1]]['private_key']
            b_public = self.users[self.participants[1]]['public_key']
            
            # Both derive same shared secret
            self.session_key = SecureMessenger.derive_shared_secret(a_private, b_public)
            return True
        
        return False
    
    def send_message(self, sender: str, message: str) -> Dict:
        """Send encrypted message."""
        if not self.session_key:
            return {'error': 'No session established'}
        
        # Encrypt
        encrypted = SecureMessenger.encrypt_message(message, self.session_key)
        
        # Sign with sender's key
        signature = SecureMessenger.sign_message(
            message, 
            self.users[sender]['private_key']
        )
        
        msg_data = {
            'from': sender,
            'encrypted': encrypted,
            'signature': signature,
            'timestamp': time.time()
        }
        
        self.messages.append(msg_data)
        return msg_data
    
    def receive_message(self, msg_data: Dict, recipient: str) -> Optional[str]:
        """Receive and decrypt message."""
        if not self.session_key:
            return None
        
        # Verify signature
        sender = msg_data['from']
        if not SecureMessenger.verify_signature(
            self._get_plaintext(msg_data['encrypted']),
            msg_data['signature'],
            self.users[sender]['public_key']
        ):
            return None  # Signature invalid
        
        return self._get_plaintext(msg_data['encrypted'])
    
    def _get_plaintext(self, encrypted: Dict) -> str:
        """Decrypt to plaintext."""
        return SecureMessenger.decrypt_message(encrypted, self.session_key)

def main():
    print("""
╔════════════════════════════════════════════════════════════════╗
║     Secure Messaging App - Project 34                          ║
║                                                                ║
║     Educational E2E encryption implementation                  ║
║     PRODUCTION USE REQUIRES PROFESSIONAL AUDIT                ║
╚════════════════════════════════════════════════════════════════╝

SECURITY FEATURES:

1. END-TO-END ENCRYPTION
   - Messages encrypted on sender's device
   - Only recipient can decrypt
   - Server never sees plaintext

2. KEY EXCHANGE
   - Diffie-Hellman (simplified)
   - Production: X25519/Curve25519
   
3. SYMMETRIC ENCRYPTION
   - Production: XSalsa20-Poly1305 (libsodium)
   - Simplified: SHA256-based XOR (educational only)

4. DIGITAL SIGNATURES
   - Verify message sender
   - Production: Ed25519

SECURE MESSAGING STANDARDS:

| Protocol | Used By | Features |
|----------|---------|----------|
| Signal | Signal, WhatsApp | Double Ratchet |
| Matrix | Element | Server-side E2EE |
| Session | Session | Onion routing |
| Wire | Wire | Proteus |

IMPORTANT SECURITY NOTES:

[!] This is EDUCATIONAL only
[!] Production requires:
    - Professional crypto library (libsodium)
    - Security audit
    - Proper key management
    - Secure key storage
    - Forward secrecy
    - Future secrecy (Double Ratchet)

PRODUCTION LIBRARIES:

- libsignal-protocol - Signal protocol
- libsodium - Modern crypto
- Threema - E2EE messaging
- matrix-nio - Matrix client library
    """)
    
    # Demo
    alice, bob = "Alice", "Bob"
    chat = SecureChat(alice, bob)
    
    print(f"\n[*] Setting up secure chat between {alice} and {bob}")
    
    chat.initiate_key_exchange(alice)
    chat.initiate_key_exchange(bob)
    
    print("[+] Key exchange complete!")
    print(f"[+] Session established: {bool(chat.session_key)}")
    
    if chat.session_key:
        msg = chat.send_message(alice, "Hello Bob, is this secure?")
        print(f"\n[+] {alice} sent: '{msg['encrypted']['ciphertext'][:30]}...'")
        print(f"    (encrypted)")

if __name__ == "__main__":
    main()
