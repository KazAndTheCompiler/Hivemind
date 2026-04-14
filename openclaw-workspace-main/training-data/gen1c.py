#!/usr/bin/env python3
"""Dataset 1: secdev_projects.jsonl - PART C (projects 51-70+)."""
import subprocess, json
from pathlib import Path

QWEN = "/home/openclaw/.npm-global/bin/qwen"
MODEL = "qwen-3.6"
SYSTEM = "You are a security education expert. Provide technically accurate, educational explanations in 2-3 paragraphs. Focus on concepts and methodology, not code."

PROJECTS_C = [
    ("51-shellcode-generator", "Explain how to build a shellcode generator for educational purposes"),
    ("52-privilege-escalation", "Explain how to build a privilege escalation for educational purposes"),
    ("53-active-directory-security", "Explain how to build a active directory security for educational purposes"),
    ("54-network-segmentation", "Explain how to build a network segmentation for educational purposes"),
    ("55-web-firewall-config", "Explain how to build a web firewall config for educational purposes"),
    ("56-secure-boot-config", "Explain how to build a secure boot config for educational purposes"),
    ("57-embedded-systems-security", "Explain how to build a embedded systems security for educational purposes"),
    ("58-defense-evasion-techniques", "Explain how to build a defense evasion techniques for educational purposes"),
    ("59-memory-forensics", "Explain how to build a memory forensics for educational purposes"),
    ("60-cryptography-implementation", "Explain how to build a cryptography implementation for educational purposes"),
    ("61-threat-intel-platform", "Explain how to build a threat intel platform for educational purposes"),
    ("62-camera-security", "Explain how to build a camera security for educational purposes"),
    ("63-wireless-pentest", "Explain how to build a wireless pentest for educational purposes"),
    ("64-insider-threat-detection", "Explain how to build a insider threat detection for educational purposes"),
    ("65-email-security", "Explain how to build a email security for educational purposes"),
    ("66-software-supply-chain", "Explain how to build a software supply chain for educational purposes"),
    ("66-vulnerability-scanner", "Explain how to build a vulnerability scanner for educational purposes"),
    ("67-container-security", "Explain how to build a container security for educational purposes"),
    ("67-datacenter-security", "Explain how to build a datacenter security for educational purposes"),
    ("68-bug-bounty-playbook", "Explain how to build a bug bounty playbook for educational purposes"),
    ("68-vehicle-security", "Explain how to build a vehicle security for educational purposes"),
    ("69-ics-scada-security", "Explain how to build a ics scada security for educational purposes"),
    ("69-steganography", "Explain how to build a steganography for educational purposes"),
    ("70-biometric-auth", "Explain how to build a biometric auth for educational purposes"),
    ("70-security-architecture", "Explain how to build a security architecture for educational purposes"),
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
for i, (proj_slug, instruction) in enumerate(PROJECTS_C):
    name_display = proj_slug[3:].replace("-", " ")
    prompt = (
        f"Write 2-3 paragraphs explaining how to build a {name_display} "
        f"for educational/security training purposes. Cover: (1) the technical approach and components, "
        f"(2) how it works and why it matters for security education, (3) key learning objectives. "
        f"Be technically accurate and educational."
    )
    print(f"[{i+51}/70] {proj_slug}", flush=True)
    try:
        output = call_qwen(prompt)
    except Exception as e:
        print(f"  ERROR: {e}", flush=True)
        output = f"[generation failed: {e}]"
    entry = {"instruction": instruction, "input": "", "output": output}
    with open(outpath, "a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    done += 1

print(f"PART C COMPLETE: {done}/25", flush=True)
