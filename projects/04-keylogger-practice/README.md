# Project 4: Make a basic keylogger for practice

## Overview

A cross-platform keylogger demonstrating how keyboard input monitoring works. This is for **educational purposes only** - understanding keyloggers is essential for defending against them.

## ⚠️ Legal and Ethical Warning

**Only use this for:**
- Learning how keyloggers work (for defense)
- Parental control on your own devices (with disclosure)
- Employee monitoring with proper consent and legal compliance
- Security research in authorized environments
- Your own computer for personal monitoring

**Never use this for:**
- Monitoring others without their knowledge or consent
- Spying on roommates, partners, or family members
- Any form of unauthorized surveillance
- Illegal activities

## Legitimate Use Cases

1. **Parental Controls** - Monitor children's keyboard activity (with their knowledge)
2. **Employee Monitoring** - Organizations may monitor company devices with proper policy
3. **Personal Backup** - Some use keyloggers to recover their own typed content
4. **Security Research** - Understanding attack vectors to build better defenses

## What It Does

- Captures all keyboard input
- Logs keystrokes with timestamps
- Provides statistics (alphabetic, numeric, special keys)
- Cross-platform (Windows, macOS, Linux with pynput)
- Optional silent/quiet mode

## Quick Start

```bash
cd 04-keylogger-practice

# Install dependency
pip install pynput

# Run
sudo python3 keylogger.py

# Quiet mode (no keystroke echo)
python3 keylogger.py -q -o /tmp/my-keys.jsonl
```

## Sample Output

```
[*] Logging keystrokes... (Ctrl+C to stop)

password123<SPACE>my<SPACE>secret<L_SHIFT>e<ENTER>

^C
==================================================
KEYLOGGER STATISTICS
==================================================
Total keystrokes: 27
Duration: 15.3 seconds
Keys per minute: 105.9

Breakdown:
  Alphabetic: 15
  Numeric: 3
  Punctuation: 3
  Special keys: 6

[+] Log saved to: logs/keystrokes.jsonl
```

## Log Format (JSON Lines)

```json
{"timestamp": "2026-04-12T10:30:00+00:00", "key": "p", "count": 1}
{"timestamp": "2026-04-12T10:30:00+00:00", "key": "a", "count": 2}
{"timestamp": "2026-04-12T10:30:01+00:00", "key": "<SPACE>", "count": 3}
{"timestamp": "2026-04-12T10:30:01+00:00", "key": "<BACKSPACE>", "count": 4}
{"type": "buffer", "content": "pass<SPACE>word..."}
```

## How It Works

1. **pynput library** - Cross-platform keyboard monitoring
2. **Keyboard events** - Captures key press and release events
3. **Character mapping** - Converts virtual key codes to readable characters
4. **Buffered logging** - Accumulates keystrokes, flushes periodically
5. **Statistics** - Tracks key type distribution

## Real Keyloggers (For Reference)

**Software:**
- **LaZagne** - Password recovery tool (legitimate security tool)
- **logkeys** - Linux keylogger
- **Hawkeye** - Commercial monitoring software

**Hardware:**
- USB keyloggers (physical devices between keyboard and computer)
- Acoustic keyloggers (typing pattern recognition)
- Electromagnetic emissions (TEMPEST attacks)

## How to Defend Against Keyloggers

1. **Use password managers** - Never type passwords directly
2. **Enable MFA** - Even if keystrokes are captured, second factor protects
3. **Virtual keyboards** - On-screen keyboards for sensitive input
4. **Regular scans** - Antivirus/anti-malware detection
5. **Hardware security** - Trusted boot, encrypted drives
6. **Network monitoring** - Detect unusual outbound data

## Detection Tips

- Unusual keyboard behavior (delays, missing characters)
- High CPU usage from unknown processes
- Strange entries in task manager
- Antivirus alerts
- Network traffic to unknown destinations

## Files

```
04-keylogger-practice/
├── keylogger.py       # Main keylogger
├── README.md         # This file
└── logs/
    └── keystrokes.jsonl  # Captured keystrokes
```
