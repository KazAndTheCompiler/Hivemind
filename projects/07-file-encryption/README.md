# Project 7: Practice encrypting files with cryptography

## Overview

A practical file encryption toolkit demonstrating modern cryptographic techniques for securing files. Supports AES-256-GCM encryption with password-derived keys.

## ⚠️ Important Notes

- This toolkit is for learning and securing YOUR OWN files
- Always use strong, unique passwords
- Consider using a password manager
- Lost passwords cannot be recovered (by design)

## Cryptographic Techniques Demonstrated

### 1. Key Derivation (PBKDF2)
Converts a password into a cryptographic key using:
- Salt (random per-file, stored in header)
- 100,000 iterations
- SHA-256 as the underlying hash

### 2. Symmetric Encryption (AES-256-GCM)
- **AES-256**: 256-bit key, industry standard
- **GCM Mode**: Provides both confidentiality AND authentication
- **Authenticated Encryption**: Detects tampering automatically

### 3. Secure File Format
```
[MAGIC][VERSION][ALGORITHM][SALT][NONCE][CIPHERTEXT]
```

| Field | Purpose | Size |
|-------|---------|------|
| MAGIC | File identification | 4 bytes |
| VERSION | Format version | 1 byte |
| ALGORITHM | Encryption algorithm | Variable |
| SALT | Key derivation salt | 16 bytes |
| NONCE | Encryption nonce | 12 bytes |
| CIPHERTEXT | Encrypted data | Variable |

## Quick Start

```bash
cd 07-file-encryption

# Encrypt a file
python3 encrypt.py encrypt secrets.txt
# Enter password when prompted

# Decrypt a file
python3 encrypt.py decrypt secrets.txt.enc

# Calculate file hashes
python3 encrypt.py hash document.pdf

# Generate a strong password
python3 encrypt.py genpass -l 24
```

## Usage Examples

### Encrypting a File
```bash
$ python3 encrypt.py encrypt financial_records.odt

[*] Reading: financial_records.odt
[*] Encrypting 45876 bytes...
[*] Writing: financial_records.odt.enc
[+] Encrypted financial_records.odt -> financial_records.odt.enc
[+] Encrypted file size: 45904 bytes
```

### Decrypting
```bash
$ python3 encrypt.py decrypt financial_records.odt.enc

Password: ************
[*] Reading: financial_records.odt.enc
[*] Decrypting...
[*] Writing: financial_records.odt
[+] Decrypted financial_records.odt.enc -> financial_records.odt
```

### Hash Verification
```bash
$ python3 encrypt.py hash important_document.pdf

[*] Calculating hashes for: important_document.pdf
    MD5:    d41d8cd98f00b204e9800998ecf8427e
    SHA1:   da39a3ee5e6b4b0d3255bfef95601890afd80709
    SHA256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

## Security Properties

| Property | How It's Achieved |
|----------|-------------------|
| Confidentiality | AES-256-GCM encryption |
| Integrity | GCM authentication tag |
| Key Derivation | PBKDF2 with 100k iterations |
| Randomness | os.urandom() for all salts/nonces |
| Password Strength | No restrictions (you choose) |

## Why These Choices?

### AES-256-GCM
- **Industry Standard**: Used by governments and enterprises worldwide
- **256-bit Keys**: Provides ample security margin
- **GCM Mode**: Fast authenticated encryption in hardware

### PBKDF2 with High Iterations
- Slows down brute-force attacks
- Makes password guessing computationally expensive
- Salt prevents rainbow table attacks

## Best Practices

1. **Use Strong Passwords**
   - Minimum 12 characters
   - Mix of character types
   - Use a password manager

2. **Protect Your Passwords**
   - Never share encryption passwords
   - Use a password manager
   - Enable MFA wherever possible

3. **Backup Important Files**
   - Encrypted files can still be lost
   - Keep backups in multiple locations
   - Test restoration periodically

4. **Secure Deletion**
   - Simply deleting files doesn't remove data
   - Use `shred` to overwrite file contents
   - Secure wipe free space if needed

## Production Alternatives

For real-world file encryption, consider:
- **GPG/GnuPG**: Industry-standard open-source encryption
- **OpenSSL**: Command-line encryption tool
- **VeraCrypt**: Full-disk encryption
- **7-Zip**: Simple archive encryption
- **age**: Modern, simple encryption tool

## Files

```
07-file-encryption/
├── encrypt.py      # Main encryption toolkit
├── README.md       # This file
└── *.enc          # Encrypted files (output)
```
