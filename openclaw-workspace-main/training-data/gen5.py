#!/usr/bin/env python3
"""Dataset 5: security_scenes.jsonl - 40 entries."""
import subprocess, json
from pathlib import Path

QWEN = "/home/openclaw/.npm-global/bin/qwen"
MODEL = "qwen-3.6"
SYSTEM = "You are a security education expert. Generate structured scene understanding data for security vision training."
OUTPATH = Path("/home/openclaw/.openclaw/workspace/training-data/security_scenes.jsonl")

SCENES = [
    {
        "scene": "A network operations center with multiple screens showing network topology maps, live traffic graphs, and a large digital map with blinking connection nodes across geographic regions.",
        "entities": ["network operations center", "monitoring screens", "network topology map", "live traffic graph", "geographic threat map"],
        "relations": "The geographic threat map shows active DDoS attacks targeting the US East Coast, while the traffic graphs show anomalous bandwidth spikes on core routers.",
        "caption": "SOC/NOC monitoring environment with multi-screen visualization showing real-time network topology, traffic analysis, and global threat geographic distribution indicating an active DDoS campaign."
    },
    {
        "scene": "A datacenter server room with rows of rack-mounted servers, overhead cable trays, cooling units, and a technician scanning server QR codes with a tablet device.",
        "entities": ["datacenter racks", "servers", "cooling units", "cable management", "technician tablet", "QR code scanner"],
        "relations": "The technician is verifying server identity against an asset inventory database using QR codes, and environmental sensors show temperature variance across rack rows.",
        "caption": "Datacenter asset management scene showing physical inventory verification via QR scanning linked to CMDB, with environmental monitoring for temperature anomalies indicating cooling failures."
    },
    {
        "scene": "A phishing email displayed on a laptop screen with sender address visible, HTML formatting showing logos, and a highlighted suspicious URL hovering over a link.",
        "entities": ["phishing email", "laptop screen", "sender address", "suspicious URL", "attachment", "urgency language"],
        "relations": "The email sender domain mismatches the displayed sender name, the URL differs from the claimed destination when hovered, and the attachment filename suggests an executable hidden as a document.",
        "caption": "Phishing email analysis scene showing mismatched sender identity, hover-verified URL discrepancy revealing malicious redirect, urgency language indicators, and suspicious attachment filename pattern."
    },
    {
        "scene": "A malware analysis sandbox environment showing a virtual machine snapshot being reverted, process monitor logging new processes, and a network capture showing C2 beacon traffic.",
        "entities": ["virtual machine", "snapshot rollback", "process monitor", "network capture", "C2 beacon", "registry changes"],
        "relations": "After reverting to clean snapshot, the malware execution triggers process creation, registry modifications for persistence, and outbound HTTPS beacon to known malicious domain.",
        "caption": "Malware detonation in sandbox showing behavioral analysis: process execution chain, registry persistence mechanism, and command-and-control beaconing pattern for indicator extraction."
    },
    {
        "scene": "A penetration testing report displayed on a monitor showing attack surface enumeration results, vulnerability findings ranked by CVSS score, and proof-of-concept screenshots.",
        "entities": ["pentest report", "vulnerability findings", "CVSS scores", "proof-of-concept screenshots", "attack surface map", "exploitation timeline"],
        "relations": "Critical SQL injection vulnerability enables remote code execution, rated CVSS 9.8, with successful exploitation shown in PoC screenshots of database schema and command output.",
        "caption": "Penetration test results dashboard showing vulnerability findings ranked by risk score, organized by attack surface area, with supporting proof-of-concept evidence and remediation priority."
    },
    {
        "scene": "A secure coding editor window showing source code with inline security annotation markers, a diff view of security fixes applied, and a test suite showing security regression results.",
        "entities": ["code editor", "security annotations", "code diff", "security fixes", "test suite", "SAST tool"],
        "relations": "The code diff shows input validation added to a previously vulnerable parameter, flagged by SAST tool, with corresponding unit test validating the fix without breaking functionality.",
        "caption": "Secure development workflow showing SAST integration with code review annotations highlighting a SQL injection vulnerability fix, corresponding unit test validation, and security regression confirmation."
    },
    {
        "scene": "A vulnerability scan results page showing an asset inventory table, color-coded severity badges, CVE references, and remediation timelines for each finding.",
        "entities": ["vulnerability scanner", "asset inventory", "CVE references", "severity badges", "remediation timeline", "affected software versions"],
        "relations": "Critical vulnerability CVE-2024-21762 in Fortinet VPN allows unauthenticated RCE, affecting 47 externally facing devices, remediation requires immediate patch or mitigation within 24 hours.",
        "caption": "Enterprise vulnerability scan results showing asset-critical vulnerability with CVE details, affected versions, patch availability status, and prioritized remediation timeline based on exposure."
    },
    {
        "scene": "An incident response timeline showing event log entries, alert correlation arrows, affected system icons, and analyst investigation notes branching from the initial detection point.",
        "entities": ["incident timeline", "event logs", "alert correlation", "affected systems", "investigation notes", "IOC extraction"],
        "relations": "Initial phishing alert correlates with document exploit, shell download, lateral movement to file server, and data staging before exfiltration, with each phase timestamped.",
        "caption": "Incident response timeline showing correlated events from initial alert through full attack chain reconstruction, with IOC extraction and affected system scope for incident report documentation."
    },
    {
        "scene": "A firewall rule configuration interface showing NAT rules, ACL tables with source/destination notation, zone-based policies, and connection state tracking entries.",
        "entities": ["firewall interface", "NAT rules", "ACL tables", "security zones", "stateful inspection", "connection tracking"],
        "relations": "External to DMZ HTTP traffic is permitted with translation to internal IP, while DMZ to internal traffic is denied by default deny policy, and established connections are tracked for return traffic.",
        "caption": "Enterprise firewall rule configuration showing zone-based access control lists, network address translation rules, and stateful connection tracking for perimeter defense policy enforcement."
    },
    {
        "scene": "A supply chain attack diagram showing a compromised CI/CD build pipeline, malicious commit in version control, backdoored dependency package, and infected artifact deployment to production.",
        "entities": ["CI/CD pipeline", "version control", "build server", "dependency package", "artifact repository", "production deployment"],
        "relations": "Malicious commit injected into version control triggers compromised build pipeline, backdoored dependency added to artifact, signed artifact deployed to production, infecting downstream customers.",
        "caption": "Software supply chain attack flow showing malicious code injection at version control, compromise of build infrastructure, backdoored artifact creation, and downstream victim infection through update mechanism."
    },
    {
        "scene": "A memory forensics capture workstation showing memory acquisition from a running system, Volatility framework analysis output, and process tree reconstruction with injected code regions highlighted.",
        "entities": ["memory acquisition tool", "Volatility analysis", "process tree", "injected code regions", "network connections", "registry artifacts"],
        "relations": "Volatility analysis reveals hidden process via DKOM rootkit technique, injected code in legitimate process memory, and network connections to known C2 infrastructure maintained through hooking.",
        "caption": "Memory forensics analysis showing live acquisition, Volatility framework process reconstruction identifying injected code and hidden processes characteristic of kernel-level rootkit compromise."
    },
    {
        "scene": "A zero trust architecture diagram showing user identity verification at each resource, microsegmented network zones, continuous authentication policy engine, and device posture assessment gates.",
        "entities": ["identity provider", "policy enforcement point", "microsegmented network", "device posture check", "continuous authentication", "resource access"],
        "relations": "User access request triggers identity verification, device compliance check, then microsegmented resource access granted only to the minimum required zone, with session monitoring throughout.",
        "caption": "Zero trust security model showing identity-centric access control with device posture assessment, microsegmented network zones, and continuous authentication enforcing least-privilege access to every resource."
    },
    {
        "scene": "A malware reverse engineering session with IDA Pro disassembler showing function call graph, Hex-Rays decompiled C code, and cross-references highlighting malicious API call sequence.",
        "entities": ["IDA Pro disassembler", "function call graph", "Hex-Rays decompiler", "API calls", "cross-references", "string references"],
        "relations": "Decompiled code shows CreateProcess API call with malicious command line constructed from Base64-decoded string referenced from encrypted resource section.",
        "caption": "Binary reverse engineering session showing disassembly and decompilation of malware communication routine, identifying malicious API call sequence for capability extraction and YARA rule development."
    },
    {
        "scene": "A CTF competition scoreboard showing team rankings, challenge category completion status, and individual challenge descriptions with point values and solve counts.",
        "entities": ["CTF scoreboard", "team rankings", "challenge categories", "point values", "solve counts", "challenge descriptions"],
        "relations": "Top team has solved all web exploitation challenges but is stuck on a hard pwn challenge worth 500 points, while second place team is closest on reverse engineering challenges.",
        "caption": "Capture The Flag competition scoreboard showing real-time team standings across web, pwn, reverse engineering, cryptography, and forensics categories with challenge solve statistics and point distributions."
    },
    {
        "scene": "An API security testing interface showing REST endpoint enumeration, authentication token manipulation attempts, and rate limiting verification results for each endpoint tested.",
        "entities": ["API tester", "REST endpoints", "authentication tokens", "rate limiting", "injection tests", "authorization checks"],
        "relations": "JWT token algorithm confusion attack successfully escalates from user to admin role, and endpoint enumeration reveals undocumented admin API lacking authentication requirement.",
        "caption": "API security assessment showing authentication weakness (JWT algorithm confusion achieving privilege escalation), authorization bypass (undocumented admin endpoint), and rate limiting verification failures."
    },
    {
        "scene": "A cloud security posture assessment showing IAM policy visualization, S3 bucket permissions matrix, VPC security group rules, and encryption status indicators across AWS resources.",
        "entities": ["cloud posture dashboard", "IAM policies", "S3 permissions", "VPC security groups", "encryption status", "misconfiguration alerts"],
        "relations": "S3 bucket policy allows public access to customer PII data, IAM role has overly permissive actions enabling lateral movement, and security groups allow unrestricted inbound RDP to Windows servers.",
        "caption": "Cloud security posture assessment showing IAM permission misconfigurations, public S3 bucket exposing sensitive data, and security group rule violations creating attackable exposure in AWS environment."
    },
    {
        "scene": "A physical security penetration test map showing building floor plan with badge reader locations, camera coverage zones, mantrap entry points, and security guard patrol routes marked.",
        "entities": ["floor plan", "badge readers", "camera zones", "mantrap", "guard patrol routes", "entry points"],
        "relations": "Camera zone 3 has blind spot allowing tailgating through side entrance, badge reader at door 7 has extendable pigtail cable enabling physical implant attack, and guard shift change creates 3-minute gap.",
        "caption": "Physical security assessment floor plan showing access control device placement, surveillance coverage gaps, and guard patrol timing creating exploitable windows for unauthorized facility access."
    },
    {
        "scene": "A malware infection chain showing initial spear-phishing email, malicious document macro execution, PowerShell Empire agent installation, and lateral movement to domain controller.",
        "entities": ["spear-phishing email", "malicious macro", "PowerShell Empire", "agent beacon", "lateral movement", "domain controller"],
        "relations": "Macro-enabled document triggers PowerShell downloader connecting to C2, Empire agent performs Kerberos reconnaissance, extracts credentials from LSASS, and passes-the-hash to reach domain controller.",
        "caption": "Malware infection kill chain from phishing delivery through macro execution, C2 agent installation, credential harvesting, and lateral movement to domain controller for enterprise compromise."
    },
    {
        "scene": "A DevSecOps pipeline showing code commit trigger, SAST scan gate, dependency vulnerability check, container image scan, DAST integration, and automated deployment approval workflow.",
        "entities": ["CI/CD pipeline", "SAST gate", "SCA scan", "container image scan", "DAST integration", "deployment approval", "policy engine"],
        "relations": "SAST gate blocks commit introducing SQL injection vulnerability, SCA flags vulnerable Log4j dependency at critical severity, and deployment is held pending security review before production release.",
        "caption": "DevSecOps pipeline security gates showing SAST blocking vulnerable code, SCA identifying critical dependency vulnerability, and container scan revealing base image CVE requiring remediation before deployment."
    },
    {
        "scene": "A biometric authentication system showing fingerprint sensor capturing minutiae points, iris scanner pattern matching, liveness detection algorithm processing, and enrollment database lookup.",
        "entities": ["fingerprint sensor", "minutiae extraction", "iris scanner", "liveness detection", "enrollment database", "authentication decision"],
        "relations": "Fingerprint match confirms identity with 98% confidence, liveness detection passes (blood flow detected), but iris pattern shows 73% match requiring fallback to PIN verification.",
        "caption": "Multimodal biometric authentication system showing fingerprint and iris capture, liveness detection algorithm processing for spoof prevention, and multi-factor fusion decision for identity verification."
    },
    {
        "scene": "An OT ICS SCADA network showing Purdue model分层 from field instruments through PLCs, SCADA servers, DMZ, and enterprise network with industrial protocol traffic analysis.",
        "entities": ["field instruments", "PLCs", "SCADA servers", "historian", "industrial DMZ", "enterprise network", "Modbus traffic"],
        "relations": "Field instrument traffic using Modbus/TCP passes through PLC to SCADA server, historian archives process data, and DMZ separates OT network from enterprise with unidirectional gateway.",
        "caption": "OT ICS SCADA network architecture following Purdue model showing Level 0-1 field devices and PLCs, Level 2-3 SCADA servers and control systems, and Level 4-5 enterprise integration through DMZ."
    },
    {
        "scene": "A ransomware incident showing encrypted file server screens displaying ransom notes, encrypted file extensions, restoration timeline estimate, and backup status showing clean offline backups available.",
        "entities": ["encrypted files", "ransom notes", "file extensions", "backup status", "restoration timeline", "encryption spread map"],
        "relations": "Ransomware encrypted files on 3 file servers including HR and Finance shares, backup status shows last clean backup was 6 hours ago, restoration estimated at 12 hours, ransom note demands 50 BTC.",
        "caption": "Ransomware incident response scene showing encryption scope across file servers, ransom note display with payment instructions, backup availability assessment, and estimated restoration timeline."
    },
    {
        "scene": "A threat intelligence platform showing IOC ingestion pipelines, structured threat report cards, MITRE ATT&CK heatmap of observed techniques, and threat actor profile comparison matrix.",
        "entities": ["threat intel platform", "IOC feeds", "threat report cards", "ATT&CK heatmap", "actor profiles", "TTP mapping"],
        "relations": "Newly ingested C2 domain correlates with APT29 infrastructure, ATT&CK heatmap shows heavy use of T1566 phishing and T1070 credential dumping, and TTPs match with 94% confidence to known actor profile.",
        "caption": "Threat intelligence platform showing IOC enrichment, APT29 attribution with MITRE ATT&CK technique mapping, actor profile correlation, and tactical threat report generation for analyst consumption."
    },
    {
        "scene": "A secure boot verification showing UEFI firmware measured boot, PCR quotes validation, TPM attestation report, and kernel module signature verification status for a running Linux system.",
        "entities": ["UEFI firmware", "measured boot", "TPM PCR quotes", "attestation report", "kernel module signatures", "dm-verity"],
        "relations": "UEFI PCR[0-7] values match expected reference hash, TPM attestation report signed by trusted CA, and all loaded kernel modules have valid signature chains from trusted keys.",
        "caption": "Secure boot verification showing measured boot attestation from UEFI through kernel load, TPM PCR quote validation confirming platform integrity, and kernel module signature verification chains."
    },
    {
        "scene": "A social engineering attack simulation showing a phone pretext script, target employee profile with information gathered from OSINT, call recording interface, and reporting template.",
        "entities": ["pretext script", "employee profile", "OSINT reconnaissance", "call interface", "information obtained", "attack report"],
        "relations": "Pretext calling IT help desk successfully elicits password reset procedure details using authoritative caller persona, recording employee badge number and security questions answered.",
        "caption": "Social engineering assessment showing pretext development targeting help desk personnel, OSINT-gathered employee context enabling convincing impersonation, and successful information elicitation for account takeover."
    },
    {
        "scene": "A hardware security module showing tamper-evident enclosure, secure key storage vault, cryptographic acceleration cards, console management interface, and key usage audit logs.",
        "entities": ["HSM enclosure", "key vault", "crypto accelerator", "console interface", "audit logs", "key lifecycle states"],
        "relations": "HSM generates and stores AES-256 key in tamper-evident vault, key usage requires dual control with quorum approval, all cryptographic operations logged with operator authentication.",
        "caption": "Hardware security module showing secure key generation and storage in tamper-responsive enclosure, cryptographic operation acceleration, dual-control key usage policy, and comprehensive audit logging."
    },
    {
        "scene": "A DDoS mitigation architecture showing ISP upstream traffic scrubbing, CDN edge cache serving static content, on-premise DDoS detection appliance, and rate limiting configuration for application layer attacks.",
        "entities": ["traffic scrubbing center", "CDN edge", "DDoS appliance", "rate limiting", "origin server protection", "attack traffic classification"],
        "relations": "Volumetric DDoS attack traffic diverted to ISP scrubbing center, legitimate traffic returned via GRE tunnel, application-layer HTTP flood handled by CDN rate limiting, origin servers remain protected.",
        "caption": "DDoS mitigation architecture showing multi-layer defense from ISP-level traffic scrubbing through CDN edge caching and on-premise behavioral detection, protecting origin infrastructure from attack traffic."
    },
    {
        "scene": "An Android mobile application security test showing APK decompilation to Smali code, certificate pinning verification test, insecure shared preferences storage analyst, and network traffic interception via proxy.",
        "entities": ["APK decompiler", "Smali code", "certificate pinning", "shared preferences", "network proxy", "runtime analysis"],
        "relations": "Decompiled APK reveals hardcoded AWS credentials in shared preferences, certificate pinning can be bypassed with custom SSL trust manager, and proxy interception exposes API keys in plaintext headers.",
        "caption": "Mobile application security assessment showing APK reverse engineering revealing credential storage weakness, certificate pinning bypass enabling traffic interception, and hardcoded secrets extraction."
    },
    {
        "scene": "A container orchestration security view showing Kubernetes namespace isolation, RBAC role bindings, network policy restrictions, Pod security standards enforcement, and admission controller webhook logging.",
        "entities": ["Kubernetes namespaces", "RBAC roles", "network policies", "Pod security standards", "admission controllers", "service account tokens"],
        "relations": "Namespace isolation enforced by network policies blocking cross-namespace traffic, RBAC grants minimal permissions to service accounts, Pod security standards prevent privileged container deployment.",
        "caption": "Kubernetes security configuration showing namespace segmentation through network policies, RBAC least-privilege role bindings, Pod security standards enforcement, and admission controller validation logging."
    },
    {
        "scene": "A binary exploitation lab showing a vulnerable buffer with memory layout diagram, stack canary placement, ASLR address space randomization visualization, and exploit development notes.",
        "entities": ["buffer overflow", "stack canary", "ASLR", "stack layout", "return address", "shellcode", "ROP gadgets"],
        "relations": "Vulnerable function copies user input to 64-byte buffer without bounds checking, stack canary is corrupted but partially leaked through format string, enabling precise return address overwrite with ROP chain.",
        "caption": "Binary exploitation analysis showing vulnerable stack buffer overflow with memory layout diagram, stack canary analysis enabling bypass, ASLR address space visualization, and ROP chain construction for exploit development."
    },
    {
        "scene": "A security awareness training session showing phishing simulation results dashboard with click rates by department, reporting rates, training module completion tracking, and simulated attack campaign timeline.",
        "entities": ["phishing dashboard", "click rates", "reporting rates", "training modules", "campaign timeline", "risk score"],
        "relations": "Finance department shows highest click rate at 34% vs company average of 12%, training completion lags in IT department, upcoming sophisticated campaign planned targeting executives.",
        "caption": "Security awareness training dashboard showing phishing simulation results broken down by department, training module completion rates, and risk scoring to prioritize follow-up awareness interventions."
    },
    {
        "scene": "A blockchain smart contract audit showing Solidity source code with vulnerability annotations, control flow analysis, and integer overflow detection alerts in a flagged transaction simulation.",
        "entities": ["Solidity code", "vulnerability annotations", "control flow graph", "integer overflow", "reentrancy vulnerability", "audit report"],
        "relations": "Reentrancy vulnerability in withdraw function allows draining contract by recursive callback, integer overflow in token transfer enables massive token creation, gas limit manipulation blocks withdrawal operations.",
        "caption": "Smart contract security audit showing Solidity source code with annotated vulnerability findings, reentrancy and integer overflow vulnerability demonstrations, and recommended fixes for secure contract development."
    },
    {
        "scene": "An Active Directory security assessment showing domain trust relationships, privilege escalation paths, Kerberoasting vulnerability, golden ticket attack path, and DCSync permission delegation map.",
        "entities": ["AD trust relationships", "Kerberoasting", "golden ticket", "DCSync", "privilege escalation paths", "ACL abuse"],
        "relations": "Service account with SPN is Kerberoastable due to weak password, domain user with valid SPN can request TGS and crack offline, domain admin privileges achieved through DCSync using compromised account.",
        "caption": "Active Directory security assessment showing Kerberoasting vulnerability enabling offline TGS cracking, privilege escalation to domain admin via DCSync replication rights abuse, and trust relationship attack paths."
    },
    {
        "scene": "A keylogger malware analysis showing keystroke logging mechanism, screenshot capture module, clipboard monitoring, and encrypted log exfiltration via DNS tunneling to external server.",
        "entities": ["keylogger module", "screenshot capture", "clipboard monitor", "encrypted log", "DNS tunneling", "C2 exfiltration"],
        "relations": "Keylogger hooks Windows GetMessageW API, captures all keystrokes with timestamps, screenshots every 30 seconds, encrypted logs exfiltrated via DNS TXT records to attacker-controlled domain.",
        "caption": "Keylogger malware behavioral analysis showing API hooking for keystroke capture, periodic screenshot acquisition, encrypted log assembly, and DNS tunneling exfiltration to command and control infrastructure."
    },
    {
        "scene": "A wireless security assessment showing WPA2 handshake capture in Wireshark, dictionary attack running against captured handshake, successful password recovery, and enterprise authentication via MSCHAPv2.",
        "entities": ["Wireshark handshake capture", "aircrack-ng", "dictionary attack", "PSK recovery", "MSCHAPv2", "PMKID"],
        "relations": "WPA2 4-way handshake captured in monitor mode, aircrack-ng successfully cracks weak PSK using rockyou wordlist, derived PMK enables decryption of historical traffic and network access.",
        "caption": "Wireless security assessment showing WPA2 handshake capture, offline dictionary attack successfully recovering pre-shared key, and subsequent network access enabling further penetration testing activities."
    },
    {
        "scene": "A WAF rule configuration showing SQL injection signature rules, XSS filter settings, virtual patching status for critical CVEs, rate limiting thresholds, and geo-blocking policy enforcement.",
        "entities": ["WAF rules", "SQL injection signatures", "XSS filters", "virtual patching", "rate limiting", "geo-blocking"],
        "relations": "SQL injection signatures block classic OR 1=1 patterns, virtual patch for CVE-2024-1234 blocks exploit attempts, rate limiting at 100 req/min per IP, geo-blocking enforced on Tor exit nodes and sanctioned countries.",
        "caption": "Web application firewall configuration showing SQL injection and XSS signature-based protection, virtual patching for critical vulnerabilities, rate limiting policy, and geographic access restrictions."
    },
    {
        "scene": "A log analysis session showing Splunk search interface with SPL queries, timestamp correlation of failed logins, successful authentication from new device, and privilege escalation event sequence reconstruction.",
        "entities": ["Splunk search", "SPL queries", "failed login correlation", "new device authentication", "privilege escalation", "event timeline"],
        "relations": "Failed logins across multiple accounts correlate with single source IP, followed by successful login from new device and country, immediately followed by admin role assignment to the compromised account.",
        "caption": "SIEM log analysis showing account takeover reconstruction from failed login enumeration through successful new-device authentication and privilege escalation, with correlated event timeline for incident investigation."
    },
    {
        "scene": "A steganography detection analysis showing original image comparison, LSB extraction showing hidden binary data, chi-square statistical analysis graph, and decoded hidden message output.",
        "entities": ["original image", "LSB extraction", "chi-square analysis", "hidden data", "carrier image", "steganographic tool artifacts"],
        "relations": "Chi-square analysis shows statistical anomaly in LSB distribution indicating hidden data, steghide tool metadata extracted, successfully decoded hidden text containing C2 instructions.",
        "caption": "Steganography detection analysis showing LSB manipulation detection through statistical analysis, steganographic tool artifact identification, and successful hidden message extraction from carrier image."
    },
    {
        "scene": "A vehicle CAN bus security test showing OBD-II device connected to diagnostic port, message injection device, CAN traffic capture displaying normal vs injected message IDs, and speedometer response to injected commands.",
        "entities": ["OBD-II device", "CAN bus analyzer", "message injection", "CAN traffic capture", "diagnostic commands", "safety system interactions"],
        "relations": "Normal CAN traffic shows legitimate ECU messages, injection device sends spoofed message ID for speedometer with higher priority, successfully overriding instrument cluster display without triggering safety systems.",
        "caption": "Vehicle CAN bus security assessment showing OBD-II diagnostic access, CAN traffic analysis identifying message priorities, and successful message injection demonstrating lack of authentication in automotive networks."
    },
    {
        "scene": "A privilege escalation enumeration showing terminal output of sudo -l, SUID binary list, crontab entries, kernel version, and exploit suggester tool recommendations for a Linux target system.",
        "entities": ["sudo -l enumeration", "SUID binaries", "crontab jobs", "kernel version", "exploit suggester", "GTFOBins"],
        "relations": "User can run vim with sudo, GTFOBins shows vim can spawn shell with sudo, kernel version 4.4.0 has known overlayfs privilege escalation exploit available for root.",
        "caption": "Linux privilege escalation enumeration showing misconfigured sudo permissions enabling GTFOBins attack, SUID binary abuse potential, scheduled task analysis, and kernel exploit suggester recommendations for root access."
    },
]

