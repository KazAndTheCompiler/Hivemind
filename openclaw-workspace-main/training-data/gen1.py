#!/usr/bin/env python3
"""Dataset 1: secdev_projects.jsonl - 70 entries."""
import subprocess, json
from pathlib import Path

WORKDIR = Path("/home/openclaw/.openclaw/workspace/training-data")
PROJDIR = Path("/tmp/secdev_project/projects")
QWEN = "/home/openclaw/.npm-global/bin/qwen"
MODEL = "qwen-3.6"
SYSTEM = "You are a security education expert. Provide technically accurate, educational explanations in 2-3 paragraphs. Focus on concepts and methodology, not code."

PROJECTS = [
    "01-honeypot-basic","02-password-cracker","03-network-sniffer","04-keylogger-practice",
    "05-digital-forensics","06-home-lab","07-file-encryption","08-phishing-simulation",
    "09-wifi-security","10-network-vuln-scan","11-firewall-setup","12-two-factor-auth",
    "13-secure-web-app","14-snort-ids","15-vuln-scanner","16-dns-spoofing-detection",
    "17-antivirus-study","18-anomaly-detector","19-malware-analysis","20-tls-setup",
    "21-zero-day-exploits","22-tor-privacy","23-honeypot-advanced","24-gpu-password-cracking",
    "25-browser-extension","26-malware-sandbox","27-full-disk-encryption","28-ml-intrusion-detection",
    "29-secure-routing","30-crypto-wallet","31-rootkit-analysis","32-darkweb-scraper",
    "33-ddos-simulation","34-secure-messaging-app","35-pki-build","36-ctf-writeups",
    "37-container-security","38-漏洞分析","39-threat-hunting","40-web-security-header",
    "41-red-team-engagement","42-iot-security-assessment","43-binary-analysis","44-exploit-development",
    "45-api-security-testing","46-devops-security","47-attack-detection-lab","48-cloud-security-hardening",
    "49-social-engineering","50-mobile-pentest","51-shellcode-generator","52-privilege-escalation",
    "53-active-directory-security","54-network-segmentation","55-web-firewall-config","56-secure-boot-config",
    "57-embedded-systems-security","58-defense-evasion-techniques","59-memory-forensics",
    "60-cryptography-implementation","61-threat-intel-platform","62-camera-security",
    "63-wireless-pentest","64-insider-threat-detection","65-email-security",
    "66-software-supply-chain","66-vulnerability-scanner","67-container-security",
    "67-datacenter-security","68-bug-bounty-playbook","68-vehicle-security",
    "69-ics-scada-security","69-steganography","70-biometric-auth","70-security-architecture",
]

def call_qwen(prompt):
    proc = subprocess.Popen(
        [QWEN, "-p", SYSTEM, "--model", MODEL],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    stdout, stderr = proc.communicate(input=prompt, timeout=90)
    return stdout.strip()

outpath = WORKDIR / "secdev_projects.jsonl"
done = 0
with open(outpath, "w") as f:
    for i, proj in enumerate(PROJECTS):
        num = proj.split("-")[0]
        name_display = proj[len(num)+1:] if len(proj) > len(num)+1 else proj
        instruction = f"Explain how to build a {name_display.replace('-', ' ')} for educational purposes"
        prompt = (
            f"Write 2-3 paragraphs explaining how to build a {name_display.replace('-', ' ')} "
            f"for educational/security training purposes. Cover: (1) the technical approach and components, "
            f"(2) how it works and why it matters for security education, (3) key learning objectives. "
            f"Be technically accurate and educational."
        )
        print(f"[{i+1}/70] {proj}", flush=True)
        try:
            output = call_qwen(prompt)
        except Exception as e:
            print(f"  ERROR: {e}", flush=True)
            output = f"[generation failed: {e}]"
        entry = {"instruction": instruction, "input": "", "output": output}
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        f.flush()
        done += 1

print(f"COMPLETE: {done}/70 -> {outpath}", flush=True)
