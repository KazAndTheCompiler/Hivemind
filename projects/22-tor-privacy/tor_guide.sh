#!/bin/bash
# Tor and Privacy Tools Guide - Project 22

echo "
╔════════════════════════════════════════════════════════════════╗
║     Tor and Privacy Guide - Project 22                        ║
╚════════════════════════════════════════════════════════════════╝

UNDERSTANDING TOR:

Tor (The Onion Router) routes traffic through multiple relays,
encrypting at each layer to protect privacy.

HOW TOR WORKS:

1. Your traffic → Entry Node (knows your IP)
2. Entry Node → Middle Node (can't see your traffic)
3. Middle Node → Exit Node (knows destination)
4. Exit Node → Destination server

Each layer is 'peeled' like an onion - hence the name.

TOR CIRCUIT:
[YOU] → [ENTRY GUARD] → [MIDDLE] → [EXIT] → [DESTINATION]

TOR INSTALLATION:

# Debian/Ubuntu
sudo apt install tor

# macOS
brew install tor

# Run Tor browser
./tor-browser_en-US/Browser/start-tor-browser

USEFUL COMMANDS:

# Start Tor service
sudo systemctl start tor

# Test Tor connection
torsocks curl https://check.torproject.org

# Verify exit node
curl -s https://check.torproject.org/api/ip

TOR CONFIGURATION:

/etc/tor/torrc - Tor configuration file
ControlPort 9051 - Tor control port
SOCKSPort 9050 - SOCKS proxy port
DataDirectory /var/lib/tor - Tor data directory

PRIVACY TOOLS:

1. Tails OS
   - Live USB OS
   - Routes all traffic through Tor
   - Leaves no traces

2. Whonix
   - Two VM setup
   - Workstation + Gateway
   - Hardened for privacy

3. Orbot (Android)
   - Tor for Android
   - Per-app proxying

IMPORTANT PRIVACY PRACTICES:

1. Disable JavaScript in Tor Browser
2. Don't use personal accounts
3. Don't login to real accounts
4. Use HTTPS whenever possible
5. Don't torrent over Tor
6. Don't maximize windows (fingerprinting)

LIMITATIONS OF TOR:

[!] Tor is NOT:
- 100% anonymous
- Protection against all threats
- A VPN replacement
- Legal immunity

[!] Tor CANNOT protect against:
- Traffic confirmation attacks
- Endpoint exploitation
- User error/mistakes
- Timing attacks (in some cases)

LEGITIMATE USES OF TOR:

- Protecting journalists and sources
- Human rights workers communication
- Bypassing censorship
- Research and security analysis
- Privacy from surveillance

ILLEGAL USES OF TOR:

- Drug trafficking
- Money laundering
- Illegal content distribution
- Any unlawful activity

Remember: Tor provides privacy, NOT invisibility.

"

# Install check
if command -v tor &> /dev/null; then
    echo -e \"[+] Tor is installed\"
else
    echo -e \"[!] Tor not installed - see guide above for installation\"
fi