def call_qwen(prompt):
    proc = subprocess.Popen(
        [QWEN, "-p", SYSTEM, "--model", MODEL],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    stdout, stderr = proc.communicate(input=prompt, timeout=90)
    return stdout.strip()

done = 0
for i, scene_data in enumerate(SCENES):
    scene = scene_data["scene"]
    instruction = f"Generate a scene understanding entry for: {scene[:80]}..."
    prompt = (
        f"You are generating structured scene understanding data for security vision model training.\n\n"
        f"Given this scene description:\n{scene}\n\n"
        f"Verify and refine the following structured data, or generate it if the scene is novel:\n"
        f"- entities: {scene_data['entities']}\n"
        f"- relations: {scene_data['relations']}\n"
        f"- caption: {scene_data['caption']}\n\n"
        f"Write a 2-3 sentence refined caption that accurately describes this security scene in technical detail. "
        f"Focus on the most security-relevant aspects visible or inferable from the scene description."
    )
    print(f"[{i+1}/40] {scene[:60]}...", flush=True)
    try:
        output = call_qwen(prompt)
    except Exception as e:
        print(f"  ERROR: {e}", flush=True)
        output = scene_data["caption"]
    entry = {
        "scene": scene,
        "entities": scene_data["entities"],
        "relations": scene_data["relations"],
        "caption": output
    }
    with open(OUTPATH, "a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    done += 1

print(f"COMPLETE: {done}/40 -> {OUTPATH}", flush=True)
