#!/bin/bash
# PKI Infrastructure Build - Project 35
# Build a complete PKI from scratch

set -e

echo "
╔════════════════════════════════════════════════════════════════╗
║     PKI Infrastructure Build - Project 35                     ║
╚════════════════════════════════════════════════════════════════╝

WHAT IS PKI?

Public Key Infrastructure provides:
- Certificate management
- Identity verification
- Trust chain establishment

COMPONENTS:

1. ROOT CA (Certificate Authority)
   - Self-signed certificate
   - Trust anchor
   - Offline for security

2. INTERMEDIATE CA
   - Signs subordinate certificates
   - Can be offline
   - Backup copies essential

3. ISSUING CA
   - Issues end-entity certificates
   - Online for automation
   - Hardware security module

CERTIFICATE FORMATS:

| Format | Use |
|--------|-----|
| PEM (.pem, .crt) | Text format, Base64 |
| DER (.der, .cer) | Binary format |
| PFX/P12 (.pfx) | Windows, contains private key |
| JKS (.jks) | Java keystore |

KEY USAGE FLAGS:

| Flag | Purpose |
|------|---------|
| Digital Signature | Sign certificates/CRLs |
| Key Encipherment | Encrypt keys |
| Data Encipherment | Encrypt data |
| Server Auth | TLS server certificate |
| Client Auth | TLS client certificate |
| CRL Sign | Sign revocation lists |

"

# Variables
CA_DIR="/tmp/pki_demo"
ROOT_CA="$CA_DIR/root-ca"
INTERM_CA="$CA_DIR/intermediate-ca"
DAYS_VALID=3650

create_directory() {
    mkdir -p "$1/private" "$1/db" "$1/certs" "$1/crl"
    chmod 700 "$1/private"
    echo "[+] Created: $1"
}

initialize_database() {
    touch "$1/db/index.txt"
    touch "$1/db/index.txt.attr"
    echo "01" > "$1/db/serial"
    echo "01" > "$1/db/crlnumber"
}

# Create Root CA
create_root_ca() {
    echo -e \"\\n[*] Creating Root CA...\"
    create_directory \"$ROOT_CA\"
    initialize_database \"$ROOT_CA\"
    
    # Root CA configuration
    cat > \"$ROOT_CA/root-ca.conf\" << 'CONF'
[ca]
default_ca = CA_default

[CA_default]
database = /tmp/pki_demo/root-ca/db/index.txt
serial = /tmp/pki_demo/root-ca/db/serial
crlnumber = /tmp/pki_demo/root-ca/db/crlnumber
crl = /tmp/pki_demo/root-ca/crl/root-ca.crl
private_key = /tmp/pki_demo/root-ca/private/root-ca.key
certificate = /tmp/pki_demo/root-ca/certs/root-ca.crt

[policy_strict]
countryName = optional
stateOrProvinceName = optional
organizationName = optional
commonName = supplied

[req]
default_bits = 4096
distinguished_name = req_dn
x509_extensions = v3_ca

[v3_ca]
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always
basicConstraints = critical, CA:true, pathlen:2
keyUsage = critical, digitalSignature, cRLSign, keyCertSign

[req_dn]
CONF
    
    # Generate Root CA key
    openssl genrsa -aes256 -out \"$ROOT_CA/private/root-ca.key\" 4096
    chmod 400 \"$ROOT_CA/private/root-ca.key\"
    
    # Self-sign Root CA
    openssl req -config \"$ROOT_CA/root-ca.conf\" -key \"$ROOT_CA/private/root-ca.key\" \\
        -new -x509 -days $DAYS_VALID -sha256 -extensions v3_ca \\
        -out \"$ROOT_CA/certs/root-ca.crt\"
    
    chmod 444 \"$ROOT_CA/certs/root-ca.crt\"
    
    echo \"[+] Root CA created!\"
    echo \"    Certificate: $ROOT_CA/certs/root-ca.crt\"
    echo \"    Private Key: $ROOT_CA/private/root-ca.key (encrypted)\"
    
    # Display info
    openssl x509 -in \"$ROOT_CA/certs/root-ca.crt\" -noout -text | head -30
}

