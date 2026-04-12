#!/usr/bin/env python3
"""
Threat Intelligence Platform
EDUCATIONAL USE ONLY - Authorize before testing
"""

import requests
import json
import hashlib
from datetime import datetime, timedelta
from typing import List, Dict, Optional


class ThreatIntelPlatform:
    """Aggregates and analyzes threat intelligence from multiple sources."""

    def __init__(self, config: Dict):
        self.misp_url = config.get("misp_url", "")
        self.misp_key = config.get("misp_key", "")
        self.otx_key = config.get("otx_key", "")
        self.vt_key = config.get("vt_key", "")
        self.min_score = config.get("min_score", 50)
        self.indicators = []

    def fetch_misp_events(self, days: int = 7) -> List[Dict]:
        """Fetch recent events from MISP instance."""
        if not self.misp_key or not self.misp_url:
            print("[!] MISP not configured")
            return []

        headers = {"Authorization": self.misp_key, "Accept": "application/json"}
        date_from = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        params = {"date": date_from, "limit": 100}

        try:
            resp = requests.get(f"{self.misp_url}/events", headers=headers, params=params, timeout=15)
            if resp.status_code == 200:
                events = resp.json().get("response", [])
                print(f"[+] MISP: {len(events)} events fetched")
                return events
        except Exception as e:
            print(f"[!] MISP error: {e}")
        return []

    def fetch_otx_pulses(self, limit: int = 50) -> List[Dict]:
        """Fetch pulses from AlienVault OTX."""
        if not self.otx_key:
            print("[!] OTX not configured")
            return []

        headers = {"X-OTX-API-KEY": self.otx_key}
        try:
            resp = requests.get(f"https://otx.alienvault.com/api/v1/pulses/subscribed",
                               headers=headers, params={"limit": limit}, timeout=15)
            if resp.status_code == 200:
                pulses = resp.json().get("results", [])
                print(f"[+] OTX: {len(pulses)} pulses fetched")
                return pulses
        except Exception as e:
            print(f"[!] OTX error: {e}")
        return []

    def extract_iocs(self, source: str, data: List[Dict]) -> List[Dict]:
        """Extract IOCs from various threat intel formats."""
        iocs = []
        for item in data:
            if source == "misp":
                iocs.extend(self._extract_misp_iocs(item))
            elif source == "otx":
                iocs.extend(self._extract_otx_iocs(item))
        return iocs

    def _extract_misp_iocs(self, event: Dict) -> List[Dict]:
        """Extract IOCs from MISP event."""
        iocs = []
        for attr in event.get("Attribute", []):
            ioc = {
                "type": attr.get("type", ""),
                "value": attr.get("value", ""),
                "source": "MISP",
                "event_id": event.get("id", ""),
                "timestamp": attr.get("timestamp", ""),
                "tags": event.get("Tag", [])
            }
            iocs.append(ioc)
        return iocs

    def _extract_otx_iocs(self, pulse: Dict) -> List[Dict]:
        """Extract IOCs from OTX pulse."""
        iocs = []
        for indicator in pulse.get("indicators", []):
            ioc = {
                "type": indicator.get("type", ""),
                "value": indicator.get("indicator", ""),
                "source": "OTX",
                "pulse_name": pulse.get("name", ""),
                "tags": pulse.get("tags", []),
                "score": pulse.get("score", 0)
            }
            if ioc["score"] >= self.min_score:
                iocs.append(ioc)
        return iocs

    def enrich_ioc(self, ioc: Dict) -> Dict:
        """Enrich IOC with additional data (VirusTotal, etc.)."""
        if not self.vt_key:
            return ioc

        if ioc["type"] in ["ip-dst", "ip-src"]:
            try:
                resp = requests.get(
                    f"https://www.virustotal.com/api/v3/ip_addresses/{ioc['value']}",
                    headers={"x-apikey": self.vt_key}, timeout=10
                )
                if resp.status_code == 200:
                    data = resp.json().get("data", {})
                    attrs = data.get("attributes", {})
                    ioc["vt_stats"] = attrs.get("last_analysis_stats", {})
                    ioc["reputation"] = attrs.get("reputation", 0)
            except Exception:
                pass
        return ioc

    def map_to_mitre(self, ioc: Dict) -> List[str]:
        """Map IOC to MITRE ATT&CK techniques."""
        techniques = []
        ioc_type = ioc.get("type", "").lower()
        value = ioc.get("value", "").lower()

        mapping = {
            "domain": ["T1503", "T1568"],  # Domain generation, parking
            "ip-dst": ["T1104", "T1571"],   # C2, non-standard port
            "md5": ["T1105", "T1071"],       # Malware, C2
            "sha256": ["T1105", "T1071"],
            "url": ["T1102", "T1566"],       # Web service, phishing
            "email-src": ["T1566", "T1204"],  # Phishing, user action
        }

        for key, techniques_list in mapping.items():
            if key in ioc_type:
                techniques.extend(techniques_list)
        return list(set(techniques))

    def generate_report(self) -> str:
        """Generate threat intel summary report."""
        lines = ["=" * 60]
        lines.append("THREAT INTELLIGENCE REPORT")
        lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 60)

        type_counts = {}
        source_counts = {}
        for ioc in self.indicators:
            t = ioc.get("type", "unknown")
            s = ioc.get("source", "unknown")
            type_counts[t] = type_counts.get(t, 0) + 1
            source_counts[s] = source_counts.get(s, 0) + 1

        lines.append("\n## IOC Summary")
        lines.append(f"Total IOCs: {len(self.indicators)}")
        lines.append("\nBy Type:")
        for t, c in sorted(type_counts.items(), key=lambda x: -x[1]):
            lines.append(f"  {t}: {c}")
        lines.append("\nBy Source:")
        for s, c in sorted(source_counts.items(), key=lambda x: -x[1]):
            lines.append(f"  {s}: {c}")

        high_score = [i for i in self.indicators if i.get("score", 0) >= 75]
        if high_score:
            lines.append(f"\n## High Priority IOCs ({len(high_score)})")
            for ioc in high_score[:20]:
                lines.append(f"  [{ioc['type']}] {ioc['value']}")

        return "\n".join(lines)

    def run(self, sources: List[str] = None):
        """Run threat intel collection."""
        if sources is None:
            sources = ["misp", "otx"]

        print(f"[*] Threat Intel Platform starting...")

        if "misp" in sources:
            events = self.fetch_misp_events()
            self.indicators.extend(self.extract_iocs("misp", events))

        if "otx" in sources:
            pulses = self.fetch_otx_pulses()
            self.indicators.extend(self.extract_iocs("otx", pulses))

        print(f"[*] Total IOCs collected: {len(self.indicators)}")
        print(self.generate_report())


if __name__ == "__main__":
    CONFIG = {
        "misp_url": "",
        "misp_key": "",
        "otx_key": "",
        "vt_key": "",
        "min_score": 50
    }
    platform = ThreatIntelPlatform(CONFIG)
    platform.run()
