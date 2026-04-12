# Project 29: Test secure routing protocols

## Overview

Guide to understanding and securing routing protocols (BGP, OSPF, RIP).

## Key Topics

| Protocol | Risk | Mitigation |
|----------|------|------------|
| BGP | Route hijacking | RPKI |
| OSPF | Auth attacks | MD5/SHA auth |
| RIP | Route poisoning | Passive interfaces |

## Security Measures

1. **RPKI** - Route Origin Validation
2. **BGPsec** - Path validation
3. **OSPF Auth** - Cryptographic authentication
4. **Route filtering** - Ingress/egress filters

## Tools

- Routinator - RPKI validator
- BGPStream - Route analysis
- Routeviews - Looking glass
