#!/usr/bin/env python3
"""
Simple Password Cracker - Project 2
Demonstrates common password cracking techniques:
- Dictionary attack
- Brute force (short passwords)
- Hybrid attack (word + variations)
- Hash comparison (MD5, SHA1, SHA256)

EDUCATIONAL USE ONLY. Only crack passwords you own or have explicit permission to test.
"""

import hashlib
import string
import itertools
import time
import json
import sys
from pathlib import Path
from typing import Optional, Callable

# Character sets for brute force
CHARSET_LOWER = string.ascii_lowercase
CHARSET_ALPHA = string.ascii_letters
CHARSET_ALPHANUM = string.ascii_letters + string.digits
CHARSET_FULL = string.ascii_letters + string.digits + string.punctuation

DEFAULT_WORDLIST = "/usr/share/wordlists/rockyou.txt"
HASH_LOG = Path(__file__).parent / "logs" / "cracked.json"
HASH_LOG.parent.mkdir(exist_ok=True)

def md5_hash(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()

def sha1_hash(text: str) -> str:
    return hashlib.sha1(text.encode()).hexdigest()

def sha256_hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()

def hash_password(password: str, algorithm: str = "md5") -> str:
    """Hash a password with the specified algorithm."""
    if algorithm == "md5":
        return md5_hash(password)
    elif algorithm == "sha1":
        return sha1_hash(password)
    elif algorithm == "sha256":
        return sha256_hash(password)
    raise ValueError(f"Unknown algorithm: {algorithm}")

def load_wordlist(wordlist_path: str) -> list[str]:
    """Load a wordlist file."""
    try:
        with open(wordlist_path, 'r', encoding='utf-8', errors='ignore') as f:
            return [line.strip() for line in f if line.strip()]
    except FileNotFoundError:
        print(f"[!] Wordlist not found: {wordlist_path}")
        return get_common_passwords()

def get_common_passwords() -> list[str]:
    """Return a small list of common passwords as fallback."""
    return [
        "123456", "password", "12345678", "qwerty", "abc123",
        "monkey", "1234567", "letmein", "trustno1", "dragon",
        "baseball", "iloveyou", "master", "sunshine", "ashley",
        "football", "password1", "shadow", "123123", "654321",
        "superman", "qazwsx", "michael", "password123", "welcome"
    ]

def dictionary_attack(wordlist: list[str], target_hash: str, algorithm: str = "md5", 
                      progress: bool = True) -> Optional[str]:
    """Try each word in the wordlist."""
    total = len(wordlist)
    for i, word in enumerate(wordlist):
        if progress and i % 10000 == 0:
            print(f"\r[*] Dictionary: {i}/{total} tried...", end="", flush=True)
        
        word_hash = hash_password(word, algorithm)
        if word_hash.lower() == target_hash.lower():
            print(f"\r[+] FOUND: '{word}' (tried {i+1} words)")
            return word
    
    if progress:
        print(f"\r[*] Dictionary complete. {total} words tried. Not found.")
    return None

def brute_force_attack(target_hash: str, max_length: int, charset: str, 
                       algorithm: str = "md5") -> Optional[str]:
    """Brute force all combinations up to max_length."""
    print(f"[*] Brute forcing (max {max_length} chars, charset size: {len(charset)})...")
    
    start_time = time.time()
    total_tried = 0
    
    for length in range(1, max_length + 1):
        print(f"[*] Trying length {length}...", end="", flush=True)
        combos = len(charset) ** length
        print(f" ({combos:,} combinations)")
        
        for attempt in itertools.product(charset, repeat=length):
            password = ''.join(attempt)
            total_tried += 1
            
            if total_tried % 100000 == 0:
                elapsed = time.time() - start_time
                rate = total_tried / elapsed
                print(f"\r[*] Rate: {rate:,.0f}/sec | Tried: {total_tried:,}", end="", flush=True)
            
            word_hash = hash_password(password, algorithm)
            if word_hash.lower() == target_hash.lower():
                elapsed = time.time() - start_time
                print(f"\r[+] FOUND: '{password}' after {total_tried:,} attempts in {elapsed:.2f}s")
                return password
    
    elapsed = time.time() - start_time
    print(f"\r[*] Brute force complete. {total_tried:,} combinations tried in {elapsed:.2f}s")
    return None

def hybrid_attack(wordlist: list[str], target_hash: str, algorithm: str = "md5",
                  max_variations: int = 10000) -> Optional[str]:
    """Append/prepend numbers and symbols to wordlist words."""
    print(f"[*] Hybrid attack (appending numbers 0-999)...")
    
    variations = [
        "", "0", "1", "12", "123", "1234", "12345", "123456",
        "!", "!!", "1!", "!1", "123!",
        "2020", "2021", "2022", "2023", "2024",
        "01", "02", "03", "90", "99"
    ]
    
    total = len(wordlist) * len(variations)
    tried = 0
    
    for word in wordlist[:1000]:  # Limit to first 1000 words for performance
        for suffix in variations:
            tried += 1
            password = word + suffix
            word_hash = hash_password(password, algorithm)
            
            if word_hash.lower() == target_hash.lower():
                print(f"[+] FOUND: '{password}'")
                return password
    
    print(f"[*] Hybrid: tried {tried:,} variations. Not found.")
    return None

def simple_hash_match(target: str, algorithm: str = "md5") -> Optional[str]:
    """Check against precomputed common hash comparisons."""
    common = {
        # MD5
        "5f4dcc3b5aa765d61d8327deb882cf99": "password",
        "e10adc3949ba59abbe56e057f20f883e": "123456",
        "d8578edf8458ce06fbc5bb76a58c5ca4": "qwerty",
        "25d55ad283aa400af464c76d713c07ad": "12345678",
        "81dc9bdb52d04dc20036dbd8313ed055": "1234567890",
        "670b14728ad9902aecba32e22fa4f6bd": "000000",
        "21232f297a57a5a743894a0e4a801fc3": "admin",
        "ee11cbb19052e40b07aac0ca060c23ee": "user",
        # SHA1
        "5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8": "password",
        "8cb2237d0679ca88db6464eac60da96345513964": "12345678",
    }
    
    target_lower = target.lower()
    if target_lower in common:
        print(f"[*] Quick lookup match found: '{common[target_lower]}'")
        return common[target_lower]
    return None

def crack_hash(target_hash: str, wordlist_path: str = DEFAULT_WORDLIST,
               max_brute_length: int = 4, algorithm: str = "md5",
               use_dict: bool = True, use_brute: bool = True,
               use_hybrid: bool = True) -> Optional[str]:
    """
    Main cracking function. Tries multiple strategies in order.
    """
    print(f"\n{'='*50}")
    print(f"Password Cracker - {algorithm.upper()} Hash")
    print(f"Target: {target_hash}")
    print(f"{'='*50}\n")
    
    # Check quick lookup first
    result = simple_hash_match(target_hash, algorithm)
    if result:
        return result
    
    # Dictionary attack
    if use_dict:
        print(f"[*] Loading wordlist...")
        wordlist = load_wordlist(wordlist_path)
        print(f"[*] Loaded {len(wordlist)} words\n")
        
        result = dictionary_attack(wordlist, target_hash, algorithm)
        if result:
            return result
    
    # Hybrid attack  
    if use_hybrid:
        print()
        result = hybrid_attack(wordlist if 'wordlist' in dir() else get_common_passwords(),
                             target_hash, algorithm)
        if result:
            return result
    
    # Brute force (only for short max lengths - computational cost grows exponentially)
    if use_brute and max_brute_length <= 6:
        print()
        result = brute_force_attack(target_hash, max_brute_length, 
                                   CHARSET_ALPHANUM, algorithm)
        if result:
            return result
    elif use_brute and max_brute_length > 6:
        print(f"[!] Skipping brute force: {max_brute_length} chars too expensive")
        print(f"    Brute force for {max_brute_length} chars would take years")
    
    print(f"\n[-] Password not cracked with available methods.")
    return None

def demo_mode():
    """Demonstrate the password cracker with known hashes."""
    print("\n" + "="*60)
    print("PASSWORD CRACKER DEMO MODE")
    print("="*60)
    
    test_cases = [
        ("password", "md5"),
        ("password123", "md5"),
        ("admin", "sha1"),
        ("qwerty", "sha256"),
        ("hello", "md5"),
    ]
    
    for password, algo in test_cases:
        h = hash_password(password, algo)
        print(f"\n[*] Hash: {h} ({algo})")
        print(f"[*] Cracking...")
        result = crack_hash(h, algorithm=algo, use_brute=False, use_hybrid=True)
        status = "✓" if result == password else "✗"
        print(f"{status} Result: {result} (expected: {password})")
    
    print("\n" + "="*60)

def main():
    print("""
    ╔═══════════════════════════════════════════════════════╗
    ║     Simple Password Cracker - Project 2              ║
    ║                                                       ║
    ║     EDUCATIONAL USE ONLY                              ║
    ║     Only crack passwords you own or have permission   ║
    ╚═══════════════════════════════════════════════════════╝
    """)
    
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 password_cracker.py <hash> [algorithm] [options]")
        print("")
        print("Examples:")
        print("  python3 password_cracker.py 5f4dcc3b5aa765d61d8327deb882cf99")
        print("  python3 password_cracker.py 5f4dcc3b5aa765d61d8327deb882cf99 md5")
        print("  python3 password_cracker.py --demo")
        print("")
        print("Algorithms: md5, sha1, sha256 (default: md5)")
        sys.exit(1)
    
    if sys.argv[1] == "--demo":
        demo_mode()
        sys.exit(0)
    
    target_hash = sys.argv[1]
    algorithm = sys.argv[2] if len(sys.argv) > 2 else "md5"
    
    result = crack_hash(target_hash, algorithm=algorithm)
    
    if result:
        print(f"\n[+] PASSWORD CRACKED: {result}")
    else:
        print(f"\n[-] Could not crack {target_hash}")
    
    return 0 if result else 1

if __name__ == "__main__":
    sys.exit(main() or 0)
