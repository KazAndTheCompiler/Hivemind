#!/usr/bin/env python3
"""Dataset 4: image_captions.jsonl - 80 entries."""
import subprocess, json
from pathlib import Path

QWEN = "/home/openclaw/.npm-global/bin/qwen"
MODEL = "qwen-3.6"
SYSTEM = "You are a security education expert. Write detailed, technical image captions (2-3 sentences) for security diagrams and visualizations. Focus on accuracy and visual detail."
OUTPATH = Path("/home/openclaw/.openclaw/workspace/training-data/image_captions.jsonl")

TOPICS = [
    ("honeypot_network.jpg", "honeypot network diagram", "Network diagram showing a honeypot system decoy server connected to the internet with attacker lures, separated from production network by firewall isolation, including logging and monitoring points."),
    ("firewall_architecture.jpg", "firewall architecture", "Firewall architecture diagram showing perimeter defense with multiple DMZ zones separated by stateful inspection firewalls, including inbound/outbound traffic flows and security policy enforcement points."),
    ("attack_chain.jpg", "attack chain (MITRE ATT&CK)", "Attack chain visualization showing the kill chain phases from reconnaissance through initial access, execution, persistence, privilege escalation, lateral movement, collection, exfiltration, and impact with example techniques at each stage."),
    ("ctf_challenge_layout.jpg", "CTF challenge layout", "CTF challenge layout showing multiple flag categories (web exploitation, reverse engineering, cryptography, forensics, pwn) with point values, difficulty ratings, and challenge connection topology."),
    ("malware_behavior_graph.jpg", "malware behavior graph", "Malware behavior graph showing infection chain: initial dropper delivering payload, process injection into legitimate executables, registry persistence modifications, and C2 beacon communication pattern."),
    ("pentest_workflow.jpg", "penetration testing workflow", "Penetration testing workflow diagram showing phases: reconnaissance, scanning, enumeration, exploitation, privilege escalation, lateral movement, and reporting with tools used at each phase."),
    ("soc_dashboard.jpg", "SOC dashboard visualization", "Security operations center dashboard showing incident timelines, alert priority queues, geographic threat map, top attack vectors, mean time to detect/respond metrics, and active investigation cards."),
    ("zero_trust_model.jpg", "zero trust architecture model", "Zero trust architecture diagram showing identity verification at every access point, microsegmentation of network zones, lateral movement prevention, and continuous authentication with policy enforcement engine."),
    ("encryption_flow.jpg", "encryption data flow", "Encryption flow diagram showing symmetric encryption for bulk data with asymmetric encryption for key exchange, including TLS handshake sequence, certificate validation, and session key derivation steps."),
    ("渗透测试_flow.jpg", "penetration testing methodology flow", "Chinese-language penetration testing workflow showing information gathering, vulnerability analysis, exploitation, post-exploitation, and reporting phases with corresponding tool categories and documentation requirements."),
    ("phishing_email_layout.jpg", "phishing email analysis layout", "Phishing email layout annotated with red flags: mismatched sender domain, urgency language, suspicious URLs revealed on hover, malicious attachment indicators, and legitimate vs fake login page comparison."),
    ("malware_sandbox_arch.jpg", "malware sandbox architecture", "Malware analysis sandbox architecture showing isolated VM environment, snapshot rollback mechanism, behavioral monitoring of process creation, file system, registry, and network activity with detonation timeline."),
    ("vulnerability_scan_result.jpg", "vulnerability scan results visualization", "Vulnerability scan results dashboard showing asset inventory, vulnerability counts by severity (critical/high/medium/low), affected software versions, CVSS scores, and remediation priority recommendations."),
    ("sql_injection_attack.jpg", "SQL injection attack diagram", "SQL injection attack diagram showing user input field, malformed SQL query bypassing authentication, database error response leaking schema information, and successful data exfiltration through UNION-based injection."),
    ("buffer_overflow_exploit.jpg", "buffer overflow exploit visualization", "Buffer overflow exploit visualization showing stack layout with return address overwrite, NOP sled insertion, shellcode placement, and successful instruction pointer redirect to malicious code."),
    ("network_segmentation.jpg", "network segmentation architecture", "Network segmentation architecture showing VLAN separation of guest, corporate, DMZ, and OT networks with ACLs, inter-VLAN routing restrictions, and firewall enforcement points between trusted zones."),
    ("xss_attack_flow.jpg", "cross-site scripting attack flow", "Cross-site scripting attack flow showing malicious script injection via comment field, storage in database, delivery to victim browsers, session cookie theft, and account hijacking on the vulnerable web application."),
    ("container_security.jpg", "container security layers", "Container security architecture showing image scanning, base layer isolation, runtime protection, namespace/cgroup containment, seccomp profiles, AppArmor/SELinux Mandatory Access Control, and orchestration-level policy enforcement."),
    ("devsecops_pipeline.jpg", "DevSecOps security pipeline", "DevSecOps pipeline showing security gates integrated into CI/CD: SAST static analysis, DAST dynamic testing, SCA dependency scanning, container image scanning, secrets detection, and automated compliance checks at each stage."),
    ("cloud_security_hardening.jpg", "cloud security hardening diagram", "Cloud security hardening diagram showing IAM least privilege policies, security group restrictions, VPC network isolation, encryption at rest and in transit, cloudtrail logging, and guardduty threat detection configuration."),
    ("ransomware_infection_path.jpg", "ransomware infection path", "Ransomware infection path showing initial access via phishing email, lateral movement using stolen credentials, encryption of file servers, shadow copies deletion, and ransom note display with payment instructions."),
    ("wifi_attack_topology.jpg", "WiFi attack topology", "WiFi attack topology showing WPA2 4-way handshake capture, offline password cracking workstation, evil twin access point deployment, deauthentication attack flow, and legitimate client reconnection to rogue AP."),
    ("digital_forensics_chain.jpg", "digital forensics chain of custody", "Digital forensics chain of custody diagram showing evidence acquisition from disk imaging, memory capture, network log collection, proper labeling, secure storage, hash verification, and documentation trail for court admissibility."),
    ("binary_analysis_workflow.jpg", "binary analysis workflow", "Binary analysis workflow showing static analysis phases: disassembly, function identification, control flow graphing, string extraction, import resolution, and dynamic analysis phases: debugging, API monitoring, behavioral tracing."),
    ("iot_security_architecture.jpg", "IoT security architecture", "IoT security architecture showing device identity provisioning, secure boot chain, OTA update authentication, gateway broker isolation, cloud backend segmentation, and mobile app attestation requirements."),
    ("active_directory_attack.jpg", "Active Directory attack path", "Active Directory attack path showing kerberoasting, AS-REP roasting, golden ticket creation, DCSync attack, DCShadow execution, and lateral movement techniques with corresponding defensive detection opportunities."),
    ("ddos_attack_types.jpg", "DDoS attack types taxonomy", "DDoS attack taxonomy showing volumetric attacks (UDP flood, ICMP flood), protocol attacks (SYN flood, Ping of Death), and application layer attacks (HTTP flood, DNS amplification) with corresponding mitigation strategies."),
    ("secure_boot_chain.jpg", "secure boot chain of trust", "Secure boot chain showing UEFI firmware integrity verification, bootloader signature validation, kernel image measurement, initrd authentication, anddm-verity for root filesystem integrity attestation."),
    ("tls_handshake_detail.jpg", "TLS handshake detailed flow", "TLS handshake detailed flow showing ClientHello with supported cipher suites, ServerHello with certificate presentation, key exchange (DH/ECDH), Finished messages, and subsequent encrypted application data transport."),
    ("rootkit_architecture.jpg", "rootkit infection architecture", "Rootkit architecture showing user-mode rootkit hooking (IAT/EAT/inline), kernel-mode driver manipulation, DKOM direct kernel object modification, and persistence through service and registry mechanisms."),
    ("api_security_testing.jpg", "API security testing checklist", "API security testing checklist visualization showing authentication testing, authorization testing, rate limiting verification, input validation fuzzing, injection testing, and JWT token manipulation for each REST endpoint."),
    ("threat_intel_framework.jpg", "threat intelligence framework", "Threat intelligence framework showing the intelligence cycle: direction, collection, processing, analysis, and dissemination with corresponding outputs: strategic, operational, tactical, and technical threat intelligence."),
    ("memory_forensics_acquisition.jpg", "memory forensics acquisition", "Memory forensics acquisition diagram showing live RAM acquisition tools, hibernation file extraction, page file analysis, crash dump retrieval, and volatile data preservation importance in incident response."),
    ("social_engineering_attack.jpg", "social engineering attack vectors", "Social engineering attack vector taxonomy showing pretexting, baiting, quid pro quo, tailgating, phishing (spear/whale/vishing/smishing), and insider threat categories with real-world example scenarios."),
    ("ml_intrusion_detection.jpg", "machine learning intrusion detection", "Machine learning intrusion detection architecture showing network traffic feature extraction, supervised learning model for known attack classification, unsupervised anomaly detection for zero-day identification, and alert prioritization."),
    ("camera_security_topology.jpg", "IP camera security topology", "IP camera security topology showing ONVIF protocol security, RTSP authentication, local NVR storage, cloud streaming encryption, network isolation from corporate LAN, and default credential vulnerability warnings."),
    ("steganography_detection.jpg", "steganography detection workflow", "Steganography detection workflow showing LSB analysis, frequency domain analysis, chi-square testing, file structure anomaly detection, and successful hidden data extraction from carrier images."),
    ("kernel_exploit_techniques.jpg", "kernel exploit technique diagrams", "Kernel exploit technique diagrams showing privilege escalation via kernel driver vulnerabilities, integer overflow in system calls, use-after-free in kernel memory management, and corresponding SMEP/SMAP bypass methods."),
    ("supply_chain_attack_flow.jpg", "software supply chain attack flow", "Software supply chain attack flow showing compromise at build dependency (npm/RubyGems/PyPI), malicious commit injection, build server compromise, artifact tampering, and downstream victim infection through legitimate update mechanisms."),
    ("privileged_access_workstation.jpg", "privileged access workstation design", "Privileged access workstation design showing jump server architecture, Just-in-Time access provisioning, session recording, application whitelisting, isolated browsing environment, and credential theft prevention mechanisms."),
]

