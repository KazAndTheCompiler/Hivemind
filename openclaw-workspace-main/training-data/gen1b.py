#!/usr/bin/env python3
"""Dataset 1: secdev_projects.jsonl - PART B (projects 26-50)."""
import subprocess, json
from pathlib import Path

QWEN = "/home/openclaw/.npm-global/bin/qwen"
MODEL = "qwen-3.6"
SYSTEM = "You are a security education expert. Provide technically accurate, educational explanations in 2-3 paragraphs. Focus on concepts and methodology, not code."

PROJECTS_B = [
    ("26-malware-sandbox", "Explain how to build a malware sandbox for educational purposes"),
    ("27-full-disk-encryption", "Explain how to build a full disk encryption for educational purposes"),
    ("28-ml-intrusion-detection", "Explain how to build a ml intrusion detection for educational purposes"),
    ("29-secure-routing", "Explain how to build a secure routing for educational purposes"),
    ("30-crypto-wallet", "Explain how to build a crypto wallet for educational purposes"),
    ("31-rootkit-analysis", "Explain how to build a rootkit analysis for educational purposes"),
    ("32-darkweb-scraper", "Explain how to build a darkweb scraper for educational purposes"),
    ("33-ddos-simulation", "Explain how to build a ddos simulation for educational purposes"),
    ("34-secure-messaging-app", "Explain how to build a secure messaging app for educational purposes"),
    ("35-pki-build", "Explain how to build a pki build for educational purposes"),
    ("36-ctf-writeups", "Explain how to build a ctf writeups for educational purposes"),
    ("37-container-security", "Explain how to build a container security for educational purposes"),
    ("38-漏洞分析", "Explain how to build a 漏洞分析 for educational purposes"),
    ("39-threat-hunting", "Explain how to build a threat hunting for educational purposes"),
    ("40-web-security-header", "Explain how to build a web security header for educational purposes"),
    ("41-red-team-engagement", "Explain how to build a red team engagement for educational purposes"),
    ("42-iot-security-assessment", "Explain how to build a iot security assessment for educational purposes"),
    ("43-binary-analysis", "Explain how to build a binary analysis for educational purposes"),
    ("44-exploit-development", "Explain how to build a exploit development for educational purposes"),
    ("45-api-security-testing", "Explain how to build a api security testing for educational purposes"),
    ("46-devops-security", "Explain how to build a devops security for educational purposes"),
    ("47-attack-detection-lab", "Explain how to build a attack detection lab for educational purposes"),
    ("48-cloud-security-hardening", "Explain how to build a cloud security hardening for educational purposes"),
    ("49-social-engineering", "Explain how to build a social engineering for educational purposes"),
    ("50-mobile-pentest", "Explain how to build a mobile pentest for educational purposes"),
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
for i, (proj_slug, instruction) in enumerate(PROJECTS_B):
    name_display = proj_slug[3:].replace("-", " ")
    prompt = (
        f"Write 2-3 paragraphs explaining how to build a {name_display} "
        f"for educational/security training purposes. Cover: (1) the technical approach and components, "
        f"(2) how it works and why it matters for security education, (3) key learning objectives. "
        f"Be technically accurate and educational."
    )
    print(f"[{i+26}/50] {proj_slug}", flush=True)
    try:
        output = call_qwen(prompt)
    except Exception as e:
        print(f"  ERROR: {e}", flush=True)
        output = f"[generation failed: {e}]"
    entry = {"instruction": instruction, "input": "", "output": output}
    with open(outpath, "a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    done += 1

print(f"PART B COMPLETE: {done}/25", flush=True)
