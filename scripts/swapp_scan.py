#!/usr/bin/env python3
"""SWapp header Scan button, ripley side (sop-money-playbook).

Tom presses Scan (or the 15-minute auto run fires) and SWapp records a
"scan requested" row. This poller runs on ripley every minute: it claims the
run, gathers what changed, and pushes the findings back to SWapp, which
creates the leads and closes the run. SWapp on Vercel cannot reach ripley,
so ripley reports — the same pattern as scripts/push_video_status.py.

Sources (v1): Quo texts/calls/voicemails, Zoho mail (forms + signed hints),
SWapp itself and GA4 (both computed server-side when the run closes).

Config, ~/.config/swapp-scan/env (mode 600):
  SWAPP_URL=https://admin.southwestdigital.io   (local demo: http://100.98.89.93:3101)
  SCAN_STATUS_TOKEN=<same value as SWapp's env>

State, ~/.local/share/swapp-scan/state.json: seen message ids per source.
Reads only: never sends texts or emails (nothing outbound, per the brief).
"""

import json
import os
import re
import sqlite3
import datetime
import subprocess
import sys
import time
import urllib.error
import urllib.request

from swapp_scan_review import run_reviews
from swapp_quo_intake import execute as quo_intake

CONFIG = os.environ.get("SWAPP_SCAN_CONFIG") or os.path.expanduser("~/.config/swapp-scan/env")
STATE = os.environ.get("SWAPP_SCAN_STATE") or os.path.expanduser("~/.local/share/swapp-scan/state.json")
SALES_DB = os.path.expanduser("~/.local/share/lochside-sales/sales.db")
AUTO_MINUTES = 15
RECENT_DAYS = 7

FORM_SUBJECT = re.compile(r"new form submission from (\S+)", re.I)
FORM_DOMAIN_BRAND = {
    "realestatebookkeeper.com": "real-estate-bookkeeper",
    "bookkeepingconroe.com": "bookkeeping-conroe",
}
SIGNED_WORDS = re.compile(r"sign|docusign|execut|countersign|sent\s+(it\s+)?back|\bdone\b", re.I)
AGREEMENT_WORDS = re.compile(r"sign|gsa|agreement|contract|paperwork|docusign|proposal|quote|engagement|done", re.I)
SKIP_SENDERS = re.compile(
    r"mailer-daemon|noreply|no-reply|calendar|dun\s*&\s*bradstreet|quickbooks|appleid|dataforseo|"
    r"localboard|hotfrog|doublehq|zoho",
    re.I,
)
SKIP_EMAILS = re.compile(r"@example\.com$|@test\.|test@", re.I)
# Our own addresses never become leads (Tom testing the website form, etc.).
OWN_EMAILS = {
    "thomas@bookkeepingconroe.com",
    "hello@bookkeepingconroe.com",
    "tmacdonald7@gmail.com",
}
# System texts, not people: 2FA codes and the like.
SKIP_SMS = re.compile(r"code is|verification code|security code|one-time|don't share|do not share", re.I)


def load_config():
    values = {}
    with open(CONFIG) as handle:
        for line in handle:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                values[key.strip()] = val.strip()
    return values["SWAPP_URL"].rstrip("/"), values["SCAN_STATUS_TOKEN"]


def load_state():
    try:
        with open(STATE) as handle:
            return json.load(handle)
    except (OSError, ValueError):
        return {}


def save_state(state):
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    tmp = STATE + ".tmp"
    with open(tmp, "w") as handle:
        json.dump(state, handle)
    os.replace(tmp, STATE)


RECENT_CUTOFF = None

def recent(iso):
    """True when an ISO timestamp is within the backfill window."""
    global RECENT_CUTOFF
    if RECENT_CUTOFF is None:
        RECENT_CUTOFF = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=RECENT_DAYS)
    try:
        return datetime.datetime.fromisoformat(str(iso).replace("Z", "+00:00")) >= RECENT_CUTOFF
    except ValueError:
        return True


def api(url, token, method="GET", body=None):
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json",
                "User-Agent": "swapp-scan/1"},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as error:
        return error.code, {}


