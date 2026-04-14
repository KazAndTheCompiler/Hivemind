#!/usr/bin/env python3
"""Dataset 2: security_reasoning.jsonl - 50 entries."""
import subprocess, json
from pathlib import Path

QWEN = "/home/openclaw/.npm-global/bin/qwen"
MODEL = "qwen-3.6"
SYSTEM = "You are a security education expert. Write detailed 2-4 paragraph educational responses with analysis frameworks and actionable guidance."

OUTPATH = Path("/home/openclaw/.openclaw/workspace/training-data/security_reasoning.jsonl")

QUESTIONS = [
    # threat_modeling (11)
    ("threat_modeling", "A financial institution is migrating from on-premise servers to a multi-cloud environment. What threat model would you construct to identify attack surfaces across AWS, Azure, and GCP simultaneously?"),
    ("threat_modeling", "Your organization uses a third-party SaaS vendor for HR and payroll data. What trust boundaries and trust relationships need to be analyzed in your threat model?"),
    ("threat_modeling", "An IoT fleet of 10,000 smart locks is being deployed in apartment buildings. Model the attack surface considering device, cloud, and mobile app components."),
    ("threat_modeling", "A dev team has adopted GitHub Copilot for code generation. What new attack vectors emerge in the software development lifecycle that need threat modeling?"),
    ("threat_modeling", "Your organization operates OT/ICS systems in a manufacturing plant. How does threat modeling differ for IT vs OT environments in a converged network?"),
    ("threat_modeling", "A healthcare organization stores PHI on blockchain. What unique threat model considerations arise from decentralization and immutability?"),
    ("threat_modeling", "Your startup uses a serverless architecture (AWS Lambda + API Gateway). How does the threat model change compared to traditional server-based deployment?"),
    ("threat_modeling", "An organization adopts zero-trust networking. What threat model updates are required when perimeter-based assumptions are removed?"),
    ("threat_modeling", "Your SIEM aggregates logs from 50 different data sources. What threats are introduced by the log aggregation pipeline itself?"),
    ("threat_modeling", "A supply chain attack compromises a widely-used CI/CD tool. How do you threat model the software build pipeline?"),
    ("threat_modeling", "Your red team uses AI-generated phishing content. What new risks does generative AI introduce to social engineering threat models?"),
    # vulnerability_analysis (11)
    ("vulnerability_analysis", "A zero-day remote code execution vulnerability is disclosed in OpenSSL 3.x. Walk through how you would analyze the CVE, determine scope, and assess impact for a typical enterprise environment."),
    ("vulnerability_analysis", "You discover that input validation in a REST API is only performed client-side using JavaScript. Analyze the security implications and the class of vulnerabilities present."),
    ("vulnerability_analysis", "A penetration test reveals that LDAP authentication is vulnerable to blind injection. Explain the vulnerability class, exploitation technique, and remediation path."),
    ("vulnerability_analysis", "Your code review finds that user-uploaded files are served statically without Content-Disposition headers. Analyze the security impact and potential attack scenarios."),
    ("vulnerability_analysis", "A container image scan reports a critical vulnerability in a base image that was patched 3 months ago. Analyze the patching lag risk and recommend a durable solution."),
    ("vulnerability_analysis", "An API endpoint returns detailed error messages including stack traces in production. Analyze the information disclosure risk and how it aids attackers."),
    ("vulnerability_analysis", "A deserialization vulnerability exists in a Java application using ObjectInputStream. Explain the exploitation chain and why Java deserialization is dangerous."),
    ("vulnerability_analysis", "SQL injection is found in a legacy ASP application. Analyze why prepared statements weren't used historically and how to safely retrofit the codebase."),
    ("vulnerability_analysis", "A SSRF vulnerability in an internal metadata service allows access to cloud provider credentials. Analyze the full attack chain from SSRF to cloud account takeover."),
    ("vulnerability_analysis", "XSS reflected via query parameters in a SPA lacks output encoding. Analyze the attack surface and compare reflected vs stored XSS."),
    ("vulnerability_analysis", "JWT tokens use HS256 symmetric algorithm with a weak secret. Analyze the security implications and how algorithm confusion attacks work."),
    # defense_strategy (13)
    ("defense_strategy", "Design a defense-in-depth strategy for a 3-tier web application, specifying security controls at each layer (network, host, application, data)."),
    ("defense_strategy", "Your organization experienced a spear-phishing campaign that bypassed email filters. Recommend a layered email security strategy to reduce future success rates."),
    ("defense_strategy", "An organization has 200+ microservices. Recommend a strategy for implementing zero-trust networking across service-to-service communication."),
    ("defense_strategy", "Design a secrets management strategy for a Kubernetes-based deployment that avoids hardcoded credentials while enabling secure rotation."),
    ("defense_strategy", "A company stores encrypted backups of customer PII in cloud object storage. Recommend controls for key management, access control, and backup integrity verification."),
    ("defense_strategy", "Your SOC receives 10,000 alerts per day. Design an alert prioritization and triage strategy to reduce analyst fatigue while maintaining detection fidelity."),
    ("defense_strategy", "A manufacturing plant has IT and OT networks that were previously air-gapped but now require connectivity. Design a secure OT/IT convergence strategy."),
    ("defense_strategy", "Design a secure software development lifecycle that integrates security gates at each stage from design to production deployment."),
    ("defense_strategy", "A healthcare organization must comply with HIPAA. Design a data governance strategy covering access controls, audit logging, and breach notification."),
    ("defense_strategy", "Your organization is adopting BYOD. Design a mobile device security strategy that balances usability and security."),
    ("defense_strategy", "Design a cryptographic key lifecycle management strategy covering generation, distribution, rotation, storage, and destruction."),
    ("defense_strategy", "Your organization uses open-source libraries extensively. Design a software composition analysis strategy to manage third-party risk."),
    ("defense_strategy", "Design a ransomware resilience strategy covering prevention, detection, containment, and recovery controls."),
    # incident_response (15)
    ("incident_response", "An employee reports unusual behavior on their workstation — unknown processes, redirected network traffic. Walk through your incident response methodology from detection to containment."),
    ("incident_response", "A SIEM alert triggers for a service account accessing unusual volumes of data at 3 AM. Outline your IR investigation steps and escalation criteria."),
    ("incident_response", "Ransomware is detected on a single workstation before encryption completes. Detail containment, eradication, and recovery procedures."),
    ("incident_response", "A cloud breach exposes an S3 bucket containing customer data. Walk through the immediate incident response steps and regulatory notification requirements."),
    ("incident_response", "During a red team engagement, an attacker has established a beacon over port 443. Describe detection, forensics, and response procedures for this C2 channel."),
    ("incident_response", "An insider threat is suspected — an employee with database admin access is downloading unusually large datasets. Detail the IR approach for insider threats."),
    ("incident_response", "A watering hole attack is suspected after employees visit a partner industry website. Walk through the IR methodology for supply chain compromise via web traffic."),
    ("incident_response", "Your web application is hit with a zero-day exploit before patches are available. Detail emergency response procedures including virtual patching and traffic analysis."),
    ("incident_response", "A supply chain compromise introduces a backdoor into production software. Walk through the IR approach from initial detection to coordinated disclosure."),
    ("incident_response", "An employee's credentials are harvested via OAuth phishing. Detail the IR response when a cloud identity provider account is compromised."),
    ("incident_response", "Memory analysis reveals a rootkit with kernel-level persistence. Detail the forensics, containment, and recovery challenges at this depth."),
    ("incident_response", "A DDoS attack targets public-facing infrastructure. Walk through the IR response including traffic analysis, upstream filtering, and stakeholder communication."),
    ("incident_response", "A breach investigation finds evidence of data exfiltration over 6 months. Detail how you scope the breach, determine data impact, and plan remediation."),
    ("incident_response", "During IR, you discover the attacker accessed the SIEM itself. Analyze the implications and how to maintain IR credibility when your monitoring is compromised."),
    ("incident_response", "A phishing campaign successfully harvests credentials across 50 employees. Detail the containment, eradication, and hardening steps for an email-based credential compromise outbreak."),
]

def call_qwen(prompt):
    proc = subprocess.Popen(
        [QWEN, "-p", SYSTEM, "--model", MODEL],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    stdout, stderr = proc.communicate(input=prompt, timeout=90)
    return stdout.strip()

done = 0
for i, (cat, question) in enumerate(QUESTIONS):
    prompt = (
        f"Answer this {cat.replace('_', ' ')} question with a detailed 2-4 paragraph educational response. "
        f"Include analysis frameworks, technical reasoning, and actionable guidance where appropriate.\n\n"
        f"Question: {question}"
    )
    print(f"[{i+1}/50] {cat}: {question[:70]}...", flush=True)
    try:
        output = call_qwen(prompt)
    except Exception as e:
        print(f"  ERROR: {e}", flush=True)
        output = f"[generation failed: {e}]"
    entry = {"instruction": question, "input": "", "output": output}
    with open(OUTPATH, "a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    done += 1

print(f"COMPLETE: {done}/50 -> {OUTPATH}", flush=True)
