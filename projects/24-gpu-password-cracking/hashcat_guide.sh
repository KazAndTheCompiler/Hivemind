#!/bin/bash
# GPU Password Cracking Guide - Project 24
# Using hashcat for high-speed password cracking

echo "
╔════════════════════════════════════════════════════════════════╗
║     GPU Password Cracking Guide - Project 24                  ║
║     EDUCATIONAL USE ONLY                                     ║
╚════════════════════════════════════════════════════════════════╝

INSTALLING HASHCAT:

# From source (recommended)
git clone https://github.com/hashcat/hashcat.git
cd hashcat
make
sudo make install

# Or via package manager
# Debian/Ubuntu: apt install hashcat

BASIC USAGE:

# Crack MD5 hash with wordlist
hashcat -m 0 -a 0 hash.txt wordlist.txt

# Crack SHA256 with rule-based attack
hashcat -m 1400 -a 0 hash.txt wordlist.txt -r rules/best64.rule

# Brute force (8 chars, lowercase)
hashcat -m 0 -a 3 hash.txt ?l?l?l?l?l?l?l?l

HASH MODES (-m):

| Mode | Hash Type |
|------|-----------|
| 0 | MD5 |
| 100 | SHA1 |
| 1400 | SHA256 |
| 1700 | SHA512 |
| 22000 | WPA-PBKDF2 |
| 1000 | NTLM |
| 5500 | NetNTLMv1/v2 |

ATTACK MODES (-a):

| Mode | Name | Description |
|------|------|-------------|
| 0 | Straight | Wordlist attack |
| 1 | Combination | Two wordlists |
| 3 | Brute-force | Mask attack |
| 6 | Hybrid Wordlist + Mask | Wordlist + mask |
| 7 | Hybrid Mask + Wordlist | Mask + wordlist |

MASK CHARSETS:

| Char | Meaning |
|------|---------|
| ?l | lowercase a-z |
| ?u | uppercase A-Z |
| ?d | digits 0-9 |
| ?s | special characters |
| ?a | all characters |
| ?b | binary (0x00-0xff) |

EXAMPLE MASKS:

?l?l?l?l?l?l?l?l    = 8 lowercase letters
?u?l?l?d?d?d?d?d    = 1 uppercase + 1 lowercase + 5 digits
?a?a?a?a?a?a?a?a    = 8 of any character

PERFORMANCE:

| GPU | Speed (MD5) |
|-----|-------------|
| RTX 3090 | ~50 billion/sec |
| RTX 3080 | ~40 billion/sec |
| GTX 1080 | ~20 billion/sec |

CRACKING WPA/WPA2:

# Extract handshake with hcxdumptool
sudo hcxdumptool -i wlan0mon -o capture.pcap

# Convert to hashcat format
hcxpcaptool -z wpa01.txt capture.pcap

# Crack with wordlist
hashcat -m 22000 -a 0 wpa01.txt wordlist.txt

RULES FILES:

# best64.rule - Most effective rules
# rockyou-瘫5.rule - Based on leaked passwords
# dive.rule - Deep hybrid rules

TIME ESTIMATES (RTX 3090):

| Password | Time |
|---------|------|
| 6 lowercase | Instant |
| 7 lowercase | 30 sec |
| 8 lowercase | 12 min |
| 8 mixed case+nums | 6 years |

PASSWORD POLICY RECOMMENDATIONS:

To survive GPU cracking:
- Minimum 12 characters
- Mix of character types
- Don't use common patterns
- Use unique passwords per service
- Enable MFA wherever possible

"

# Check if installed
if command -v hashcat &> /dev/null; then
    echo -e \"\\n[+] Hashcat installed\"
    hashcat --version
else
    echo -e \"\\n[!] Hashcat not installed\"
fi