def run(cmd, timeout=180):
    try:
        done = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return done.returncode, (done.stdout or "")[:200000]
    except (OSError, subprocess.TimeoutExpired) as error:
        return 1, "scan: command failed: %s" % error


def rule_match(rules, kind, **attrs):
    """A stored tap-answer rule matches when every matcher key it names
    equals the item's value."""
    for rule in rules:
        if rule.get("kind") != kind:
            continue
        matcher = rule.get("matcher") or {}
        if not matcher:
            continue
        if all(attrs.get(key) == value for key, value in matcher.items()):
            return rule
    return None


def quo_sms(seen, rules):
    """New incoming texts since the last scan. Email-only bodies are too thin
    for a lead; they go to the review list instead. Tap answers teach: kept
    senders are skipped, chosen ones become leads on their own."""
    leads, findings, review = [], [], []
    seen = set(seen)
    code, out = run(["quo", "list", "--incoming", "--limit", "25", "--json"], timeout=60)
    if code != 0:
        return leads, findings, {"error": "quo list failed"}, [], []
    try:
        messages = json.loads(out or "[]")
    except ValueError:
        return leads, findings, {"error": "quo list was not JSON"}, [], []
    kept = auto = 0
    fresh = [m for m in messages
             if m.get("direction") == "incoming" and m.get("id") not in seen and recent(m.get("created_at"))
             and not SKIP_SMS.search(m.get("body") or "")]
    for message in messages:
        if message.get("id"):
            seen.add(message.get("id"))
    for message in fresh:
        sender = message.get("from_number") or ""
        if rule_match(rules, "sms-ignore", number=sender):
            kept += 1
            continue
        body = (message.get("body") or "").strip()
        auto_rule = rule_match(rules, "sms-lead", number=sender)
        if EMAIL_ONLY_SMS.match(body) and not auto_rule:
            review.append({
                "brand": "bookkeeping-conroe",
                "room": "phone",
                "key": "scan-cleanup:sms:%s" % message.get("id"),
                "what": "Text from %s is only an email address (%s) — lead or spam?" % (sender, body),
                "evidence": "SMS %s from %s: %s" % (message.get("id"), sender, body[:200]),
                "ref": {"number": sender, "body": body[:200]},
            })
            continue
        if auto_rule:
            auto += 1
        leads.append({
            "brand": "bookkeeping-conroe",
            "name": sender,
            "phone": sender,
            "source": "quo",
            "sourceDetail": "sms%s" % (" (per rule)" if auto_rule else ""),
            "note": (message.get("body") or "")[:200],
        })
    if fresh:
        findings.append({"kind": "quo", "text": "%d new text%s" % (len(fresh), "" if len(fresh) == 1 else "s")})
    return leads, findings, {"new": len(fresh), "review": len(review), "kept": kept, "auto": auto}, sorted(seen)[-200:], review


