#!/bin/bash
# TLS/SSL Setup Guide - Project 20
# Configure HTTPS for web services

set -e

echo "
╔════════════════════════════════════════════════════════════════╗
║     TLS/SSL Setup Guide - Project 20                         ║
╚════════════════════════════════════════════════════════════════╝
"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check for certbot
check_certbot() {
    if command -v certbot &> /dev/null; then
        echo -e "${GREEN}[+] certbot found${NC}"
    else
        echo -e "${YELLOW}[!] certbot not found${NC}"
        echo "    Install with: sudo apt install certbot"
    fi
}

# Generate self-signed certificate
generate_self_signed() {
    DOMAIN=${1:-localhost}
    
    echo "[*] Generating self-signed certificate for $DOMAIN..."
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "${DOMAIN}.key" \
        -out "${DOMAIN}.crt" \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN"
    
    echo -e "${GREEN}[+] Certificate generated:${NC}"
    echo "    Certificate: ${DOMAIN}.crt"
    echo "    Private Key: ${DOMAIN}.key"
    
    echo ""
    echo "To use with nginx:"
    echo "    ssl_certificate     /path/to/${DOMAIN}.crt;"
    echo "    ssl_certificate_key /path/to/${DOMAIN}.key;"
}

# Generate Let's Encrypt certificate
generate_letsencrypt() {
    DOMAIN=$1
    EMAIL=${2:-admin@$DOMAIN}
    
    echo "[*] Generating Let's Encrypt certificate for $DOMAIN..."
    
    if ! command -v certbot &> /dev/null; then
        echo "[!] certbot not installed"
        echo "    sudo apt install certbot python3-certbot-nginx"
        return 1
    fi
    
    certbot certonly --nginx -d "$DOMAIN" --email "$EMAIL" --agree-tos -n
    
    echo -e "${GREEN}[+] Let's Encrypt certificate generated${NC}"
}

# Check certificate
check_certificate() {
    CERT_FILE=${1:-server.crt}
    
    echo "[*] Certificate Info:"
    openssl x509 -in "$CERT_FILE" -noout -text | head -20
    
    echo ""
    echo "[*] Valid Dates:"
    openssl x509 -in "$CERT_FILE" -noout -dates
    
    echo ""
    echo "[*] Subject:"
    openssl x509 -in "$CERT_FILE" -noout -subject
}

# Test TLS configuration
test_tls() {
    HOST=${1:-localhost}
    PORT=${2:-443}
    
    echo "[*] Testing TLS on $HOST:$PORT..."
    
    echo | openssl s_client -connect "$HOST:$PORT" -servername "$HOST" 2>/dev/null | \
        openssl x509 -noout -text | head -30
    
    echo ""
    echo "[*] TLS Version Check:"
    echo | openssl s_client -connect "$HOST:$PORT" 2>/dev/null | grep "Protocol"
}

# Nginx TLS configuration template
show_nginx_tls() {
    echo "
# Nginx TLS Configuration
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    # Certificate
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # TLS Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security 'max-age=31536000; includeSubDomains' always;
    
    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
}
"
}

# Main
if [ "$1" == "selfsigned" ]; then
    generate_self_signed "$2"
elif [ "$1" == "letsencrypt" ]; then
    generate_letsencrypt "$2" "$3"
elif [ "$1" == "check" ]; then
    check_certificate "$2"
elif [ "$1" == "test" ]; then
    test_tls "$2" "$3"
elif [ "$1" == "nginx" ]; then
    show_nginx_tls
else
    echo "
Usage:
  $0 selfsigned <domain>     Generate self-signed certificate
  $0 letsencrypt <domain>    Generate Let's Encrypt certificate
  $0 check <cert_file>       Check certificate info
  $0 test <host> <port>      Test TLS configuration
  $0 nginx                    Show nginx TLS config template
    "
fi
