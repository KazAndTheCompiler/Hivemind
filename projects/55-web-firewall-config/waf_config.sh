#!/bin/bash
# Web Application Firewall Configuration - Project 55

echo "
╔════════════════════════════════════════════════════════════════╗
║     Web Application Firewall Configuration - Project 55       ║
╚════════════════════════════════════════════════════════════════╝

WAF DEPLOYMENT MODES:

1. INLINE (Blocking Mode)
   - All traffic passes through WAF
   - Real-time blocking
   - Latency added
   - Can cause false positives

2. MONITORING (Detection Mode)
   - Copy of traffic analyzed
   - Alerts but no blocking
   - Good for tuning
   - Risk of missed attacks

3. OUT-OF-BAND (Mirrored)
   - Traffic copied to WAF
   - Asynchronous processing
   - No latency impact
   - Detection only

MODSECURITY CRS EXAMPLES:

# Install ModSecurity
# For Apache
a2enmod security2
a2enmod headers

# Apache config
<IfModule mod_security2.c>
    SecRuleEngine On
    SecRequestBodyAccess On
    SecResponseBodyAccess Off
    SecDebugLog /var/log/apache2/modsec_debug.log
    SecDebugLogLevel 3
</IfModule>

# Include OWASP Core Rule Set
Include /etc/modsecurity/*.conf
Include /etc/modsecurity/crs/*.conf

COMMON MODSECURITY RULES:

# Block SQL Injection
SecRule REQUEST_COOKIES|REQUEST_BODY|ARGS|ARGS_NAMES \\
    \"@rx (?i)(\\b(union|select|insert|update|delete|drop|exec|execute)\\b)\" \\
    \"id:'942100',phase:2, deny, status:403, \\
    msg:'SQL Injection Attack', logdata:'%{MATCHED_VAR}', severity:2\"

# Block XSS
SecRule REQUEST_COOKIES|REQUEST_BODY|ARGS|ARGS_NAMES \\
    \"@rx (?i)(<script[^>]*>.*?</script>|<[^>]*on\\w+\\s*=)\" \\
    \"id:'941100', phase:2, deny, status:403, \\
    msg:'XSS Attack', logdata:'%{MATCHED_VAR}', severity:2\"

# Block path traversal
SecRule REQUEST_URI|REQUEST_HEADERS \\
    \"@rx (\\.\\./|\\.\\.%5C)\" \\
    \"id:'930100', phase:1, deny, status:403, \\
    msg:'Path Traversal', severity:2\"

# Block remote file inclusion
SecRule REQUEST_URI|REQUEST_ARGS \\
    \"@rx (http|ftp)://\" \\
    \"id:'930110', phase:1, deny, status:403, \\
    msg:'Remote File Inclusion Attempt', severity:2\"

Nginx WAF (NAXSI EXAMPLE):

# Install NAXSI
apt install libnginx-mod-http-naxsi

# nginx.conf
load_module modules/ngx_http_naxsi_module.so;

# site config
server {
    location / {
        naxsi_enabled 1;
        naxsi_rules_path /etc/nginx/naxsi.rules;
        
        # Learn mode (first)
        naxsiLearnMode 1;
    }
}

# naxsi.rules
MainRule \"str:..\" \"msg:path traversal\" \"mz:URL|ARGS\" \"id:1\";

CLOUDFLARE WAF:

# Dashboard rules
# Block known bad actors
# Challenge suspicious requests
# Rate limiting
# Bot management

# API example
curl -X POST \"https://api.cloudflare.com/client/v4/zones/{zone}/filters\" \\
    -H \"Authorization: Bearer {token}\" \\
    -H \"Content-Type: application/json\" \\
    -d '{
        \"expression\": \"ip.src in {192.0.2.0/24}\",
        \"action\": \"block\",
        \"description\": \"Block suspicious IP range\"
    }'

AWS WAF:

# Create web ACL
aws wafv2 create-web-acl \\
    --name my-web-acl \\
    --scope CLOUDFRONT \\
    --rules file://rules.json

# rules.json
{
    \"Name\": \"SQLInjectionRule\",
    \"Priority\": 1,
    \"Statement\": {
        \"ManagedRuleGroupStatement\": {
            \"VendorName\": \"AWS\",
            \"Name\": \"AWSManagedRulesSQLiRuleSet\"
        }
    },
    \"Action\": { \"Block\": {} }
}

HAProxy WAF:

# ACL definitions
acl sql_injection req.rdp_cookie -m reg -i (?i)(select|union|insert|update|delete|drop)
acl xss_attack req.rdp_cookie -m reg -i <script|onerror=

# Block rules
http-request deny if sql_injection
http-request deny if xss_attack

# Rate limiting
stick-table type ip size 100k expire 30s
http-request track-sc0 src
http-request deny if { sc_http_get_rate(src) gt 100 }

FAIL2BAN (APPLICATION LAYER):

# jail.local
[apache-modsec]
enabled = true
port = http,https
filter = apache-modsec
logpath = /var/log/apache2/modsec_debug.log
maxretry = 5
bantime = 3600

# filter.d/apache-modsec.conf
[Definition]
failregex = ^.*?\\s+Error:\\s+<addr>

WAF TUNING PROCESS:

1. MONITOR (Learn mode)
   - Deploy in monitoring mode
   - Collect false positives
   - Identify legitimate traffic patterns

2. APPLY EXCEPTIONS
   # ModSecurity: SecRuleRemoveById
   SecRule REQUEST_URI \"@contains /api/valid-endpoint\" \\
       \"id:1, phase:1, pass, nolog, ctl:ruleRemoveById=942100\"

3. ACTIVATE BLOCKING
   - Move to blocking mode
   - Monitor for issues
   - Continue tuning

WAF SECURITY CHECKLIST:

[ ] Deployed in blocking mode
[ ] OWASP CRS enabled
[ ] SQLi protection active
[ ] XSS protection active
[ ] Rate limiting configured
[ ] Logging enabled and monitored
[ ] False positives tuned
[ ] Regular rule updates
[ ] Exception process documented
[ ] Incident response plan

LOG ANALYSIS:

# ModSecurity audit log
grep \"SQL Injection\" /var/log/modsec_audit.log

# Cloudflare Analytics
# Real-time threat dashboard

# AWS WAF logs
# CloudWatch Insights queries

TOOLS:

| Tool | Type |
|------|------|
| ModSecurity | Apache/NGINX WAF |
| NAXSI | NGINX WAF |
| CrowdSec | Community WAF/IPS |
| Fail2Ban | Application firewall |
| CloudFlare | Cloud WAF |
| AWS WAF | Cloud WAF |
| Imperva | Commercial WAF |

"

# Check for tools
echo -e \"\\n[*] Checking WAF tools...\"
for tool in apache2 nginx fail2ban; do
    if command -v $tool &> /dev/null 2>&1; then
        echo \"[+] $tool installed\"
    else
        echo \"[-] $tool not found\"
    fi
done