def quo_calls(seen, rules=None):
    """New Quo calls since the last scan, read from the sales database (read-only)."""
    leads, findings = [], []
    try:
        seen = set(seen)
        conn = sqlite3.connect("file:%s?mode=ro" % SALES_DB, uri=True)
        rows = conn.execute(
            "SELECT call_number, phone, direction, duration, completed_at, created_at, raw_json"
            " FROM calls WHERE provider = 'quo' ORDER BY call_number DESC LIMIT 40"
        ).fetchall()
        conn.close()
    except sqlite3.Error as error:
        return leads, findings, {"error": "sales db unreadable: %s" % error}, [], []
    fresh = [r for r in rows if r[0] not in seen and recent(r[4] or r[5])]
    for row in rows:
        seen.add(row[0])
    own = set()
    missed = []
    for _, _, _, _, _, _, raw in rows:
        try:
            data = json.loads(raw or "{}")
        except ValueError:
            data = {}
        for number in data.get("to", []) or []:
            own.add(number)
    answered = 0
    for number, phone, direction, duration, _, _, raw in fresh:
        if direction == "incoming" and (duration or 0) > 0:
            answered += 1
        try:
            data = json.loads(raw or "{}")
        except ValueError:
            data = {}
        callers = [p for p in (data.get("participants") or []) if p not in own and p != phone]
        caller = phone or (callers[0] if callers else "")
        if caller and direction == "incoming" and (duration or 0) > 0:
            leads.append({
                "brand": "bookkeeping-conroe",
                "name": caller,
                "phone": caller,
                "source": "quo",
                "sourceDetail": "call (%ds)" % (duration or 0),
                "note": "Recorded call; transcript follows via intake.",
            })
    for number, phone, direction, duration, _, _, raw in fresh:
        if direction == "incoming" and not (duration or 0):
            try:
                callers = [p for p in (json.loads(raw or "{}").get("participants") or []) if p not in own]
            except ValueError:
                callers = []
            if phone and phone not in missed:
                missed.append(phone)
            for caller in callers:
                if caller not in missed:
                    missed.append(caller)
    if fresh:
        text = "%d new call%s (%d answered)" % (len(fresh), "" if len(fresh) == 1 else "s", answered)
        if missed:
            text += ": %s" % ", ".join(missed[:3])
        findings.append({"kind": "quo", "text": text})
    return leads, findings, {"new": len(fresh), "answered": answered}, sorted(seen)[-200:], []


VOICEMAIL_ROW = re.compile(
    r"^(?P<at>[^|]+)\|\s*(?P<brand>[^|]+?)\s*\|\s*(?P<phone>\S+)\s*\|\s*(?P<name>[^|]*?)\s*\|"
    r"\s*(?P<topic>[^|]*?)\s*\|\s*(?P<summary>.*?)\s*\|\s*(?P<verdict>\w+)\s*$"
)
VOICEMAIL_BRAND = {"Bookkeeping Conroe": "bookkeeping-conroe", "The Real Estate Bookkeeper": "real-estate-bookkeeper"}


def quo_voicemail(seen, rules=None):
    """Read new voicemails. The intake run itself is a login-check trigger in main."""
    leads, findings = [], []
    code, out = run(["voicemail-intake", "ls", "-n", "15"], timeout=60)
    if code != 0:
        return leads, findings, {"error": "voicemail-intake ls failed"}, [], []
    seen = set(seen)
    genuine = spam = 0
    for line in out.splitlines():
        match = VOICEMAIL_ROW.match(line.strip())
        if not match:
            continue
        key = "%s|%s" % (match.group("at").strip(), match.group("phone").strip())
        if key not in seen and not recent(match.group("at").strip()):
            seen.add(key)
            continue
        is_new = key not in seen
        seen.add(key)
        if not is_new:
            continue
        if match.group("verdict").strip().upper() == "SPAM":
            spam += 1
            continue
        genuine += 1
        brand = VOICEMAIL_BRAND.get(match.group("brand").strip(), "bookkeeping-conroe")
        name = match.group("name").strip() or match.group("phone").strip()
        leads.append({
            "brand": brand,
            "name": name,
            "phone": match.group("phone").strip(),
            "source": "quo",
            "sourceDetail": "voicemail",
            "note": match.group("summary").strip()[:200],
        })
    if genuine or spam:
        findings.append({"kind": "quo", "text": "%d new voicemail%s (%d spam)" % (
            genuine + spam, "" if genuine + spam == 1 else "s", spam)})
    return leads, findings, {"genuine": genuine, "spam": spam}, sorted(seen)[-200:], []


