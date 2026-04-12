#!/bin/bash
# Email Security Infrastructure - Project 65

echo "
╔════════════════════════════════════════════════════════════════╗
║     Email Security Infrastructure - Project 65                 ║
╚════════════════════════════════════════════════════════════════╝

EMAIL SECURITY PROTOCOLS:

1. SPF (Sender Policy Framework)
   - DNS TXT record
   - Lists authorized mail servers
   - Prevents spoofing from your domain

   Example SPF record:
   v=spf1 ip4:192.168.1.0/24 include:_spf.google.com ~all

2. DKIM (DomainKeys Identified Mail)
   - Cryptographic signatures
   - Attach signature to email headers
   - Verify at receiving server

   Generate DKIM keys:
   openssl genrsa -2048 -out dkim.private 2048
   openssl rsa -in dkim.private -pubout -out dkim.pub

   Add to DNS:
   selector._domainkey.example.com IN TXT \"v=DKIM1; k=rsa; p=<public key>\"

3. DMARC (Domain-based Message Authentication)
   - Combines SPF and DKIM
   - Reporting mechanism
   - Policy enforcement

   Example DMARC record:
   _dmarc.example.com IN TXT \"v=DMARC1; p=reject; rua=mailto:dmarc@example.com\"

EMAIL ENCRYPTION:

S/MIME (Server-based):
- Certificates for each user
- Encrypt and sign
- PKI infrastructure needed

# Generate S/MIME certificate
openssl req -new -x509 -key smime.key -out smime.crt -days 365

PGP/GPG (Key-based):
- Web of trust model
- Personal key management
- End-to-end encryption

# Generate PGP key
gpg --full-generate-key

# Encrypt email
gpg --encrypt --armor --recipient user@example.com email.txt

SECURE EMAIL GATEWAY:

| Feature | Purpose |
|---------|---------|
| Spam filtering | Reduce unwanted email |
| Phishing detection | Block impersonation |
| Malware scanning | Sandbox attachments |
| DLP | Prevent data loss |
| Encryption | Secure transit |

POSTFIX HARDENING:

# /etc/postfix/main.cf

# Disable VRFY (information gathering)
disable_vrfy_command = yes

# HELO restrictions
smtp_helo_restrictions = permit_mynetworks, reject_invalid_helo_hostname, reject_non_fqdn_helo_hostname, reject

# Sender restrictions
smtp_sender_restrictions = reject_non_fqdn_sender, reject_unknown_sender_domain

# Recipient restrictions
smtpd_recipient_restrictions = permit_mynetworks, reject_unauth_destination, check_client_access hash:/etc/postfix/access

# Enable TLS
smtp_use_tls = yes
smtpd_use_tls = yes
smtp_tls_security_level = may
smtpd_tls_security_level = may
smtp_tls_CAfile = /etc/ssl/certs/ca-certificates.crt

# Enforce TLS for sensitive domains
smtp_tls_policy_maps = hash:/etc/postfix/tls_policy

SPAM FILTERING:

# Amavis + ClamAV integration
# /etc/amavis/conf.d/

# SpamAssassin rules
# /etc/spamassassin/

# Postfix spam filter
# /etc/postfix/main.cf
content_filter = smtp-amavis:[127.0.0.1]:10024

EMAIL ARCHIVING:

Why archive:
- Compliance requirements
- Legal discovery
- Audit requirements
- Data retention

Tools:
- MailArchiver
- Google Vault
- Microsoft Exchange Journaling
- Postfix + archive

MONITORING:

# Check email logs
tail -f /var/log/mail.log

# Check for SPF failures
grep \"SPF\" /var/log/mail.log

# Check for bounces
grep \"bounce\" /var/log/mail.log

# Monitor queue
postqueue -p

SECURITY CHECKLIST:

[ ] SPF record configured
[ ] DKIM signing enabled
[ ] DMARC policy set (reject/quarantine)
[ ] TLS required for outbound
[ ] TLS preferred for inbound
[ ] Spam filter configured
[ ] Malware scanning enabled
[ ] DLP policies defined
[ ] Email archiving configured
[ ] Monitoring/alerting set up
[ ] Regular log review
[ ] Certificate renewals automated

EMAIL SECURITY TOOLS:

| Tool | Purpose |
|------|---------|
| Postfix | Mail server |
| OpenDKIM | DKIM signing |
| SpamAssassin | Spam filtering |
| ClamAV | Malware scanning |
| Amavis | Content filter |
| GPG | Email encryption |

COMMON ATTACKS:

1. PHISHING
   - Fake login pages
   - Credential harvesting
   - Protect: DMARC, user training

2. SPOOFING
   - Forged sender address
   - Protect: SPF, DKIM, DMARC

3. BUSINESS EMAIL COMPROMISE (BEC)
   - CEO fraud, wire transfer
   - Protect: Verification procedures

4. MALWARE DELIVERY
   - Attachments, links
   - Protect: Sandbox, link analysis

5. DATA EXFILTRATION
   - Sensitive data in email
   - Protect: DLP, encryption

"

# Check for tools
echo -e \"\\n[*] Checking email security tools...\"
for tool in postfix spamassassin opendkim; do
    if command -v $tool &> /dev/null 2>&1 || dpkg -l $tool &> /dev/null 2>&1; then
        echo \"[+] $tool installed\"
    else
        echo \"[-] $tool not found\"
    fi
done