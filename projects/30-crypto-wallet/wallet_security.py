#!/usr/bin/env python3
"""
Secure Cryptocurrency Wallet - Project 30
Best practices for securing crypto assets.

EDUCATIONAL USE ONLY. For understanding wallet security concepts.
"""

import hashlib
import secrets
import json
from typing import Dict, List, Optional

class SecureCryptoWallet:
    """Educational crypto wallet security concepts."""
    
    @staticmethod
    def generate_mnemonic(strength: int = 256) -> str:
        """Generate BIP39 mnemonic phrase."""
        # Simplified - use proper libraries in production!
        words = [
            "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract",
            "absurd", "abuse", "access", "accident", "account", "accuse", "achieve", "acid",
            "acoustic", "acquire", "across", "act", "action", "actor", "actress", "actual"
        ]
        
        entropy = secrets.randbits(strength)
        mnemonic = []
        
        for i in range(strength // 11):
            index = entropy >> (strength - (i + 1) * 11) & 0x7FF
            mnemonic.append(words[index % len(words)])
        
        return " ".join(mnemonic[:24])
    
    @staticmethod
    def derive_key(mnemonic: str, passphrase: str = "") -> bytes:
        """Derive master key from mnemonic (simplified)."""
        # In production, use proper BIP39/BIP32 derivation!
        key = hashlib.pbkdf2_hmac(
            'sha512',
            mnemonic.encode(),
            ('mnemonic' + passphrase).encode(),
            2048
        )
        return key[:32]
    
    @staticmethod
    def generate_address(public_key: bytes) -> str:
        """Generate address from public key (simplified)."""
        sha = hashlib.sha256(public_key).digest()
        ripemd = hashlib.new('ripemd160', sha).digest()
        return "0x" + ripemd.hex()[:40]

def main():
    print("""
╔════════════════════════════════════════════════════════════════╗
║     Secure Cryptocurrency Wallet - Project 30                  ║
╚════════════════════════════════════════════════════════════════╝

WALLET TYPES:

| Type | Security | Convenience | Best For |
|------|----------|-------------|----------|
| Hardware | Max | Low | Large holdings |
| Software | Medium | High | Daily use |
| Paper | High | Low | Cold storage |
| Custodial | Low | Max | Trading |

SECURITY BEST PRACTICES:

1. USE HARDWARE WALLET FOR LARGE HOLDINGS
   - Ledger, Trezor, Coldcard
   - Private keys never leave device
   - PIN + passphrase protection

2. NEVER SHARE SEED PHRASE
   - 12/24 words = complete control
   - Anyone with seed = access to funds
   - Write on paper, not digitally

3. USE MULTISIG FOR LARGE AMOUNTS
   - Require multiple keys to spend
   - 2-of-3, 3-of-5 configurations
   - Distributed key storage

4. ENABLE ALL SECURITY FEATURES
   - PIN/biometric on mobile
   - Auto-lock timeout
   - Network filtering (block suspicious txs)

5. SECURE YOUR COMPUTER
   - Use dedicated air-gapped computer
   - Keep OS/software updated
   - Enable firewall
   - Use VPN

COLD STORAGE SETUP:

1. Buy hardware wallet from official source
2. Generate seed OFFLINE
3. Write seed on metal plate (fireproof)
4. Store seed in safe deposit box
5. Test small amount before large deposit

WATCHOUT FOR SCAMS:

[!] NEVER:
- Share your seed phrase
- Send crypto to "verify" address
- Click crypto links in DMs
- Trust "support" DMs
- Use unverified exchanges

[!] COMMON ATTACKS:
- Phishing (fake websites)
- Malware (clipboard swap)
- SIM swapping (phone number)
- Rubber hose (physical torture)
- Dusting (tracking)

RECOVERY OPTIONS:

1. SEED PHRASE
   - 12 or 24 words
   - BIP39 standard
   - Hardware + paper backup

2. MULTISIG RECOVERY
   - Multiple key holders
   - Geographic distribution
   - Requires quorum

3. SOCIAL RECOVERY
   - Trusted guardians
   - Shamir's Secret Sharing
   - Threshold schemes

WALLET SECURITY CHECKLIST:

[ ] Hardware wallet for >$1000
[ ] Seed written on metal, not paper
[ ] Multiple backup locations
[ ] PIN enabled (not simple)
[ ] Passphrase enabled (optional)
[ ] Check address before sending
[ ] Verify transaction on device
[ ] Enable all security features
[ ] Regular security audits
[ ] Succession plan documented

""")
    
    # Demo
    wallet = SecureCryptoWallet()
    print("\n[*] Generating demo mnemonic...")
    mnemonic = wallet.generate_mnemonic(256)
    print(f"\n    Mnemonic: {mnemonic}")
    print("\n[!] IMPORTANT: This is for education only!")
    print("    Never use demo code for real funds!")

if __name__ == "__main__":
    main()