def zoho_mail(seen, rules):
    """New Zoho mail: website forms become leads, signed-hint replies are
    flagged, and real forms from unknown domains go to the review list."""
    leads, findings, hints, review = [], [], [], []
    seen = set(seen)
    code, out = run(["mail", "ls", "zoho", "-n", "25", "--no-interactive"], timeout=120)
    if code != 0:
        return leads, findings, hints, {"error": "mail ls failed"}, [], []
    fresh = []
    for line in out.splitlines():
        parts = line.split()
        if len(parts) < 5 or not parts[0].isdigit() or not parts[1].isdigit():
            continue
        number, uid = parts[0], parts[1]
        if uid not in seen:
            fresh.append((number, uid))
        seen.add(uid)
    forms = ignored = ruled_filed = 0
    for number, uid in sorted(fresh):
        code, out = run(["mail", "read", number], timeout=60)
        if code != 0:
            continue
        try:
            from email.utils import parsedate_to_datetime
            stamp = next((l[5:].strip() for l in out.splitlines() if l.startswith("Date:")), "")
            if stamp and parsedate_to_datetime(stamp).replace(tzinfo=None) < (
                    datetime.datetime.now() - datetime.timedelta(days=RECENT_DAYS)):
                continue
        except (ValueError, TypeError):
            pass
        sender = subject = reply_to = ""
        body_lines = []
        in_body = False
        for line in out.splitlines():
            if not in_body:
                if line.startswith("From:"):
                    sender = line[5:].strip()
                elif line.startswith("Subject:"):
                    subject = line[8:].strip()
                elif line.startswith("Reply-To:"):
                    reply_to = line[9:].strip()
                elif line.startswith("---"):
                    in_body = True
            elif line.strip():
                body_lines.append(line.strip())
        form = FORM_SUBJECT.search(subject)
        fields = {}
        for line in body_lines:
            if ":" in line:
                key, _, val = line.partition(":")
                fields[key.strip().lower()] = val.strip()
        if form:
            domain = form.group(1).strip().lower().rstrip(".")
            brand = FORM_DOMAIN_BRAND.get(domain)
            email = reply_to or fields.get("email", "")
            if SKIP_EMAILS.search(email) or email.lower() in OWN_EMAILS:
                continue
            ruled = rule_match(rules, "form-ignore", domain=domain)
            if ruled:
                ignored += 1
                continue
            auto_rule = rule_match(rules, "form-brand", domain=domain)
            if auto_rule and isinstance(auto_rule.get("action"), dict):
                brand = auto_rule["action"].get("brand", brand)
                if brand:
                    ruled_filed += 1
            if not brand:
                name = fields.get("name") or (email.split("@")[0] if "@" in email else "Website visitor")
                review.append({
                    "brand": "bookkeeping-conroe",
                    "room": "inbox",
                    "key": "scan-cleanup:form:%s" % uid,
                    "what": "Form submission from %s — which brand?" % domain,
                    "evidence": "%s from %s: %s" % (subject[:150], sender[:150], " ".join(body_lines[:2])[:300]),
                    "ref": {
                        "domain": domain,
                        "email": email or None,
                        "name": (fields.get("name") or "")[:200],
                        "phone": (fields.get("phone") or "")[:64],
                        "form": (fields.get("form") or "website")[:60],
                    },
                })
                continue
            forms += 1
            name = fields.get("name") or (email.split("@")[0] if "@" in email else "Website visitor")
            ruled_note = " (per rule)" if brand and brand not in FORM_DOMAIN_BRAND.values() else ""
            leads.append({
                "brand": brand,
                "name": name[:200],
                "email": email or None,
                "phone": fields.get("phone"),
                "source": "zoho",
                "sourceDetail": "form:%s" % fields.get("form", "website")[:60],
                "note": "Form submission from %s%s" % (domain, ruled_note),
            })
            continue
        if SKIP_SENDERS.search(sender) or SKIP_EMAILS.search(sender):
            continue
        text = "%s %s" % (subject, " ".join(body_lines[:6]))
        if AGREEMENT_WORDS.search(text) and SIGNED_WORDS.search(text):
            address = re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", sender)
            if address:
                hints.append({
                    "fromEmail": address.group(0).lower(),
                    "fromName": sender[:200],
                    "subject": subject[:200],
                    "snippet": " ".join(body_lines[:3])[:500],
                })
    if ignored or ruled_filed:
        findings.append({"kind": "zoho", "text": "%d handled by rule%s" % (
            ignored + ruled_filed, "" if ignored + ruled_filed == 1 else "s")})
    if fresh:
        findings.append({"kind": "zoho", "text": "%d new email%s (%d form%s)" % (
            len(fresh), "" if len(fresh) == 1 else "s", forms, "" if forms == 1 else "s")})
    return leads, findings, hints, {"new": len(fresh), "forms": forms, "hints": len(hints),
                                      "review": len(review)}, sorted(seen)[-200:], review


