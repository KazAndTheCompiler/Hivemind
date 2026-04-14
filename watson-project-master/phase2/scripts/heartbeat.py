#!/usr/bin/env python3
"""Step 2.1: Zoe Heartbeat Emitter with Qwen analysis
Qwen (free tier 3.6, 1M context) provides advisory on each heartbeat."""

import os, sys, json, subprocess, datetime, shutil
from pathlib import Path

WATSON_DIR = Path("/home/openclaw/.openclaw/workspace/watson")
PALACE_DIR = Path.home() / "watson-palace"
PHASE2_DIR = WATSON_DIR / "phase2"
EMISSIONS_DIR = PHASE2_DIR / "emissions"
LOG_FILE = PHASE2_DIR / "logs" / "emitter.log"

EMISSIONS_DIR.mkdir(parents=True, exist_ok=True)
(PHASE2_DIR / "logs").mkdir(parents=True, exist_ok=True)

QWEN_MODEL = "qwen-3.6"

def log(msg):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")

def run(cmd):
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return result.stdout.strip(), result.returncode

def get_qwen_insight(prompt: str, timeout: int = 30) -> str:
    """Query Qwen free tier 3.6 for analysis."""
    result = subprocess.run(
        ["qwen", "-p", prompt, "--model", QWEN_MODEL],
        capture_output=True, text=True, timeout=timeout
    )
    if result.returncode == 0 and result.stdout.strip():
        return result.stdout.strip()
    return f"[Qwen unavailable, exit: {result.returncode}]"

log("Gathering Zoe status...")

# Git status for key repos
repos = {
    "secdev_project": Path.home() / "secdev_project",
    "watson-project": Path.home() / "watson-project",
    "watson": WATSON_DIR,
}

repo_status = {}
for name, path in repos.items():
    git_dir = path / ".git"
    if git_dir.exists():
        branch, _ = run(f"cd {path} && git rev-parse --abbrev-ref HEAD")
        ahead, _ = run(f"cd {path} && git rev-list --count @{{u}}..HEAD")
        behind, _ = run(f"cd {path} && git rev-list HEAD..@{{u}} --count")
        changes, _ = run(f"cd {path} && git status --porcelain | wc -l")
        repo_status[name] = {
            "branch": branch or "unknown",
            "ahead": int(ahead or 0),
            "behind": int(behind or 0),
            "changes": int(changes or 0),
        }

# Memory files
memory_files, _ = run("find /home/openclaw/.openclaw/workspace/memory -name '*.md' 2>/dev/null | wc -l")

# Sessions
session_count, _ = run("find /home/openclaw/.openclaw/sessions -name '*.jsonl' 2>/dev/null | wc -l")

# System
load_avg, _ = run("uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | tr -d ','")
disk_usage, _ = run("df -h / | tail -1 | awk '{print $5}' | tr -d '%'")
memory_pct, _ = run("free -m | awk '/Mem:/ {printf \"%.0f\", $3/$2*100}'")

# Findings
findings = []
if int(memory_files or 0) < 1:
    findings.append({"id": "Z01", "severity": "medium", "area": "memory",
                     "title": "No memory files found", "action": "Initialize memory system"})
if int(session_count or 0) > 50:
    findings.append({"id": "Z02", "severity": "low", "area": "sessions",
                     "title": "Many sessions accumulated", "action": "Consider session cleanup"})

# Build emission
timestamp = datetime.datetime.now().isoformat()
task_id = f"zoe-heartbeat-{datetime.datetime.now().strftime('%Y%m%d-%H%M')}"
repo_names = ", ".join(repo_status.keys())

emission = {
    "version": "1.0",
    "emitter": "zoe",
    "timestamp": timestamp,
    "task_id": task_id,
    "status": "done",
    "summary": f"Zoe heartbeat. Repos: {repo_names}, Memory files: {memory_files}, Sessions: {session_count}",
    "findings": findings,
    "next_actions": [],
    "confidence": 0.95,
    "system": {
        "load_avg": load_avg,
        "disk_usage_pct": disk_usage,
        "memory_pct": memory_pct,
        "repo_status": repo_status,
    }
}

# Write initial emission
emission_file = EMISSIONS_DIR / f"{task_id}.json"
with open(emission_file, "w") as f:
    json.dump(emission, f, indent=2)

log(f"Emission built for task {task_id}")

# Copy to palace wing events
wing_events = PALACE_DIR / "wings" / "zoe" / "hall_events"
wing_events.mkdir(parents=True, exist_ok=True)
dest = wing_events / f"{task_id}.json"
shutil.copy2(emission_file, dest)
log(f"Written to palace at {dest}")

# ── Qwen Analysis ─────────────────────────────────────────────────
log("Querying Qwen (3.6, 1M context) for advisory...")
qwen_prompt = (
    f"Zoe heartbeat summary: {emission['summary']}\n"
    f"System: load={load_avg}, disk={disk_usage}%, mem={memory_pct}%\n"
    f"Findings: {json.dumps(findings) if findings else 'none'}\n"
    f"Repo changes: {sum(r.get('changes',0) for r in repo_status.values())}\n\n"
    f"What should Zoe prioritize? Reply in 1-3 sentences, be direct."
)
qwen_insight = get_qwen_insight(qwen_prompt, timeout=30)
emission["qwen_insight"] = qwen_insight
log(f"Qwen: {qwen_insight[:120]}")

# Rewrite with Qwen insight
with open(dest, "w") as f:
    json.dump(emission, f, indent=2)
with open(emission_file, "w") as f:
    json.dump(emission, f, indent=2)
log(f"Emission updated with Qwen insight")

# ── Guard Validation ─────────────────────────────────────────────
guard_script = WATSON_DIR / "watson.sh"
if guard_script.exists():
    log("Running guard validation...")
    result = subprocess.run(["node", str(guard_script), "validate", str(emission_file)],
                          capture_output=True, text=True)
    if result.returncode == 0:
        log("Guard validation passed")
    else:
        log(f"Guard returned {result.returncode} - continuing")

# ── MemPalace Index ──────────────────────────────────────────────
try:
    venv_python = Path.home() / ".watson-venv" / "bin" / "python"
    subprocess.run([str(venv_python), "-m", "mempalace", "mine", str(emission_file),
                    "--agent", "zoe", "--hall", "events"],
                   capture_output=True, timeout=10)
    log("Indexed to MemPalace")
except Exception as e:
    log(f"MemPalace index: {e}")

log("Heartbeat complete.")
print(f"Emission: {dest}")
print(f"Qwen: {qwen_insight}")