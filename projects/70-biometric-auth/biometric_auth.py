#!/usr/bin/env python3
"""
Biometric Authentication System - Project 70
Build a basic biometric authentication system.

EDUCATIONAL USE ONLY. For understanding biometric security concepts.
"""

import os
import sys
import json
import hashlib
from typing import Dict, List, Optional

class BiometricAuth:
    """Educational biometric authentication system."""
    
    # Simplified biometric matching (real systems use templates)
    BIOMETRIC_TYPES = ['fingerprint', 'face', 'iris', 'voice']
    
    def __init__(self):
        self.users = {}
        self.enrollment_threshold = 0.85
        self.verification_threshold = 0.90
    
    def enroll(self, user_id: str, biometric_type: str, template_data: bytes) -> bool:
        """Enroll a new biometric."""
        if biometric_type not in self.BIOMETRIC_TYPES:
            return False
        
        # Create template hash (in real systems, store template securely)
        template_hash = hashlib.sha256(template_data + user_id.encode()).digest()
        
        self.users[user_id] = {
            'biometric_type': biometric_type,
            'template_hash': template_hash.hex(),
            'enrolled': True
        }
        
        return True
    
    def verify(self, user_id: str, biometric_data: bytes) -> Dict:
        """Verify biometric against enrolled template."""
        if user_id not in self.users:
            return {
                'verified': False,
                'confidence': 0.0,
                'error': 'User not enrolled'
            }
        
        # Compute hash of provided data
        provided_hash = hashlib.sha256(biometric_data + user_id.encode()).digest()
        
        # Compare (simplified - real systems use more sophisticated matching)
        stored_hex = self.users[user_id]['template_hash']
        stored_bytes = bytes.fromhex(stored_hex)
        
        # Calculate similarity (simplified)
        match_bits = sum(b1 ^ b2 for b1, b2 in zip(provided_hash, stored_bytes))
        total_bits = len(provided_hash) * 8
        similarity = 1.0 - (match_bits / total_bits)
        
        verified = similarity >= self.verification_threshold
        
        return {
            'verified': verified,
            'confidence': similarity,
            'user_id': user_id,
            'biometric_type': self.users[user_id]['biometric_type']
        }
    
    def authenticate(self, user_id: str, biometric_data: bytes, admin_override: bool = False) -> bool:
        """Main authentication method."""
        result = self.verify(user_id, biometric_data)
        return result['verified']

def demonstrate_fingerprint():
    """Demonstrate fingerprint authentication."""
    print("\n[*] Fingerprint Authentication Demo\n")
    
    auth = BiometricAuth()
    
    # Enroll user
    user_id = "user123"
    fingerprint_data = b"fingerprint_template_data_" + os.urandom(32)
    
    success = auth.enroll(user_id, 'fingerprint', fingerprint_data)
    print(f"[+] Enrolled user: {success}")
    
    # Verify with correct data
    result = auth.verify(user_id, fingerprint_data)
    print(f"    Verification: {result}")
    
    # Verify with wrong data
    wrong_data = b"wrong_fingerprint_" + os.urandom(32)
    result = auth.verify(user_id, wrong_data)
    print(f"    Wrong data verification: {result}")

def demonstrate_face():
    """Demonstrate face recognition."""
    print("\n[*] Face Recognition Demo\n")
    
    auth = BiometricAuth()
    
    # Enroll
    user_id = "admin"
    face_data = b"face_template_128x128_" + os.urandom(64)
    
    success = auth.enroll(user_id, 'face', face_data)
    print(f"[+] Enrolled admin: {success}")
    
    # Verify
    result = auth.verify(user_id, face_data)
    print(f"    Verification: {result}")

def main():
    print("""
╔════════════════════════════════════════════════════════════════╗
║     Biometric Authentication System - Project 70               ║
╚════════════════════════════════════════════════════════════════╝

BIOMETRIC AUTHENTICATION TYPES:

| Type | Accuracy | Use Case | Concerns |
|------|----------|----------|----------|
| Fingerprint | High | Mobile, access | Fake fingerprints |
| Face | Medium-High | Surveillance, mobile | Photos, deepfakes |
| Iris | Very High | High-security | Camera quality |
| Voice | Medium | Phone, speaker | Replay attacks |
| Vein | Very High | Banking | Device cost |

SECURITY CONSIDERATIONS:

1. BIOMETRIC STORAGE
   - NEVER store raw biometric data
   - Store templates (hashed)
   - Use hardware security module
   
2. MULTI-FACTOR
   - Something you know (PIN)
   - Something you have (biometric)
   - Something you are (biometric)
   
3. LIVENESS DETECTION
   - Prevent fake biometrics
   - Check for blood flow (fingerprints)
   - Check for eye movement (iris)
   - Challenge-response (face)

FRAUD PREVENTION:

1. PRESENTATION ATTACKS
   - Photos, videos, 3D prints
   - Silicone fingerprints
   - Recording replay
   
2. SPOOFING
   - Deepfakes for face
   - Voice synthesis
   - Replay attacks

COUNTERMEASURES:

| Attack | Defense |
|--------|---------|
| Photo attack | Liveness detection |
| 3D mask | Depth sensing |
| Fingerprint silicone | Perspiration, pulse detection |
| Voice recording | Challenge-response |
| Replay | Session nonce |

IMPLEMENTATION BEST PRACTICES:

1. ENROLLMENT
   - Multiple samples
   - Quality check
   - User feedback
   
2. VERIFICATION
   - Threshold tuning
   - Liveness check
   - Anti-spoofing
   
3. STORAGE
   - HSM for templates
   - Never store raw data
   - Encrypt at rest

4. PRIVACY
   - GDPR considerations
   - Consent required
   - Data minimization

SECURITY CHECKLIST:

[ ] Templates stored securely (HSM)
[ ] Liveness detection enabled
[ ] Anti-spoofing measures
[ ] Multi-factor authentication
[ ] Logging of attempts
[ ] Privacy policy posted
[ ] Regular security audits
[ ] Biometric data minimization
[ ] Secure deletion capability
[ ] Incident response plan

STANDARDS:

| Standard | Description |
|----------|-------------|
| ISO/IEC 19795 | Biometric performance |
| ISO/IEC 30107 | Presentation attack detection |
| FIDO2 | Passwordless authentication |
| NIST 800-76 | PIV biometric specifications |

TOOLS:

| Tool | Purpose |
|------|---------|
| OpenCV | Face detection |
| Dlib | Face recognition |
| liveness-detection | Anti-spoofing |
| bioenable | Hardware integration |

""")
    
    # Run demonstrations
    demonstrate_fingerprint()
    demonstrate_face()
    
    print("\n[*] Biometric system demonstration complete")
    print("[!] Note: Real biometric systems require specialized hardware")

if __name__ == "__main__":
    main()