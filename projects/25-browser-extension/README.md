# Project 25: Create a browser extension for security

## Overview

Basic browser extension demonstrating security indicators for HTTPS detection.

## Features

- HTTPS status indicator
- Login form detection
- Insecure cookie warnings
- Visual warning on HTTP pages with login forms

## Setup

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `security_extension/` folder

## Files

```
security_extension/
├── manifest.json    # Extension manifest (MV3)
├── content.js        # Content script for page analysis
├── popup.html        # Popup UI
├── popup.js          # Popup logic
└── icon.png          # Extension icon (16x16, 48x48, 128x128)
```

## Security Features

| Feature | What It Does |
|---------|-------------|
| HTTPS Check | Detects secure/insecure protocol |
| Form Detection | Finds password fields |
| Cookie Check | Identifies insecure cookies |
| Visual Warning | Red banner on HTTP login pages |

## Extension Manifest V3

Modern Chrome extensions use Manifest V3 with improved security.

## Enhancement Ideas

- [ ] Add malware URL blocking list
- [ ] Add password strength indicator
- [ ] Add cookie tracking/report
- [ ] Add HTTPS upgrade suggestions
