#!/usr/bin/env python3
"""Pull SWapp's locked $10K Month storyboard to ripley for Showrunner autopilot.

Uses the same SWAPP_URL, SHOWRUNNER_BRAND and SHOWRUNNER_STATUS_TOKEN as
push_video_status.py. Print only a status; the storyboard stays in the output file.
"""

import json
import os
from pathlib import Path
import tempfile
import urllib.parse
import urllib.request


def pull(url, token, brand):
    target = url.rstrip("/") + "/api/showrunner/studio/locked?" + urllib.parse.urlencode({"brand": brand})
    request = urllib.request.Request(target, headers={"Authorization": "Bearer " + token,
                                                      "User-Agent": "swapp-showrunner-pull/1"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)


def save_atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=".storyboard-", dir=path.parent)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as output:
            json.dump(data, output, indent=2)
            output.write("\n")
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def main():
    data = pull(os.environ["SWAPP_URL"], os.environ["SHOWRUNNER_STATUS_TOKEN"],
                os.environ["SHOWRUNNER_BRAND"])
    output = Path(os.environ.get("SHOWRUNNER_STORYBOARD_FILE",
                                 str(Path.home() / ".local/share/showrunner/locked-storyboard.json")))
    save_atomic(output, data)
    print("locked storyboard: " + ("ready" if data.get("episode") else "none"))


if __name__ == "__main__":
    main()