def call_qwen(prompt):
    proc = subprocess.Popen(
        [QWEN, "-p", SYSTEM, "--model", MODEL],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    stdout, stderr = proc.communicate(input=prompt, timeout=90)
    return stdout.strip()

done = 0
for i, (img, topic, default_caption) in enumerate(TOPICS):
    instruction = f"Write a detailed technical caption for an image titled '{img}' showing a {topic}."
    prompt = (
        f"Write a detailed 2-3 sentence technical caption for a security diagram image.\n"
        f"Image: {img}\n"
        f"Topic: {topic}\n\n"
        f"Write 2-3 sentences describing what this diagram shows in technical security terms. "
        f"Include labeled components, data flows, and security-relevant details visible in the visualization. "
        f"Use precise security terminology. Example format: 'A network diagram showing X, with Y communicating to Z through W, highlighting security control S.'"
    )
    print(f"[{i+1}/40] {img}", flush=True)
    try:
        output = call_qwen(prompt)
    except Exception as e:
        print(f"  ERROR: {e}", flush=True)
        output = f"[generation failed: {e}]"

    caption = output if output else default_caption
    tags = [t.strip() for t in topic.replace("(", " ").replace(")", " ").split() if len(t) > 2][:5]
    entry = {"image": img, "caption": caption, "tags": tags}
    with open(OUTPATH, "a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    done += 1

# Generate 41-80 with varied security topics
EXTRA_TOPICS = [
    "Web application firewall rule configuration showing positive security model with allowed methods, blocked payloads, and rate limiting thresholds visualized as traffic flow diagrams.",
    "OT ICS SCADA network topology showing Purdue model分层 from Level 0 (field devices) through Level 5 (enterprise network) with DMZ isolation and historian server placement.",
    "Bug bounty scope visualization showing in-scope assets, out-of-scope systems, test restrictions, and reward tiers based on vulnerability severity.",
    "Red team engagement operation flow showing C2 infrastructure setup, phishing campaign deployment, initial access gained, internal reconnaissance, and objective extraction.",
    "Binary exploitation series showing stack pivot, ROP chain construction, and return-to-libc attack execution with memory layout diagrams.",
    "Incident response playbook flowchart showing detection classification, triage decision tree, containment actions by severity, and escalation paths to different team roles.",
    "Cryptographic key management lifecycle showing key generation, distribution, storage in HSM, rotation scheduling, escrow procedures, and secure destruction timelines.",
    "Email security visualization showing SPF DKIM DMARC authentication flow, spam filtering decision tree, and spear-phishing detection failure points.",
    "Wireless penetration testing methodology showing wardriving map collection, WPA handshake capture, offline cracking, and post-exploitation network access diagrams.",
    "Memory corruption exploit development showing ASLR bypass techniques, heap spray visualization, and code reuse attacks with gadget chain assembly.",
    "Cloud IAM privilege escalation path showing misconfigured IAM roles, overly permissive policies, service account abuse, and cross-account trust relationship exploitation.",
    "Mobile application security testing workflow showing APK reverse engineering, certificate pinning bypass, insecure data storage analysis, and runtime instrumentation setup.",
    "Privilege escalation enumeration checklist showing enumeration commands for Linux sudo abuse, SUID binaries, crontab analysis, and kernel exploit discovery paths.",
    "Container escape technique diagram showing Docker namespace isolation breakout, shared host namespace access, privileged container root access, and host filesystem mount exploitation.",
    "Kubernetes security posture assessment showing RBAC misconfigurations, exposed dashboard access, admission controller gaps, and etcd data exposure vulnerability locations.",
    "Biometric authentication system architecture showing fingerprint minutiae extraction, iris pattern matching, liveness detection, and enrollment verification failure modes.",
    "Vehicle CAN bus attack diagram showing OBD-II port access, message injection, speedometer manipulation, brake/disable commands, and diagnostic tool communication patterns.",
    "Hardware security module internal architecture showing secure key storage, cryptographic acceleration, tamper detection, secure boot attestation, and key usage policy enforcement.",
    "Defense evasion technique matrix showing timestomping, log deletion, file masquerading, process hollowing, and living-off-the-land tool detection challenges.",
    "Cloud data exfiltration scenario showing S3 bucket public exposure, data download patterns, cloudtrail log gaps, and egress monitoring bypass through legitimate AWS services.",
    "Binary reverse engineering session showing IDA Pro disassembly of malware communication protocol, x86 assembly instruction identification, and cross-referenced function call graph.",
    "Social engineering phone call attack flow showing vishing pretext execution, caller ID spoofing, information gathering, and access provisioning manipulation.",
    "Zero-day disclosure timeline showing responsible disclosure process, CVE assignment, vendor patch development, coordinated release, and affected system patching guidance.",
    "Secure coding patterns visualization showing input validation functions, output encoding methods, parameterized query construction, and cryptographic API usage examples.",
    "Malware packer obfuscation layers showing packed executable binary sections, decompression stub, import address table reconstruction, and anti-disassembly countermeasures.",
    "Network monitoring architecture showing Zeek log aggregation, Suricata rule matching, SIEM ingestion pipeline, alert correlation rules, and analyst investigation workflow.",
    "Blockchain security audit checklist showing smart contract attack surface mapping, reentrancy vulnerability patterns, integer overflow scenarios, and access control weakness analysis.",
    "Physical security penetration test floor plan showing badge cloning points, tailgating opportunities, lock bumping targets, and security guard shift coverage gaps.",
    "Fat binary malware analysis showing cross-platform payload delivery, PowerShell Empire agent deployment, Mimikatz credential extraction, and DCSync privilege escalation actions.",
    "API gateway security policy showing rate limiting by client ID, JWT validation, OAuth 2.0 token introspection, mutual TLS certificate verification, and WAF rule application sequence.",
    "SIEM correlation rule example showing event sequence pattern: failed login followed by successful login from new IP, triggering account compromise alert with risk scoring.",
    "Malware traffic analysis showing beaconing interval patterns, domain generation algorithm (DGA) domain contacted, file hash reputation lookup, and sandbox detonation behavioral report.",
    "Federated identity architecture showing SAML assertion flow, OIDC token exchange, trust chain validation, and attribute-based access control policy evaluation across domains.",
    "Network reconnaissance visualization showing DNS enumeration, port scanning results, service fingerprinting, OS detection, and vulnerability assessment data aggregated into attack surface map.",
    "Hardware Trojan taxonomy showing malicious circuit modifications at foundry level, trigger mechanism activation conditions, and payload delivery through subtle circuit behavior changes.",
    "Secure coding code review annotation showing SQL injection vulnerable code line, static analysis alert, suggested fix with parameterized query, and security regression test case.",
    "Insider threat detection scenario showing anomalous database query patterns, large file download events, scheduled task creation, and external storage device access indicators.",
    "Serverless function attack surface showing event source trigger injection, IAM permission overprivilege, shared dependency vulnerability, and storage bucket policy misconfiguration.",
    "Threat hunting hypothesis framework showing investigative hunt hypothesis development, data source mapping, analytics rule creation, and findings documentation for proactive detection.",
    "PKI certificate chain validation showing root CA, intermediate CA, end-entity certificate, path building, revocation checking (CRL/OCSP), and trust store anchor matching.",
]

for i, desc in enumerate(EXTRA_TOPICS):
    img = f"security_diagram_{i+1:02d}.jpg"
    topic_words = desc.split()[:6]
    topic = " ".join(topic_words)
    tags = [t.strip(",.") for t in topic_words if len(t) > 3][:5]
    prompt = (
        f"Write a detailed 2-3 sentence technical caption for a security diagram.\n"
        f"Topic: {topic}\n"
        f"Description: {desc}\n\n"
        f"Write 2-3 sentences describing what this diagram shows in technical security terms. "
        f"Include labeled components, data flows, and security-relevant details. "
        f"Use precise security terminology."
    )
    print(f"[{i+41}/80] {img}", flush=True)
    try:
        output = call_qwen(prompt)
    except Exception as e:
        print(f"  ERROR: {e}", flush=True)
        output = desc
    entry = {"image": img, "caption": output, "tags": tags}
    with open(OUTPATH, "a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    done += 1

print(f"COMPLETE: {done}/80 -> {OUTPATH}", flush=True)
