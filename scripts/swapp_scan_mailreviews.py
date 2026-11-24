"""Scanner mail reviews (Tom 2026-11-24): the spam and newsletter reviews that
used to run in the terminal (`scan review`) now live on SWapp's /scanner.

push_lists     send what waits (mail-spam-patrol report --json,
               mail-newsletter-review show --json) to SWapp
apply_answers  fetch Tom's answers, run mailroom-app's commands, report back

mailroom-app keeps every rule; this only moves lists up and answers down.
Nothing here deletes mail for good: confirmed spam stays in Spam.
"""

import json
import os
import re

MAILROOM = os.environ.get("SWAPP_MAILROOM_BIN") or os.path.expanduser("~/projects/mailroom-app/bin")
SPAM = os.path.join(MAILROOM, "mail-spam-patrol")
NEWSLETTER = os.path.join(MAILROOM, "mail-newsletter-review")
ADDRESS = re.compile(r"^[^\s,@]+@[^\s,@]+$")


def _last_line(text, fallback):
    lines = [line.strip() for line in (text or "").splitlines() if line.strip()]
    return (lines[-1] if lines else fallback)[:400]


def _list(run, command):
    code, out = run(command, timeout=180)
    if code != 0:
        return None
    try:
        data = json.loads(out)
    except ValueError:
        return None
    return data if isinstance(data, list) else None


def push_lists(swapp_url, token, api, run):
    """Returns {"spam": n, "newsletter": n} waiting, None for a list that could
    not be read (SWapp leaves that list as it was)."""
    lists = {"spam": _list(run, [SPAM, "report", "--json"]),
             "newsletter": _list(run, [NEWSLETTER, "show", "--json"])}
    body = {key: value for key, value in lists.items() if value is not None}
    if body:
        status, _ = api(swapp_url + "/api/scan/reviews", token, "POST", body={"lists": body})
        if status != 200:
            return {key: None for key in lists}
    return {key: (len(value) if value is not None else None) for key, value in lists.items()}


def plan(items):
    """Group answers into mailroom-app commands: [(command, [ids])].
    Rows with a malformed key are refused (never passed to a command)."""
    commands, refused = [], []
    groups = {}
    for item in items:
        key, answer = str(item.get("itemKey") or ""), item.get("answer")
        review = item.get("review")
        if review == "spam" and answer in ("spam", "not-spam") and key.isdigit():
            groups.setdefault(answer, []).append(item)
        elif review == "newsletter" and answer in ("keep", "clear") and ADDRESS.match(key):
            groups.setdefault(answer, []).append(item)
        elif review == "newsletter-undo" and answer == "undo":
            groups.setdefault("undo", []).append(item)
        else:
            refused.append(item)
    if groups.get("not-spam"):
        rows = groups["not-spam"]
        commands.append(([SPAM, "restore"] + [r["itemKey"] for r in rows], rows))
    if groups.get("spam"):
        rows = groups["spam"]
        commands.append(([SPAM, "confirm"] + [r["itemKey"] for r in rows], rows))
    keep, clear = groups.get("keep", []), groups.get("clear", [])
    if keep or clear:
        commands.append(([NEWSLETTER, "decide",
                          "--keep", ",".join(r["itemKey"] for r in keep),
                          "--clear", ",".join(r["itemKey"] for r in clear), "--yes"], keep + clear))
    if groups.get("undo"):
        # Undo runs after any new clears, and once however many were asked.
        commands.append(([NEWSLETTER, "undo"], groups["undo"]))
    return commands, refused


def apply_answers(swapp_url, token, api, run):
    """Apply Tom's waiting answers. Returns how many rows were handled."""
    status, data = api(swapp_url + "/api/scan/reviews", token)
    items = data.get("items") if status == 200 and isinstance(data, dict) else None
    if not items:
        return 0
    commands, refused = plan(items)
    results = [{"id": r["id"], "ok": False, "result": "Answer not understood; nothing done."} for r in refused]
    for command, rows in commands:
        code, out = run(command, timeout=600)
        note = _last_line(out, "exit %d" % code)
        print("mail review: %s -> exit %d: %s" % (" ".join(command[:2]), code, note), flush=True)
        results.extend({"id": r["id"], "ok": code == 0, "result": note} for r in rows)
    api(swapp_url + "/api/scan/reviews/applied", token, "POST", body={"results": results})
    push_lists(swapp_url, token, api, run)
    return len(results)
