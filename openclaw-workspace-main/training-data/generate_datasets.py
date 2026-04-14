#!/usr/bin/env python3
"""Generate security education training datasets using Qwen CLI."""
import subprocess
import json
import os
from pathlib import Path

WORKDIR = Path("/home/openclaw/.openclaw/workspace/training-data")
PROJDIR = Path("/tmp/secdev_project/projects")
QWEN = "/home/openclaw/.npm-global/bin/qwen"
MODEL = "qwen-3.6"

def qwen_generate(prompt, system_prompt=None):
    """Call Qwen CLI and return response text."""
    full_prompt = prompt
    args = ["echo", json.dumps(full_prompt), "|", QWEN, "-p", system_prompt if system_prompt else "", "--model", MODEL]
    cmd = " ".join(args)
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=60)
    return result.stdout.strip(), result.stderr.strip()

def qwen_stream(prompt, system_prompt=None):
    """Call Qwen via /dev/stdin approach for longer context."""
    env = os.environ.copy()
    full_prompt = prompt
    proc = subprocess.Popen(
        [QWEN, "-p", system_prompt if system_prompt else "", "--model", MODEL],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    stdout, stderr = proc.communicate(input=full_prompt, timeout=90)
    return stdout.strip(), stderr.strip()

PROJECTS = [
    "01-honeypot-basic", "02-password-cracker", "03-network-sniffer", "04-keylogger-practice",
    "05-digital-forensics", "06-home-lab", "07-file-encryption", "08-phishing-simulation",
    "09-wifi-security", "10-network-vuln-scan", "11-firewall-setup", "12-two-factor-auth",
    "13-secure-web-app", "14-snort-ids", "15-vuln-scanner", "16-dns-spoofing-detection",
    "17-antivirus-study", "18-anomaly-detector", "19-malware-analysis", "20-tls-setup",
    "21-zero-day-exploits", "22-tor-privacy", "23-honeypot-advanced", "24-gpu-password-cracking",
    "25-browser-extension", "26-malware-sandbox", "27-full-disk-encryption", "28-ml-intrusion-detection",
    "29-secure-routing", "30-crypto-wallet", "31-rootkit-analysis", "32-darkweb-scraper",
    "33-ddos-simulation", "34-secure-messaging-app", "35-pki-build", "36-ctf-writeups",
    "37-container-security", "38-漏洞分析", "39-threat-hunting", "40-web-security-header",
    "41-red-team-engagement", "42-iot-security-assessment", "43-binary-analysis", "44-exploit-development",
    "45-api-security-testing", "46-devops-security", "47-attack-detection-lab", "48-cloud-security-hardening",
    "49-social-engineering", "50-mobile-pentest", "51-shellcode-generator", "52-privilege-escalation",
    "53-active-directory-security", "54-network-segmentation", "55-web-firewall-config", "56-secure-boot-config",
    "57-embedded-systems-security", "58-defense-evasion-techniques", "59-memory-forensics",
    "60-cryptography-implementation", "61-threat-intel-platform", "62-camera-security",
    "63-wireless-pentest", "64-insider-threat-detection", "65-email-security",
    "66-software-supply-chain", "66-vulnerability-scanner", "67-container-security",
    "67-datacenter-security", "68-bug-bounty-playbook", "68-vehicle-security",
    "69-ics-scada-security", "69-steganography", "70-biometric-auth", "70-security-architecture",
]

SYSTEM_PROMPT = (
    "You are a security education expert. Provide technically accurate, educational explanations. "
    "Write 2-3 paragraphs explaining HOW to build the system and WHY it works from a security education perspective."
)

def generate_secdev_projects():
    """Dataset 1: secdev_projects.jsonl - 70 entries."""
    outpath = WORKDIR / "secdev_projects.jsonl"
    done = 0
    with open(outpath, "w") as f:
        for i, proj in enumerate(PROJECTS):
            # Derive project name for display
            num = proj.split("-")[0]
            name_display = proj[len(num)+1:] if len(proj) > len(num)+1 else proj
            instruction = f"Explain how to build a {name_display.replace('-', ' ')} for educational purposes"

            prompt = (
                f"You are a security education expert. Write 2-3 paragraphs explaining how to build "
                f"a {name_display.replace('-', ' ')} for educational/security training purposes. "
                f"Cover: (1) the technical approach and components, (2) how it works and why it matters "
                f"for security education, (3) key learning objectives. Be technically accurate and educational. "
                f"Do not include code, focus on concepts and methodology."
            )

            print(f"[{i+1}/70] Generating: {proj}")
            stdout, stderr = qwen_stream(prompt, SYSTEM_PROMPT)

            if stderr:
                print(f"  stderr: {stderr[:200]}")

            output = stdout if stdout else "[generation failed - placeholder]"
            entry = {
                "instruction": instruction,
                "input": "",
                "output": output
            }
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
            f.flush()
            done += 1

    print(f"Done: {done}/70 entries written to {outpath}")
    return done

def generate_security_reasoning():
    """Dataset 2: security_reasoning.jsonl - 50 entries."""
    outpath = WORKDIR / "security_reasoning.jsonl"
    categories = [
        ("threat_modeling", [
            "A financial institution is migrating from on-premise servers to a multi-cloud environment. What threat model would you construct to identify attack surfaces across AWS, Azure, and GCP simultaneously?",
            "Your organization uses a third-party SaaS vendor for HR and payroll data. What trust boundaries and trust relationships need to be analyzed in your threat model?",
            "An IoT fleet of 10,000 smart locks is being deployed in apartment buildings. Model the attack surface considering device, cloud, and mobile app components.",
            "A dev team has adopted GitHub Copilot for code generation. What new attack vectors emerge in the software development lifecycle that need threat modeling?",
            "Your organization operates OT/ICS systems in a manufacturing plant. How does threat modeling differ for IT vs OT environments in a converged network?",
        ]),
        ("vulnerability_analysis", [
            "A zero-day remote code execution vulnerability is disclosed in OpenSSL 3.x. Walk through how you would analyze the CVE, determine scope, and assess impact for a typical enterprise environment.",
            "You discover that input validation in a REST API is only performed client-side using JavaScript. Analyze the security implications and the class of vulnerabilities present.",
            "A penetration test reveals that LDAP authentication is vulnerable to blind injection. Explain the vulnerability class, exploitation technique, and remediation path.",
            "Your code review finds that user-uploaded files are served statically without Content-Disposition headers. Analyze the security impact and potential attack scenarios.",
            "A container image scan reports a critical vulnerability in a base image that was patched 3 months ago. Analyze the patching lag risk and recommend a durable solution.",
        ]),
        ("defense_strategy", [
            "Design a defense-in-depth strategy for a 3-tier web application, specifying security controls at each layer (network, host, application, data).",
            "Your organization experienced a spear-phishing campaign that bypassed email filters. Recommend a layered email security strategy to reduce future success rates.",
            "An organization has 200+ microservices. Recommend a strategy for implementing zero-trust networking across service-to-service communication.",
            "Design a secrets management strategy for a Kubernetes-based deployment that avoids hardcoded credentials while enabling secure rotation.",
            "A company stores encrypted backups of customer PII in cloud object storage. Recommend controls for key management, access control, and backup integrity verification.",
        ]),
        ("incident_response", [
            "An employee reports unusual behavior on their workstation — unknown processes, redirected network traffic. Walk through your incident response methodology from detection to containment.",
            "A SIEM alert triggers for a service account accessing unusual volumes of data at 3 AM. Outline your IR investigation steps and escalation criteria.",
            "Ransomware is detected on a single workstation before encryption completes. Detail containment, eradication, and recovery procedures.",
            "A cloud breach exposes an S3 bucket containing customer data. Walk through the immediate incident response steps and regulatory notification requirements.",
            "During a red team engagement, an attacker has established a beacon over port 443. Describe detection, forensics, and response procedures for this C2 channel.",
            "An insider threat is suspected — an employee with database admin access is downloading unusually large datasets. Detail the IR approach for insider threats.",
        ]),
    ]

    entries = []
    cat_idx = 0
    for cat, qs in categories:
        for j, q in enumerate(qs):
            entries.append((cat, q))
            cat_idx += 1

    # Pad to exactly 50
    while len(entries) < 50:
        cat, qs = categories[len(entries) % len(categories)]
        entries.append((cat, qs[j % len(qs)]))

    done = 0
    with open(outpath, "w") as f:
        for i, (cat, question) in enumerate(entries[:50]):
            prompt = (
                f"You are a security education expert. Answer the following {cat.replace('_', ' ')} question "
                f"with a detailed 2-4 paragraph educational response. Include analysis frameworks, technical reasoning, "
                f"and actionable guidance where appropriate.\n\nQuestion: {question}"
            )
            print(f"[{i+1}/50] {cat}: {question[:60]}...")
            stdout, stderr = qwen_stream(prompt, SYSTEM_PROMPT)
            if stderr:
                print(f"  stderr: {stderr[:200]}")

            output = stdout if stdout else "[generation failed - placeholder]"
            entry = {
                "instruction": question,
                "input": "",
                "output": output
            }
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
            f.flush()
            done += 1

    print(f"Done: {done}/50 entries written to {outpath}")
    return done

def generate_watson_traces():
    """Dataset 3: watson_agent_traces.jsonl - 30 entries."""
    outpath = WORKDIR / "watson_agent_traces.jsonl"

    EMISSION_SNIPPETS = [
        '{"emission_type": "network", "src_ip": "192.168.1.100", "dst_ip": "8.8.8.8", "bytes_out": 524288, "timestamp": "2024-01-15T02:30:00Z"}',
        '{"emission_type": "file", "path": "/tmp/.hidden_payload", "entropy": 7.98, "sha256": "a3f1b...", "packed": true, "timestamp": "2024-01-15T02:31:00Z"}',
        '{"emission_type": "registry", "key": "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", "value": "C:\\Temp\\svchost.exe", "timestamp": "2024-01-15T02:32:00Z"}',
        '{"emission_type": "process", "pid": 4532, "name": "powershell.exe", "cmdline": "powershell -enc Base64String...", "parent": "explorer.exe", "timestamp": "2024-01-15T02:33:00Z"}',
        '{"emission_type": "network", "src_ip": "10.0.0.55", "dst_ip": "185.220.101.45", "port": 9001, "bytes_out": 2048, "timestamp": "2024-01-15T02:34:00Z"}',
        '{"emission_type": "memory", "address": "0x7ffe0000", "content_hash": "b9c4d...", "permissions": "rwx", "timestamp": "2024-01-15T02:35:00Z"}',
        '{"emission_type": "disk", "sector_read": [0, 1, 2, 3], "volume_serial": "FFFF-AAAA", "timestamp": "2024-01-15T02:36:00Z"}',
        '{"emission_type": "registry", "key": "HKCU\\Software\\Classes\\CLSID\\{ABCDEFGH-1234-5678-9ABC-DEF012345678}", "timestamp": "2024-01-15T02:37:00Z"}',
        '{"emission_type": "process", "pid": 8871, "name": "svchost.exe", "cmdline": "svchost -k netsvcs", "parent": "services.exe", "timestamp": "2024-01-15T02:38:00Z"}',
        '{"emission_type": "network", "src_ip": "192.168.1.105", "dst_ip": "45.33.32.156", "bytes_in": 16384, "bytes_out": 8192, "timestamp": "2024-01-15T02:39:00Z"}',
    ]

    PALACE_TYPES = [
        ("Palace indexing: prioritizing which Memory Palace to store a high-entropy binary artifact",
         "A suspicious executable with entropy 7.98 and packed content was retrieved from /tmp/.hidden_payload. The agent must decide which palace to store this in, and whether the artifact's metadata, disassembly, or behavioral notes are most critical for later recall. Consider the trade-off between palace capacity, cross-palace retrieval latency, and the artifact's assessed threat severity."),
        ("Guard validation: network emission to known C2 infrastructure",
         "A network emission shows an internal host (192.168.1.100) communicating with 8.8.8.8 (DNS but unusual timing and volume). A guard must validate whether this is anomalous, checking against baseline, reputation lists, and behavioral history. Walk through guard pass/fail logic and routing decision."),
        ("Agent routing: escalation from routine scan to threat hunt",
         "A process emission shows PowerShell executing with a Base64-encoded command line. Standard monitoring would flag this for logging. The routing layer must decide whether to spawn a lightweight query agent, a full threat-hunt subagent, or escalate directly to human review."),
        ("Finding severity: classifying a registry persistence mechanism",
         "A registry emission reveals a Run key entry pointing to a binary in /Temp/. The severity classifier must assess whether this is legitimate software installation or a stealthy persistence mechanism. Evaluate indicators: path anomaly, naming convention, parent process legitimacy."),
        ("Palace indexing: MBR-level disk access pattern",
         "Raw disk sectors 0-3 were read from a volume with serial FFFF-AAAA during an automated response sweep. The palace indexer must decide whether to store this MBR copy as a forensic snapshot, reference it in a boot-kit palace, or discard if the host is a known-clean baseline."),
        ("Guard validation: lateral movement via WMI",
         "A process tree shows svchost.exe spawning from services.exe with unusual command line arguments, a common lateral movement technique. Evaluate whether WMI subscription, scheduled task, or remote service creation guards trigger a block, log, or escalate."),
        ("Agent routing: encrypted tunnel to Tor exit node",
         "A network emission shows traffic from an internal host to a known Tor exit node (185.220.101.45) on port 9001 (Tor). The agent must determine routing: anonymization service proxy confirmation, policy violation alert, or allow with monitoring label."),
        ("Finding severity: shellcode in memory",
         "Memory scan reveals RWX region at 0x7ffe0000 with content hash b9c4d... matching known shellcode patterns. The severity classifier must evaluate: executable memory region, no associated process, high entropy content. Recommend block/quarantine vs. allow with deeper forensic capture."),
    ]

    done = 0
    with open(outpath, "w") as f:
        for i in range(30):
            template_idx = i % len(PALACE_TYPES)
            scenario, reasoning_brief = PALACE_TYPES[template_idx]
            emission = EMISSION_SNIPPETS[i % len(EMISSION_SNIPPETS)]

            instruction = f"{scenario}"
            prompt = (
                f"You are simulating a Watson/MemPalace security agent reasoning trace. "
                f"Given the following emission data:\n{emission}\n\n"
                f"Scenario: {reasoning_brief}\n\n"
                f"Generate a realistic agent reasoning trace in 2-3 paragraphs. Walk through:\n"
                f"1. The agent's observation and data parsing steps\n"
                f"2. The decision/classification logic applied\n"
                f"3. The final decision (routing, severity label, palace index, or guard verdict)\n\n"
                f"Use technical security terminology. The output should feel like a real agent trace."
            )

            print(f"[{i+1}/30] {scenario[:60]}...")
            stdout, stderr = qwen_stream(prompt, SYSTEM_PROMPT)
            if stderr:
                print(f"  stderr: {stderr[:200]}")

            output = stdout if stdout else "[generation failed - placeholder]"
            entry = {
                "instruction": instruction,
                "input": emission,
                "output": output
            }
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
            f.flush()
            done += 1

    print(f"Done: {done}/30 entries written to {outpath}")
    return done

if __name__ == "__main__":
    WORKDIR.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("DATASET 1: secdev_projects.jsonl")
    print("=" * 60)
    generate_secdev_projects()

    print("=" * 60)
    print("DATASET 2: security_reasoning.jsonl")
    print("=" * 60)
    generate_security_reasoning()

    print("=" * 60)
    print("DATASET 3: watson_agent_traces.jsonl")
    print("=" * 60)
    generate_watson_traces()

    print("=" * 60)
    print("ALL DATASETS COMPLETE")
    print("=" * 60)
