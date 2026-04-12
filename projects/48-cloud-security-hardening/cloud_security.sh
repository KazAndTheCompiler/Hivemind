#!/bin/bash
# Cloud Security Hardening - Project 48
# AWS/GCP/Azure security best practices

echo "
╔════════════════════════════════════════════════════════════════╗
║     Cloud Security Hardening - Project 48                   ║
╚════════════════════════════════════════════════════════════════╝

AWS SECURITY:

IAM BEST PRACTICES:

# Create IAM users instead of using root
aws iam create-user --user-name security-admin

# Create groups with specific permissions
aws iam create-group --group-name developers
aws iam attach-group-policy --group-name developers \\
    --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess

# Enable MFA for all users
aws iam create-virtual-mfa-device --virtual-mfa-device-name admin-mfa

# Access keys rotation
aws iam create-access-key --user-name <user>
aws iam delete-access-key --user-name <user> --access-key-id <old-key>

# Password policy
aws iam update-account-password-policy \\
    --minimum-password-length 14 \\
    --require-symbols \\
    --require-numbers \\
    --require-uppercase-characters \\
    --max-password-age 90

S3 SECURITY:

# Block public access
aws s3api put-public-access-block \\
    --bucket my-secure-bucket \\
    --public-access-block-configuration \\
    \"BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true\"

# Enable versioning and encryption
aws s3api put-bucket-versioning \\
    --bucket my-secure-bucket \\
    --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \\
    --bucket my-secure-bucket \\
    --server-side-encryption-configuration '{\"Rules\":[{\"ApplyServerSideEncryptionByDefault\":{\"SSEAlgorithm\":\"AES256\"}}]}'

# Use bucket policies
aws s3api put-bucket-policy --bucket my-secure-bucket \\
    --policy file://bucket-policy.json

EC2 SECURITY:

# Security groups (firewall)
aws ec2 create-security-group --group-name web-servers \\
    --description \"Web server security group\"

aws ec2 authorize-security-group-ingress \\
    --group-id sg-123456 \\
    --protocol tcp --port 443 --cidr 10.0.0.0/24

# Use IAM roles instead of access keys
aws ec2 associate-iam-instance-profile \\
    --instance-id i-123456 \\
    --iam-instance-profile Name=ec2-s3-role

# Enable VPC flow logs
aws ec2 create-flow-logs \\
    --resource-type VPC \\
    --resource-ids vpc-123456 \\
    --traffic-type ALL \\
    --log-destination-type cloud-watch-logs \\
    --log-group-name VPCFlowLogs

CLOUDWATCH SECURITY:

# Enable CloudTrail (API logging)
aws cloudtrail create-trail \\
    --name security-trail \\
    --s3-bucket-name my-trail-bucket \\
    --is-multi-region-trail

# GuardDuty enablement
aws guardduty enable-detector \\
    --detector-id all

# Config rules
aws configservice enable-rules \\
    --rule-names restricted-ssh,encryption-enabled

GCP SECURITY:

IAM:
gcloud projects add-iam-policy-binding my-project \\
    --member user:admin@example.com \\
    --role roles/editor

# Service account keys (avoid if possible!)
# Use workload identity instead

COMPUTE:

# Firewall rules
gcloud compute firewall-rules create allow-https \\
    --network default \\
    --allow tcp:443 \\
    --source-ranges 0.0.0.0/0

# Disable serial console
gcloud compute instances add-metadata instance-1 \\
    --metadata=serial-port-enable=false

# Enable OS Login
gcloud compute instances set-os-login instance-1 --zone us-central1-a

STORAGE:

# Uniform bucket-level access
gsutil uniformbucketaccess set on gs://my-bucket

# Enable retention policy
gsutil retention set 30d gs://my-bucket

# Encryption
gsutil kms encryption gs://my-bucket --key my-key

AZURE SECURITY:

# Enable Azure Defender
az security azure-protection enable

# Network security groups
az network nsg rule create \\
    --resource-group my-rg \\
    --nsg-name my-nsg \\
    --name allow-443 \\
    --protocol tcp \\
    --priority 100 \\
    --destination-port-range 443

# Key Vault
az keyvault create --name my-vault --resource-group my-rg
az keyvault secret set --vault-name my-vault --name db-password --value 'secret'

# Enable Microsoft Defender for Cloud
az security pricing create --name virtual-machines --tier standard

SECURITY CHECKLIST:

[ ] MFA enabled on all accounts
[ ] Root account not used for daily tasks
[ ] IAM least privilege applied
[ ] S3 buckets not public
[ ] VPC flow logs enabled
[ ] CloudTrail/Cloud Audit enabled
[ ] Security groups restricted
[ ] Secrets in Vault, not in code
[ ] Encryption at rest enabled
[ ] Regular security audits
[ ] Automated patching enabled
[ ] Backups tested

INFRASTRUCTURE AS CODE SECURITY:

# Terraform AWS security
# Use tfsec for security scanning
tfsec s3-bucket-encryption
tfsec s3-bucket-no-public-access

# Azure policies
az policy definition create --name storage-encryption \\
    --rules policies/storage-encryption.json
"

# Check for cloud CLIs
echo -e \"\\n[*] Checking cloud tools...\"
for tool in aws gcloud az; do
    if command -v $tool &> /dev/null; then
        echo \"[+] $tool installed\"
    else
        echo \"[-] $tool not found\"
    fi
done