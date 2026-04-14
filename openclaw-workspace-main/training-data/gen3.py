#!/usr/bin/env python3
"""Dataset 3: watson_agent_traces.jsonl - 30 entries."""
import subprocess, json
from pathlib import Path

QWEN = "/home/openclaw/.npm-global/bin/qwen"
MODEL = "qwen-3.6"
SYSTEM = "You are simulating a Watson/MemPalace security agent reasoning trace. Provide realistic, technically detailed agent traces."
OUTPATH = Path("/home/openclaw/.openclaw/workspace/training-data/watson_agent_traces.jsonl")

EMISSIONS = [
    '{"emission_type": "network", "src_ip": "192.168.1.100", "dst_ip": "8.8.8.8", "bytes_out": 524288, "timestamp": "2024-01-15T02:30:00Z"}',
    '{"emission_type": "file", "path": "/tmp/.hidden_payload", "entropy": 7.98, "sha256": "a3f1b9...", "packed": true, "timestamp": "2024-01-15T02:31:00Z"}',
    '{"emission_type": "registry", "key": "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", "value": "C:\\Temp\\svchost.exe", "timestamp": "2024-01-15T02:32:00Z"}',
    '{"emission_type": "process", "pid": 4532, "name": "powershell.exe", "cmdline": "powershell -enc Base64String...", "parent": "explorer.exe", "timestamp": "2024-01-15T02:33:00Z"}',
    '{"emission_type": "network", "src_ip": "10.0.0.55", "dst_ip": "185.220.101.45", "port": 9001, "bytes_out": 2048, "timestamp": "2024-01-15T02:34:00Z"}',
    '{"emission_type": "memory", "address": "0x7ffe0000", "content_hash": "b9c4d7...", "permissions": "rwx", "timestamp": "2024-01-15T02:35:00Z"}',
    '{"emission_type": "disk", "sector_read": [0, 1, 2, 3], "volume_serial": "FFFF-AAAA", "timestamp": "2024-01-15T02:36:00Z"}',
    '{"emission_type": "registry", "key": "HKCU\\Software\\Classes\\CLSID\\{ABCDEFGH-1234-5678-9ABC-DEF012345678}", "timestamp": "2024-01-15T02:37:00Z"}',
    '{"emission_type": "process", "pid": 8871, "name": "svchost.exe", "cmdline": "svchost -k netsvcs", "parent": "services.exe", "timestamp": "2024-01-15T02:38:00Z"}',
    '{"emission_type": "network", "src_ip": "192.168.1.105", "dst_ip": "45.33.32.156", "bytes_in": 16384, "bytes_out": 8192, "timestamp": "2024-01-15T02:39:00Z"}',
    '{"emission_type": "file", "path": "C:\\Windows\\System32\\spool\\driver.ini", "size": 45823, "entropy": 6.2, "timestamp": "2024-01-15T02:40:00Z"}',
    '{"emission_type": "network", "src_ip": "10.10.0.20", "dst_ip": "193.188.25.138", "port": 4444, "protocol": "tcp", "timestamp": "2024-01-15T02:41:00Z"}',
    '{"emission_type": "process", "pid": 1204, "name": "rundll32.exe", "cmdline": "rundll32 javascript:\"\\..\\mshtml,RunHTMLApplication\"...", "parent": "explorer.exe", "timestamp": "2024-01-15T02:42:00Z"}',
    '{"emission_type": "memory", "address": "0x00400000", "content_hash": "deadbeef", "permissions": "r-x", "timestamp": "2024-01-15T02:43:00Z"}',
    '{"emission_type": "registry", "key": "HKLM\\System\\CurrentControlSet\\Services\\Tcpip\\Parameters", "value": "DefaultDNSSearchList=8.8.8.8,8.8.4.4", "timestamp": "2024-01-15T02:44:00Z"}',
]

SCENARIOS = [
    ("Palace indexing: high-entropy binary artifact",
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
     "Memory scan reveals RWX region at 0x7ffe0000 with content hash b9c4d7... matching known shellcode patterns. The severity classifier must evaluate: executable memory region, no associated process, high entropy content. Recommend block/quarantine vs. allow with deeper forensic capture."),
    ("Palace indexing: CLSID COM hijack reference",
     "A registry emission reveals a CLSID entry under HKCU\\Software\\Classes\\CLSID\\{...} during a passive Windows monitoring sweep. The indexer must determine if this represents a COM hijack, a legitimate application component, or benign leftover from uninstalled software."),
    ("Guard validation: large outbound DNS exfiltration",
     "Network emission shows 524KB of outbound traffic to 8.8.8.8 — unusual for standard DNS. The guard must evaluate whether this represents DNS exfiltration, a tunneling experiment, or legitimate large TXT record queries."),
    ("Agent routing: rundll32 via JavaScript URL scheme",
     "A process emission shows rundll32 executing a JavaScript URL that invokes mshtml RunHTMLApplication. This is a known living-off-the-land technique. The agent routing layer must decide between immediate block, deeper behavioral capture, or log-and-continued monitoring."),
    ("Finding severity: anomalous driver.ini size in System32",
     "A file emission in System32 shows spool\\driver.ini at 45KB with entropy 6.2. The severity classifier must decide whether this is a legitimate printer driver cache or a hidden payload disguised with a benign file name."),
    ("Guard validation: meterpreter beacon to port 4444",
     "Network emission shows outbound TCP to 193.188.25.138:4444 from an internal host. Port 4444 is commonly used by Metasploit's Meterpreter. The guard must validate against known C2 patterns, triggering block and alert if match confidence is high."),
    ("Finding severity: DNS server configurationtampering",
     "A registry emission reveals the DefaultDNSSearchList has been modified to custom values. This is a known persistence and interception technique. Severity assessment must consider whether the change was legitimate admin action or attacker modification."),
    ("Agent routing: process anomaly during anomaly-only monitoring",
     "A process emission during anomaly-detection mode shows a child process under suspicious parent. The routing layer must decide whether to spawn a forensic subagent, update the behavioral baseline, or escalate to human review based on anomaly confidence score."),
]

def call_qwen(prompt):
    proc = subprocess.Popen(
        [QWEN, "-p", SYSTEM, "--model", MODEL],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    stdout, stderr = proc.communicate(input=prompt, timeout=90)
    return stdout.strip()

done = 0
for i in range(30):
    scen_idx = i % len(SCENARIOS)
    scen_name, reasoning_brief = SCENARIOS[scen_idx]
    emission = EMISSIONS[i % len(EMISSIONS)]
    instruction = f"{scen_name}"

    prompt = (
        f"You are simulating a Watson/MemPalace security agent reasoning trace.\n"
        f"Given the following emission data:\n{emission}\n\n"
        f"Scenario: {reasoning_brief}\n\n"
        f"Generate a realistic agent reasoning trace in 2-3 paragraphs. Walk through:\n"
        f"1. The agent's observation and data parsing steps\n"
        f"2. The decision/classification logic applied\n"
        f"3. The final decision (routing, severity label, palace index, or guard verdict)\n\n"
        f"Use technical security terminology. The output should feel like a real agent trace."
    )
    print(f"[{i+1}/30] {scen_name[:60]}...", flush=True)
    try:
        output = call_qwen(prompt)
    except Exception as e:
        print(f"  ERROR: {e}", flush=True)
        output = f"[generation failed: {e}]"
    entry = {"instruction": instruction, "input": emission, "output": output}
    with open(OUTPATH, "a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    done += 1

print(f"COMPLETE: {done}/30 -> {OUTPATH}", flush=True)
