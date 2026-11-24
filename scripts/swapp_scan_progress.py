"""Publish real source activity to the active scan, without exposing account data."""
import json
import os
from pathlib import Path
import urllib.request


def publish(stage, counts):
    run_id = os.environ.get("SWAPP_SCAN_RUN_ID")
    source = os.environ.get("SWAPP_SCAN_PROGRESS_SOURCE")
    if not run_id or source not in ("quo-sms", "quo-calls", "quo-voicemail"):
        return
    try:
        config = Path(os.environ.get("SWAPP_SCAN_CONFIG") or str(Path.home()/".config/swapp-scan/env"))
        values = dict(line.strip().split("=", 1) for line in config.read_text().splitlines()
                      if line.strip() and not line.startswith("#") and "=" in line)
        progress = {key: counts[key] for key in ("reviewed", "total", "remaining")}
        progress["stage"] = stage
        payload = {"runId": run_id, "source": source, "status": "scanning",
                   "detail": stage, "progress": progress}
        request = urllib.request.Request(values["SWAPP_URL"].rstrip("/") + "/api/scan/progress",
            data=json.dumps(payload).encode(), method="POST",
            headers={"Authorization": "Bearer " + values["SCAN_STATUS_TOKEN"], "Content-Type": "application/json"})
        with urllib.request.urlopen(request, timeout=5):
            pass
    except (OSError, KeyError, ValueError):
        # Progress delivery cannot stop the intake. The next event retries.
        pass