EMAIL_ONLY_SMS = re.compile(r"^[\w.+-]+@[\w-]+\.[\w.]+$")


SHARED_PROVIDERS = {"gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "aol.com", "icloud.com", "proton.me", "zoho.com"}

ALWAYS_BLOCK_PATH = os.path.expanduser("~/.local/state/mailroom/spam-always-block.json")


def sync_always_spam(rules):
    """Push tap-answer spam rules into the existing always-block list, so the
    regular sweep enforces them. Never removes anything; undo deactivates the
    rule (list entries stay as Tom's own history)."""
    auto = []
    try:
        wanted = set()
        for rule in rules:
            if rule.get("kind") != "always-spam":
                continue
            matcher = rule.get("matcher") or {}
            sender = str(matcher.get("sender") or "").lower()
            domain = str(matcher.get("domain") or matcher.get("sender", "")).lower()
            if "@" in domain:
                domain = domain.split("@", 1)[1]
            if sender and "@" in sender:
                wanted.add(sender)
            if domain and domain not in SHARED_PROVIDERS:
                wanted.add(domain)
        if not wanted:
            return auto
        with open(ALWAYS_BLOCK_PATH) as handle:
            data = json.load(handle)
        senders = data.get("senders", [])
        missing = [s for s in sorted(wanted) if s not in senders]
        if missing:
            data["senders"] = senders + missing
            tmp = ALWAYS_BLOCK_PATH + ".tmp"
            with open(tmp, "w") as handle:
                json.dump(data, handle, indent=2)
                handle.write("\n")
            os.replace(tmp, ALWAYS_BLOCK_PATH)
            auto.append("added %d sender%s to always-spam" % (len(missing), "" if len(missing) == 1 else "s"))
    except (OSError, ValueError) as error:
        auto.append("always-spam sync skipped (%s)" % str(error)[:80])
    return auto


def gather(state, post, rules):
    """Read the external sources in parallel. Nothing waits on anything else:
    each source posts its own progress, and one failure never blocks the rest."""
    import concurrent.futures
    all_leads, all_findings, all_hints, all_review, auto = [], [], [], [], []
    summary = {}
    jobs = {
        "quo-sms": ("quo_sms", quo_sms, state.get("sms_ids", [])),
        "quo-calls": ("quo_calls", quo_calls, state.get("call_ids", [])),
        "quo-voicemail": ("quo_voicemail", quo_voicemail, state.get("voicemail_keys", [])),
        "zoho": ("zoho", zoho_mail, state.get("mail_uids", [])),
    }
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        running = {pool.submit(func, seen, rules): key for key, (_, func, seen) in jobs.items()}
        for done in concurrent.futures.as_completed(running):
            key = running[done]
            name = jobs[key][0]
            try:
                out = done.result()
            except Exception as error:
                summary[name] = {"error": str(error)[:200]}
                post(key, "needs-you", "Scan hit an error: %s" % str(error)[:150])
                continue
            if key == "zoho":
                leads, findings, hints, stats, seen, review = out
                all_hints.extend(hints)
                state["mail_uids"] = seen
            else:
                leads, findings, stats, seen, review = out
                state[{"quo-sms": "sms_ids", "quo-calls": "call_ids",
                       "quo-voicemail": "voicemail_keys"}[key]] = seen
            if key == "zoho":
                all_leads.extend(leads)
            all_findings.extend(findings)
            all_review.extend(review)
            summary[name] = stats
            if stats.get("error"):
                post(key, "needs-you", stats["error"][:200])
            else:
                post(key, "scanning", "Data collected; Source SOP review pending")
    return all_leads, all_findings, all_hints, all_review, summary, auto


def scan_once(swapp_url, token):
    status, pending = api(swapp_url + "/api/scan/pending", token)
    if status == 503:
        print("SWapp has no SCAN_STATUS_TOKEN yet.", flush=True)
        return False
    if status != 200:
        print("pending check failed: HTTP %d" % status, flush=True)
        return False
    state = load_state()
    run_id = since = None
    # Only 'requested' runs come from Tom pressing Scan (auto runs claim
    # straight to running).
    if pending.get("requested"):
        status, claimed = api(swapp_url + "/api/scan/claim", token, "POST", body={})
        if status == 409:
            print("another poller claimed the run.", flush=True)
            return True
        if status != 200:
            print("claim failed: HTTP %d" % status, flush=True)
            return False
        run_id, since = claimed.get("runId"), claimed.get("since")
    else:
        last = pending.get("lastFinishedAt")
        due = True
        if last:
            try:
                import datetime
                finished = datetime.datetime.fromisoformat(last.replace("Z", "+00:00"))
                now = datetime.datetime.now(datetime.timezone.utc)
                due = (now - finished).total_seconds() >= AUTO_MINUTES * 60
            except ValueError:
                due = True
        if not due:
            return True
        status, claimed = api(swapp_url + "/api/scan/claim", token, "POST", body={"auto": True})
        if status != 200:
            print("auto claim failed: HTTP %d" % status, flush=True)
            return False
        run_id, since = claimed.get("runId"), claimed.get("since")
        if not run_id:
            return False
    print("scanning run %s (since %s) ..." % (run_id, since), flush=True)
    try:
        _, fetched = api(swapp_url + "/api/scan/rules", token)
        scan_rules = fetched.get("rules", []) if isinstance(fetched, dict) else []
    except Exception:
        scan_rules = []
    auto_labels = sync_always_spam(scan_rules)

    def post(source, status, detail=None):
        try:
            api(swapp_url + "/api/scan/progress", token, "POST",
                body={"runId": run_id, "source": source, "status": status, "detail": detail})
        except Exception:
            pass

    # Login-gated sources are checked FIRST: sync triggers that fail pin their
    # rows at the top as needs-you, while everything else keeps scanning.
    for key in ("quo-sms", "quo-calls", "quo-voicemail", "zoho", "swapp", "ga4"):
        post(key, "scanning")
    sync_code, _ = run(["sales", "sync", "all"], timeout=240)
    if sync_code != 0:
        for key in ("quo-sms", "quo-calls"):
            post(key, "needs-you", "Quo sync failed — check the Quo session, then Scan again")
    leads, findings, hints, review, summary, auto = gather(state, post, scan_rules)
    auto_labels.extend(auto)
    # Mail is Donna's job now (Tom, 2026-11-28): the Scanner never sorts, sweeps
    # or reviews mail; Mailroom's spam patrol and mail-sort are retired.
    source_reviews, review_changes = run_reviews(run_id, summary, post)
    native_leads = quo_intake("lead_exports", destination=swapp_url)[:max(0, 20 - len(leads))]
    leads = [*leads, *native_leads]
    summary["sourceReviews"] = source_reviews
    findings.extend(review_changes)
    status, done = api(swapp_url + "/api/scan/complete", token, "POST", body={
        "runId": run_id,
        "summary": summary,
        "changes": findings,
        "leads": leads,
        "signedHints": hints,
        "reviewItems": review,
        "autoApplied": auto_labels + auto,
    })
    if status != 200:
        print("complete failed: HTTP %d" % status, flush=True)
        return False
    quo_intake("acknowledge_exports", keys=[lead["key"] for lead in native_leads], destination=swapp_url)
    save_state(state)
    print("scan done: %d change(s), %d lead(s) created." % (done.get("saved", 0), done.get("leadsCreated", 0)),
          flush=True)
    return True


def main():
    try:
        swapp_url, token = load_config()
    except (OSError, KeyError) as error:
        print("scan: %s (%s)" % (error, CONFIG), flush=True)
        return 2
    if "--once" in sys.argv:
        return 0 if scan_once(swapp_url, token) else 1
    while True:
        try:
            scan_once(swapp_url, token)
        except Exception as error:  # keep polling: SWapp or the network may be down
            print("scan failed: %s" % error, flush=True)
        time.sleep(60)


if __name__ == "__main__":
    raise SystemExit(main())
