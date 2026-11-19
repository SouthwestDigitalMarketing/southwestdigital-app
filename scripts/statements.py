#!/usr/bin/env python3
"""Which bank and card statements each client owes, and which months have arrived.

Tom, 2026-11-18: the Reports page should show the statements a client must send every month to
finish the close, so he can see what is missing and which part of a report may be off.

- Owed: the reconciliation tasks in the client's Double close that carry an account number
  ("*8039 WFB Chk"); their last 4 digits identify the account.
- Arrived: every PDF under the client's folder (bank/, cc/, the Double upload inbox ...) is read
  with pdftotext; a statement is a file with a statement period and that account's last 4 digits.
  File names are ignored: clients upload "aug 26 biz.pdf".
- A month is covered when a statement for the account spans the month's last day (5 days slack for
  cycles that end early). An account whose statements run about 3 months is quarterly; a month whose
  statement is not out yet reads "not issued yet" instead of missing.

Reads are cached by path, size and mtime, so the hourly run only opens new files.
"""

import datetime as dt
import json
import os
import re
import subprocess

CACHE = os.path.expanduser(os.environ.get("REPORT_STATEMENT_CACHE", "~/.cache/swapp-reports/statements.json"))
MONTHS = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}
PERIOD_LINE = re.compile(r"statement period|period covered|for the period|statement dates?|statement closing|"
                         r"opening/closing date|beginning balance on|billing cycle", re.I)


def last4(name):
    """'*8039 WFB Chk' -> '8039'; names without a 4-digit account number are not statement accounts."""
    found = re.findall(r"(?<!\d)(\d{4})(?!\d)", name or "")
    return found[-1] if found else None  # 'SAMS BIZ 0589 8569 6263': the last group ends the card number


def _dates(line):
    out = []
    for m in re.finditer(r"\b(\d{1,2})/(\d{1,2})/(\d{2,4})\b", line):
        month, day, year = map(int, m.groups())
        year += 2000 if year < 100 else 0
        try:
            out.append(dt.date(year, month, day))
        except ValueError:
            pass
    for m in re.finditer(r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})", line, re.I):
        try:
            out.append(dt.date(int(m.group(3)), MONTHS[m.group(1).lower()], int(m.group(2))))
        except ValueError:
            pass
    return out


RANGE = re.compile(r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\s*(?:-|to|through)\s*"
                   r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})", re.I)


def period(text):
    """(start, end) from the statement's period line, or None."""
    # Bank of America checking: "Beginning balance on January 10, 2023" ... "Ending balance on January 31, 2023".
    begin = re.search(r"beginning balance on\s+([a-z]+\.?\s+\d{1,2},?\s+\d{4})", text, re.I)
    end = re.search(r"ending balance on\s+([a-z]+\.?\s+\d{1,2},?\s+\d{4})", text, re.I)
    if begin and end and _dates(begin.group(1)) and _dates(end.group(1)):
        return _dates(begin.group(1))[0], _dates(end.group(1))[0]
    # A bare full date range near the top: "June 07, 2026 - July 06, 2026" (card statements).
    for line in text.splitlines()[:40]:
        m = RANGE.search(line)
        if m:
            try:
                return (dt.date(int(m.group(3)), MONTHS[m.group(1)[:3].lower()], int(m.group(2))),
                        dt.date(int(m.group(6)), MONTHS[m.group(4)[:3].lower()], int(m.group(5))))
            except ValueError:
                pass
    for line in text.splitlines():
        if not PERIOD_LINE.search(line):
            continue
        found = _dates(line)
        if len(found) >= 2:
            return min(found), max(found)
        # "October 01 - October 31, 2026": the year only follows the second date.
        m = re.search(r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\s*(?:-|to|through)\s*"
                      r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})", line, re.I)
        if m:
            year = int(m.group(5))
            start_month, end_month = MONTHS[m.group(1)[:3].lower()], MONTHS[m.group(3)[:3].lower()]
            try:
                return dt.date(year - (start_month > end_month), start_month, int(m.group(2))), dt.date(year, end_month, int(m.group(4)))
            except ValueError:
                pass
    return None


def tails(text):
    """Last 4 digits of every account-like number on the page: long digit runs and masked ones (XXXX8039, *8039)."""
    out = {m.group(1)[-4:] for m in re.finditer(r"(?<!\d)(\d{6,17})(?!\d)", text)}
    out |= {m.group(1) for m in re.finditer(r"(?:[xX*•…]{2,}|ending in|ending|acct\.?|account)\s*#?\s*(\d{4})(?!\d)", text)}
    return sorted(out)


