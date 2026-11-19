#!/usr/bin/env python3
"""Work out each Reports client's month status from Double, for the Reports page.

Runs hourly on ripley (swapp-report-status.timer). Reads Double's API read-only with the
practice credentials in ~/.config/bookbot/double.json, and writes
~/.local/share/swapp-phone-intake/report-status.json: {folder: {status, month, close, progress}}.

The month that counts is last month. Tom's internal target (2026-11-17): it is closed and its
report issued within the first five business days. Statuses, in order:
  done      last month's close is done in Double and its report PDF is saved in Reports
  waiting   Sol has flagged the client in report-waiting.json (Double's API has no client questions)
  on-track  today is within the first five business days
  late      past the fifth business day and not done
The page shows 'No report yet' (grey) for a client with no saved reports at all.
"""

import datetime as dt
import json
import os
import re
import sys
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import phone_intake  # noqa: E402  (same folder: reports root and names)

API = "https://api.doublehq.com"
CREDENTIALS = os.path.expanduser(os.environ.get("BOOKBOT_DOUBLE_JSON", "~/.config/bookbot/double.json"))
OUT = os.path.expanduser(os.environ.get("REPORT_STATUS_FILE", "~/.local/share/swapp-phone-intake/report-status.json"))
WAITING = os.path.expanduser(os.environ.get("REPORT_WAITING_FILE", "~/.config/swapp-phone-intake/report-waiting.json"))


def fifth_business_day(year, month):
    """The fifth weekday of the month (holidays are not counted out)."""
    day, seen = dt.date(year, month, 1), 0
    while True:
        if day.weekday() < 5:
            seen += 1
            if seen == 5:
                return day
        day += dt.timedelta(days=1)


def due_month(today):
    """Last month, as (year, month)."""
    first = today.replace(day=1)
    last = first - dt.timedelta(days=1)
    return last.year, last.month


def key(name):
    """Compare names loosely: 'RODAN PROPERTIES, LLC' == 'Rodan Properties LLC'."""
    return re.sub(r"[^a-z0-9]", "", (name or "").lower())


def decide(today, close, report_saved, waiting):
    """One client's status for the due month."""
    if close and close.get("status") == "done" and report_saved:
        return "done"
    if waiting:
        return "waiting"
    if not close:
        # No close for the due month in Double: we are still bringing older months up to date.
        return "catching-up"
    year, month = today.year, today.month
    if today <= fifth_business_day(year, month):
        return "on-track"
    return "late"


def close_detail(closes, close, bearer):
    """The practical why from Double: months still open, last month closed, this close's tasks, and the
    note we wrote the client (executive summary). Double's public API has no client-questions endpoint."""
    months = sorted(c.get("yearMonth") for c in closes if c.get("yearMonth"))
    open_months = [m for m in months if next(c for c in closes if c.get("yearMonth") == m).get("status") != "done"]
    done = [m for m in months if m not in open_months]
    note = ""
    for c in sorted(closes, key=lambda c: c.get("yearMonth") or "", reverse=True):
        summary = ((c.get("managementNotes") or {}).get("executiveSummary") or "")
        text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", summary)).strip()
        if text:
            note = text[:400]
            break
    out = {"openMonths": open_months, "lastClosed": done[-1] if done else None, "note": note}
    if close:
        tasks = double_get("/api/tasks/", {"endCloseId": close["id"], "limit": 200}, bearer)
        out["tasksDone"] = sum(1 for t in tasks if t.get("status") == "done")
        out["tasksTotal"] = len(tasks)
        out["toReconcile"] = [t.get("name") for t in tasks
                              if t.get("type") == "accountReconcilation" and t.get("status") != "done"]
    return out


def double_get(path, params, bearer):
    url = "%s%s?%s" % (API, path, urllib.parse.urlencode(params))
    request = urllib.request.Request(url, headers={"Authorization": "Bearer " + bearer, "User-Agent": "swapp-report-status/1"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode())


def token():
    with open(CREDENTIALS, encoding="utf-8") as handle:
        stored = json.load(handle)
    body = urllib.parse.urlencode({"grant_type": "client_credentials", "client_id": stored["clientId"],
                                   "client_secret": stored["clientSecret"]}).encode()
    request = urllib.request.Request(API + "/oauth/token", data=body, method="POST",
                                     headers={"Content-Type": "application/x-www-form-urlencoded", "User-Agent": "swapp-report-status/1"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode())["access_token"]


def main():
    today = dt.date.today()
    year, month = due_month(today)
    ym = "%04d%02d" % (year, month)
    names = phone_intake.read_json(phone_intake.REPORT_NAMES, {}) or {}
    waiting = phone_intake.read_json(WAITING, {}) or {}
    bearer = token()
    clients = double_get("/api/clients", {"status": "active", "limit": 100}, bearer)
    by_key = {key(c.get("name")): c for c in clients}
    out = {}
    for folder, name in names.items():
        client = by_key.get(key(name))
        close, detail = None, {}
        if client:
            closes = double_get("/api/clients/%d/end-closes" % client["id"], {"limit": 24}, bearer)
            close = next((c for c in closes if c.get("yearMonth") == ym), None)
            detail = close_detail(closes, close, bearer)
        saved = os.path.isfile(os.path.join(phone_intake.REPORTS_ROOT, folder, "reports", "%04d" % year, "%04d-%02d.pdf" % (year, month)))
        out[folder] = {"status": decide(today, close, saved, bool(waiting.get(folder))),
                       "month": "%04d-%02d" % (year, month),
                       "close": (close or {}).get("status"), "progress": (close or {}).get("progress"),
                       "due": fifth_business_day(today.year, today.month).isoformat(),
                       "saved": saved,
                       "waiting": waiting.get(folder) if isinstance(waiting.get(folder), str) else None,
                       "doubleClient": bool(client), **detail}
    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump({"updated": dt.datetime.now().isoformat(timespec="seconds"), "clients": out}, handle)
    os.replace(tmp, OUT)
    print(json.dumps({f: v["status"] for f, v in out.items()}))


if __name__ == "__main__":
    main()
