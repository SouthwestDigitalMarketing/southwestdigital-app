#!/usr/bin/env python3
"""Push ripley's phone-batch status to SWapp, so the Showrunner page shows every video.

Reads what the send page shows (phone_intake.queue_status: sending batches plus
Showrunner's queue.json with steps, render bars and YouTube links) and POSTs it to
SWapp's /api/showrunner/video-status every 10 seconds when it changed, and at
least every 5 minutes. SWapp on Vercel cannot reach ripley, so ripley reports.

Config, ~/.config/swapp-video-status/env (mode 600):
  SWAPP_URL=https://app.bookkeepingconroe.com
  SHOWRUNNER_STATUS_TOKEN=<same value as SWapp's env>
  SHOWRUNNER_BRAND=<brand slug>
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import phone_intake  # noqa: E402  (same folder: the receiver's own status merge)


def sending_stage(row):
    """'Sending 3 of 8 — 42%' for a batch still coming from the phone."""
    if row.get("state") not in ("sending", "paused", "received", "incomplete"):
        return None
    pct = int(100 * row.get("done", 0) / row["bytes"]) if row.get("bytes") else 0
    words = {"sending": "Sending", "paused": "Paused", "received": "All arrived. Making the episode", "incomplete": "Some files did not arrive"}
    base = words[row["state"]]
    if row["state"] in ("sending", "paused"):
        return "%s %d of %d — %d%%" % (base, min(row.get("received", 0) + 1, row.get("expected", 1)), row.get("expected", 1), pct)
    return base


def payload(brand):
    videos = []
    for row in phone_intake.queue_status(phone_intake.INBOX)["videos"]:
        row = dict(row)
        row.pop("files", None)
        if not row.get("stage"):
            row["stage"] = sending_stage(row)
        videos.append(row)
    return {"brand": brand, "videos": videos}


def push(url, token, body):
    request = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                     headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.status


def main():
    url = os.environ["SWAPP_URL"].rstrip("/") + "/api/showrunner/video-status"
    token = os.environ["SHOWRUNNER_STATUS_TOKEN"]
    brand = os.environ["SHOWRUNNER_BRAND"]
    last, last_sent = None, 0.0
    while True:
        try:
            body = payload(brand)
            text = json.dumps(body, sort_keys=True)
            if text != last or time.time() - last_sent > 300:
                status = push(url, token, body)
                last, last_sent = text, time.time()
                print("pushed %d videos (HTTP %d)" % (len(body["videos"]), status), flush=True)
        except urllib.error.HTTPError as error:
            print("SWapp refused the push: HTTP %d %s" % (error.code, error.read()[:200]), flush=True)
        except Exception as error:  # keep going: SWapp or the network may be down for a moment
            print("push failed: %s" % error, flush=True)
        if "--once" in sys.argv:
            return
        time.sleep(10)


if __name__ == "__main__":
    main()