def from_name(path):
    """Statements Sol has filed: '.../x8039 WF Chk/x8039 WF Chk 2026_07_31.pdf' (month ending) or
    '... 2026_Q1.pdf' (quarter). Account digits from the file or folder name."""
    name = os.path.basename(path)
    # Account digits come from the name with its date taken out, else from the folder.
    undated = re.sub(r"(20\d\d)[_-](\d{2}[_-]\d{2}|Q[1-4])", " ", name, flags=re.I)
    digits = last4(undated) or last4(os.path.basename(os.path.dirname(path)))
    if not digits:
        return None
    m = re.search(r"(20\d\d)[_-](\d{2})[_-](\d{2})\.pdf$", name, re.I)
    if m:
        try:
            end = dt.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            return None
        return {"start": (end - dt.timedelta(days=27)).replace(day=1).isoformat() if end.day >= 28 else (end - dt.timedelta(days=30)).isoformat(),
                "end": end.isoformat(), "tails": [digits]}
    m = re.search(r"(20\d\d)[_-]Q([1-4])\.pdf$", name, re.I)
    if m:
        year, quarter = int(m.group(1)), int(m.group(2))
        return {"start": dt.date(year, quarter * 3 - 2, 1).isoformat(), "end": month_end(year, quarter * 3).isoformat(), "tails": [digits]}
    return None


def read_pdf(path):
    named = from_name(path)
    if named:
        return named
    try:
        text = subprocess.run(["pdftotext", "-layout", "-l", "2", path, "-"], capture_output=True, text=True, timeout=60).stdout
    except (OSError, subprocess.SubprocessError):
        return None
    found = period(text)
    if not found:
        return None
    return {"start": found[0].isoformat(), "end": found[1].isoformat(), "tails": tails(text)}


def scan(folder, cache):
    """Every statement under a client folder: [{start, end, tails, file, received}], cached by path/size/mtime."""
    out = []
    for base, dirs, files in os.walk(folder):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d != "reports"]
        for name in files:
            if not name.lower().endswith(".pdf"):
                continue
            path = os.path.join(base, name)
            try:
                stat = os.stat(path)
            except OSError:
                continue
            key = "%s|%d|%d" % (path, stat.st_size, int(stat.st_mtime))
            if key not in cache:
                cache[key] = read_pdf(path)
            if cache[key]:
                out.append(dict(cache[key], file=os.path.relpath(path, folder),
                                received=dt.date.fromtimestamp(stat.st_mtime).isoformat()))
    return out


def month_end(year, month):
    return (dt.date(year + month // 12, month % 12 + 1, 1) - dt.timedelta(days=1))


OVERRIDES = os.path.expanduser(os.environ.get("REPORT_STATEMENT_OVERRIDES", "~/.config/swapp-phone-intake/report-statements.json"))
# Double keeps reconciliation tasks for accounts that no longer send statements.
DEAD = re.compile(r"\(deleted\)|inactive|\bold\b|\btbd\b|transfer from", re.I)


def owed_accounts(folder, names):
    """The accounts a client owes statements for: Double's reconciliation tasks with an account number,
    minus dead ones, adjusted by report-statements.json {"<folder>": {"skip": ["4333"], "add": ["x1234 Chase"]}}."""
    try:
        with open(OVERRIDES, encoding="utf-8") as handle:
            override = (json.load(handle) or {}).get(folder) or {}
    except (OSError, ValueError):
        override = {}
    skip = set(override.get("skip") or [])
    picked, seen = [], set()
    for name in list(names) + list(override.get("add") or []):
        digits = last4(name)
        if not digits or digits in skip or digits in seen or DEAD.search(name or ""):
            continue
        seen.add(digits)
        picked.append(name)
    return picked


def owed(accounts, statements, months, today):
    """For each owed account: cadence and, per month 'YYYY-MM', the date its statement arrived, or
    'missing' / 'not issued yet' / 'none on file' (no statement for this account read in the window:
    never sent, or a scan we cannot read)."""
    result = []
    for name in accounts:
        digits = last4(name)
        mine = [s for s in statements if digits in s["tails"]]
        spans = sorted({(s["start"], s["end"]) for s in mine})
        lengths = sorted((dt.date.fromisoformat(e) - dt.date.fromisoformat(b)).days for b, e in spans)
        quarterly = bool(lengths) and lengths[len(lengths) // 2] >= 80
        by_month = {}
        for year, month in months:
            last_day = month_end(year, month)
            covering = [s for s in mine
                        if dt.date.fromisoformat(s["start"]) <= last_day <= dt.date.fromisoformat(s["end"]) + dt.timedelta(days=5)
                        or s["end"][:7] == "%04d-%02d" % (year, month)]
            if covering:
                by_month["%04d-%02d" % (year, month)] = min(s["received"] for s in covering)
                continue
            cycle_end = month_end(year, ((month - 1) // 3) * 3 + 3) if quarterly else last_day
            by_month["%04d-%02d" % (year, month)] = "not issued yet" if today <= cycle_end + dt.timedelta(days=10) else "missing"
        if not any(v not in ("missing", "not issued yet") for v in by_month.values()):
            by_month = {k: ("none on file" if v == "missing" else v) for k, v in by_month.items()}
        result.append({"name": name, "last4": digits, "cadence": "quarterly" if quarterly else "monthly", "months": by_month})
    return result


def load_cache():
    try:
        with open(CACHE, encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, ValueError):
        return {}


def save_cache(cache):
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    tmp = CACHE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(cache, handle)
    os.replace(tmp, CACHE)