# Create Intermediate CA
create_intermediate_ca() {
    echo -e \"\\n[*] Creating Intermediate CA...\"
    create_directory \"$INTERM_CA\"
    initialize_database \"$INTERM_CA\"
    
    # Generate Intermediate key
    openssl genrsa -aes256 -out \"$INTERM_CA/private/intermediate-ca.key\" 4096
    chmod 400 \"$INTERM_CA/private/intermediate-ca.key\"
    
    # Generate CSR
    openssl req -new -sha256 -key \"$INTERM_CA/private/intermediate-ca.key\" \\
        -out \"$INTERM_CA/intermediate-ca.csr\" \\
        -subj \"/CN=Intermediate CA/O=Security Lab/C=US\"
    
    # Sign with Root CA
    openssl ca -config \"$ROOT_CA/root-ca.conf\" -extensions v3_ca \\
        -in \"$INTERM_CA/intermediate-ca.csr\" \\
        -out \"$INTERM_CA/certs/intermediate-ca.crt\" \\
        -days 1825 -notext -batch
    
    chmod 444 \"$INTERM_CA/certs/intermediate-ca.crt\"
    
    echo \"[+] Intermediate CA created!\"
    echo \"    CSR: $INTERM_CA/intermediate-ca.csr\"
    echo \"    Certificate: $INTERM_CA/certs/intermediate-ca.crt\"
    
    # Build certificate chain
    cat \"$INTERM_CA/certs/intermediate-ca.crt\" \"$ROOT_CA/certs/root-ca.crt\" > \"$INTERM_CA/certs/ca-chain.crt\"
    echo \"    Chain: $INTERM_CA/certs/ca-chain.crt\"
}

# Issue end-entity certificate
issue_certificate() {
    local cn=$1
    local out_dir=$2
    
    echo -e \"\\n[*] Issuing certificate for: $cn\"
    
    # Generate key
    openssl genrsa -out \"$out_dir/$cn.key\" 2048
    chmod 400 \"$out_dir/$cn.key\"
    
    # Generate CSR
    openssl req -new -sha256 -key \"$out_dir/$cn.key\" \\
        -out \"$out_dir/$cn.csr\" \\
        -subj \"/CN=$cn/O=Security Lab/C=US\"
    
    # Issue certificate
    openssl ca -config \"$INTERM_CA/root-ca.conf\" -extensions server_cert \\
        -in \"$out_dir/$cn.csr\" \\
        -out \"$out_dir/$cn.crt\" \\
        -days 365 -notext -batch 2>/dev/null || \\
    openssl ca -config \"$ROOT_CA/root-ca.conf\" \\
        -in \"$out_dir/$cn.csr\" \\
        -out \"$out_dir/$cn.crt\" \\
        -days 365 -notext -batch
    
    chmod 444 \"$out_dir/$cn.crt\"
    
    echo \"[+] Certificate issued: $cn\"
    echo \"    Key: $out_dir/$cn.key\"
    echo \"    Certificate: $out_dir/$cn.crt\"
}

show_usage() {
    echo \"
Usage: $0 [command]

Commands:
  root-ca       Create Root CA
  interm-ca    Create Intermediate CA (requires root-ca)
  issue <CN>    Issue certificate for Common Name
  verify <cert> Verify certificate chain
  all           Create complete PKI
  demo          Run demonstration
  
Examples:
  $0 all
  $0 issue www.example.com
  $0 verify /tmp/pki_demo/end-entity/www.example.com.crt
    \"
}

case \"${1:-demo}\" in
    root-ca)
        create_root_ca
        ;;
    interm-ca)
        create_intermediate_ca
        ;;
    issue)
        [ -z \"$2\" ] && { echo \"[!] Usage: $0 issue <CN>\"; exit 1; }
        mkdir -p \"$CA_DIR/end-entity/$2\"
        issue_certificate \"$2\" \"$CA_DIR/end-entity/$2\"
        ;;
    verify)
        [ -z \"$2\" ] && { echo \"[!] Usage: $0 verify <cert>\"; exit 1; }
        openssl verify -CAfile \"$ROOT_CA/certs/root-ca.crt\" \"$2\"
        ;;
    all)
        create_root_ca
        create_intermediate_ca
        mkdir -p \"$CA_DIR/end-entity/server\"
        issue_certificate \"server.example.com\" \"$CA_DIR/end-entity/server\"
        ;;
    demo|*)
        create_root_ca
        echo -e \"\\n[+] PKI demo complete\"
        echo \"\\nNext steps:\"
        echo \"  $0 interm-ca  # Create intermediate CA\"
        echo \"  $0 issue server.example.com  # Issue certificate\"
        ;;
esac