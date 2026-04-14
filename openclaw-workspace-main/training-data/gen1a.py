#!/usr/bin/env python3
"""Dataset 1: secdev_projects.jsonl - PART A (projects 1-25)."""
import subprocess, json
from pathlib import Path

QWEN = "/home/openclaw/.npm-global/bin/qwen"
MODEL = "qwen-3.6"
SYSTEM = "You are a security education expert. Provide technically accurate, educational explanations in 2-3 paragraphs. Focus on concepts and methodology, not code."

PROJECTS_A = [
    ("01-honeypot-basic", "Explain how to build a honeypot basic for educational purposes"),
    ("02-password-cracker", "Explain how to build a password cracker for educational purposes"),
    ("03-network-sniffer", "Explain how to build a network sniffer for educational purposes"),
    ("04-keylogger-practice", "Explain how to build a keylogger practice for educational purposes"),
    ("05-digital-forensics", "Explain how to build a digital forensics for educational purposes"),
    ("06-home-lab", "Explain how to build a home lab for educational purposes"),
    ("07-file-encryption", "Explain how to build a file encryption for educational purposes"),
    ("08-phishing-simulation", "Explain how to build a phishing simulation for educational purposes"),
    ("09-wifi-security", "Explain how to build a wifi security for educational purposes"),
    ("10-network-vuln-scan", "Explain how to build a network vuln scan for educational purposes"),
    ("11-firewall-setup", "Explain how to build a firewall setup for educational purposes"),
    ("12-two-factor-auth", "Explain how to build a two factor auth for educational purposes"),
    ("13-secure-web-app", "Explain how to build a secure web app for educational purposes"),
    ("14-snort-ids", "Explain how to build a snort ids for educational purposes"),
    ("15-vuln-scanner", "Explain how to build a vuln scanner for educational purposes"),
    ("16-dns-spoofing-detection", "Explain how to build a dns spoofing detection for educational purposes"),
    ("17-antivirus-study", "Explain how to build a antivirus study for educational purposes"),
    ("18-anomaly-detector", "Explain how to build a anomaly detector for educational purposes"),
    ("19-malware-analysis", "Explain how to build a malware analysis for educational purposes"),
    ("20-tls-setup", "Explain how to build a tls setup for educational purposes"),
    ("21-zero-day-exploits", "Explain how to build a zero day exploits for educational purposes"),
    ("22-tor-privacy", "Explain how to build a tor privacy for educational purposes"),
    ("23-honeypot-advanced", "Explain how to build a honeypot advanced for educational purposes"),
    ("24-gpu-password-cracking", "Explain how to build a gpu password cracking for educational purposes"),
    ("25-browser-extension", "Explain how to build a browser extension for educational purposes"),
]

def call_qwen(prompt):
    proc = subprocess.Popen(
        [QWEN, "-p", SYSTEM, "--model", MODEL],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    stdout, stderr = proc.communicate(input=prompt, timeout=90)
    return stdout.strip()

outpath = Path("/home/openclaw/.openclaw/workspace/training-data/secdev_projects.jsonl")
done = 0
for i, (proj_slug, instruction) in enumerate(PROJECTS_A):
    name_display = proj_slug[3:].replace("-", " ")
    prompt = (
        f"Write 2-3 paragraphs explaining how to build a {name_display} "
        f"for educational/security training purposes. Cover: (1) the technical approach and components, "
        f"(2) how it works and why it matters for security education, (3) key learning objectives. "
        f"Be technically accurate and educational."
    )
    print(f"[{i+1}/25] {proj_slug}", flush=True)
    try:
        output = call_qwen(prompt)
    except Exception as e:
        print(f"  ERROR: {e}", flush=True)
        output = f"[generation failed: {e}]"
    entry = {"instruction": instruction, "input": "", "output": output}
    with open(outpath, "a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    done += 1

print(f"PART A COMPLETE: {done}/25", flush=True)
