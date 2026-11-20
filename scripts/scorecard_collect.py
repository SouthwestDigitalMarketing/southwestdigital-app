#!/usr/bin/env python3
"""Collect client response times for the SWapp Scorecard (docs/scorecard.md).

Runs every 5 minutes on ripley (swapp-scorecard.timer). Reads, never writes:
  - the client list from GET {SWAPP_BASE_URL}/api/scorecard/clients (Bearer token from
    ~/.config/swapp/operations.env), or --clients-json for testing;
  - Quo texts and calls from ~/.local/share/lochside-sales/sales.db, opened read-only;
  - Zoho mail HEADERS over IMAP (readonly SELECT, BODY.PEEK of a fixed header list).
Then posts events to POST /api/scorecard/ingest in batches of up to 500.

Privacy: message bodies are never loaded. The one body test (an outgoing opt-out "STOP"
is not an answer) runs inside SQLite and returns a 0/1 flag. Events carry timing, channel,
contact id and a match method only: no names, numbers, addresses, subjects or Message-IDs.
--dry-run prints counts and medians only. Never prints the token or the IMAP password.

Usage: scorecard_collect.py [--backfill] [--dry-run] [--source quo|zoho|all]
                            [--clients-json PATH]
Setup and flags: docs/scorecard-collector.md.
"""

import argparse
import datetime as dt
import email
import email.utils
import hashlib
import imaplib
import json
import os
import re
import sqlite3
import statistics
import subprocess
import sys
import urllib.error
import urllib.request
from zoneinfo import ZoneInfo

BRAND = "bookkeeping-conroe"
FIRM_TZ = ZoneInfo("America/Chicago")
OPS_ENV = os.path.expanduser(os.environ.get("SWAPP_OPERATIONS_ENV", "~/.config/swapp/operations.env"))
SALES_DB = os.path.expanduser(os.environ.get("LOCHSIDE_SALES_DB", "~/.local/share/lochside-sales/sales.db"))
DEFAULT_BASE = "https://admin.southwestdigital.io"

IMAP_HOST, IMAP_PORT, IMAP_USER = "imap.zoho.com", 993, "thomas@bookkeepingconroe.com"
IMAP_PASS_ENTRY = "zoho/imap-ripley"
INBOUND_BOXES = ["INBOX", "Archive", "Personal"]
SENT_BOX = "Sent"
HEADER_FIELDS = ("FROM TO CC DATE MESSAGE-ID IN-REPLY-TO REFERENCES AUTO-SUBMITTED "
                 "PRECEDENCE LIST-UNSUBSCRIBE")
FETCH_ITEM = "(UID BODY.PEEK[HEADER.FIELDS (%s)])" % HEADER_FIELDS
OWN_DOMAINS = ("bookkeepingconroe.com", "southwestdigital.io", "realestatebookkeeper.com")

RECENT_DAYS = 14          # normal runs send events started or answered in this window, plus open ones
IMAP_SINCE_DAYS = 90      # normal runs read this much mail; --backfill reads all of it
EMAIL_ADDRESS_DAYS = 7    # an address-only email answer must come within this many days
BATCH = 500
HTTP_TIMEOUT = 60
IMAP_TIMEOUT = 60


# ---------- small helpers ----------

def parse_ts(value):
    """ISO 8601 (with Z or offset) to an aware UTC datetime; None when empty."""
    if not value:
        return None
    t = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    if t.tzinfo is None:
        t = t.replace(tzinfo=dt.timezone.utc)
    return t.astimezone(dt.timezone.utc)


def iso(t):
    return t.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z") if t else None


def firm_date(t):
    return t.astimezone(FIRM_TZ).date().isoformat()


def e164(number):
    """Normalise a US-style phone number to E.164; None when it is not a number."""
    if not number:
        return None
    digits = re.sub(r"\D", "", str(number))
    if len(digits) == 10:
        return "+1" + digits
    if len(digits) == 11 and digits.startswith("1"):
        return "+" + digits
    if str(number).strip().startswith("+") and 8 <= len(digits) <= 15:
        return "+" + digits
    return None


def json_list(text):
    try:
        value = json.loads(text or "[]")
    except ValueError:
        return []
    return value if isinstance(value, list) else []


def is_own(address):
    address = (address or "").lower()
    return any(address.endswith("@" + d) for d in OWN_DOMAINS)


class Clients:
    """Client lookup by phone and email, with the client window check."""

    def __init__(self, rows):
        self.rows = rows
        self.by_phone, self.by_email = {}, {}
        for row in rows:
            for p in row.get("phones") or []:
                n = e164(p)
                if n:
                    self.by_phone.setdefault(n, []).append(row)
            for e in row.get("emails") or []:
                e = (e or "").strip().lower()
                if e and not is_own(e):
                    self.by_email.setdefault(e, []).append(row)

    @staticmethod
    def in_window(row, t):
        day = firm_date(t)
        if day < row["clientFrom"]:
            return False
        return not row.get("clientUntil") or day <= row["clientUntil"]

    def for_phone(self, number, t):
        """The client with this number whose window holds t (first listed wins), else None."""
        for row in self.by_phone.get(number, []):
            if self.in_window(row, t):
                return row
        return None


def make_event(source_key, channel, kind, client, started, responded, via, details=None):
    return {"sourceKey": source_key, "channel": channel, "kind": kind,
            "contactId": client["contactId"], "startedAt": iso(started),
            "respondedAt": iso(responded), "responseVia": via if responded else None,
            "details": details or None}


# ---------- Quo (sales.db) ----------

def open_sales_db(path=SALES_DB):
    return sqlite3.connect("file:%s?mode=ro" % path, uri=True)


def read_quo(conn):
    """Return (items, covered_to). Each item is one text or call, keyed to the other party.

    Bodies are never selected into Python: the opt-out check is a 0/1 flag computed by
    SQLite. Outgoing texts answer only when delivered or sent and not a bare "STOP".
    """
    items, latest = [], None
    rows = conn.execute(
        "SELECT id, direction, phone_number_id, participants, status, created_at,"
        " CASE WHEN direction = 'outgoing' AND upper(trim(body)) = 'STOP' THEN 1 ELSE 0 END"
        " FROM messages WHERE provider = 'quo'")
    for mid, direction, line, participants, status, created, is_stop in rows:
        t = parse_ts(created)
        if not t:
            continue
        latest = max(latest, t) if latest else t
        answers = direction == "outgoing" and status in ("delivered", "sent") and not is_stop
        for p in json_list(participants):
            n = e164(p)
            if n:
                items.append({"t": t, "number": n, "line": line, "type": "text",
                              "direction": direction, "id": mid, "answers": answers})
    rows = conn.execute(
        "SELECT provider_id, direction, status, phone_number_id, line_number, participants,"
        " scheduled_for, answered_at, duration FROM calls WHERE provider = 'quo'")
    for pid, direction, status, line, line_number, participants, at, answered, duration in rows:
        t = parse_ts(at)
        if not t or not pid:
            continue
        latest = max(latest, t) if latest else t
        if status == "in-progress":
            continue
        ours = e164(line_number)
        for p in json_list(participants):
            n = e164(p)
            if n and n != ours:
                items.append({"t": t, "number": n, "line": line, "type": "call",
                              "direction": direction, "id": pid, "status": status,
                              "answered_at": parse_ts(answered), "duration": duration or 0,
                              "answers": direction == "outgoing"})
    items.sort(key=lambda i: (i["t"], i["direction"] != "incoming"))
    return items, latest


def outgoing_by_number(items):
    """Number -> sorted [(time, 'text'|'call')] of outgoing contact that counts as an answer."""
    out = {}
    for i in items:
        if i["direction"] == "outgoing" and i["answers"]:
            out.setdefault(i["number"], []).append((i["t"], i["type"]))
    return out


def quo_events(items, clients):
    """text_reply, call_answered and call_missed events for clients (docs/scorecard.md)."""
    events = []
    open_text = {}      # (number, line) -> [event, burst size]
    pending_missed = {}  # number -> [event, ...] waiting for a callback
    for i in items:
        n, t = i["number"], i["t"]
        if i["direction"] == "incoming" and i["type"] == "text":
            key = (n, i["line"])
            if key in open_text:
                open_text[key][1] += 1
                continue
            client = clients.for_phone(n, t)
            if not client:
                # Not a client at this moment: still a burst, so later texts in it are not
                # counted as new questions, but no event is sent.
                open_text[key] = [None, 1]
                continue
            ev = make_event("quo:text:%s" % i["id"], "text", "text_reply", client, t, None, None)
            events.append(ev)
            open_text[key] = [ev, 1]
        elif i["direction"] == "incoming" and i["type"] == "call":
            client = clients.for_phone(n, t)
            if i["status"] == "completed" and i["answered_at"]:
                if client:
                    events.append(make_event("quo:call:%s" % i["id"], "call", "call_answered",
                                             client, t, i["answered_at"], "call"))
            elif i["status"] == "no-answer" and client:
                ev = make_event("quo:call:%s" % i["id"], "call", "call_missed", client, t, None,
                                None, {"voicemail": i["duration"] > 0})
                events.append(ev)
                pending_missed.setdefault(n, []).append(ev)
        elif i["direction"] == "outgoing" and i["answers"]:
            key = (n, i["line"])
            if key in open_text:
                ev, size = open_text.pop(key)
                if ev:
                    ev["respondedAt"], ev["responseVia"] = iso(t), i["type"]
                    if size > 1:
                        ev["details"] = {"burst": size}
            for ev in pending_missed.pop(n, []):
                ev["respondedAt"], ev["responseVia"] = iso(t), i["type"]
    return events


# ---------- Zoho (IMAP headers) ----------

def addresses(value):
    return [a.lower() for _, a in email.utils.getaddresses([value or ""]) if "@" in a]


def message_ids(value):
    return re.findall(r"<[^<>\s]+>", value or "")


def parse_headers(raw, box, uid):
    """Header bytes to a plain record. Unparseable dates drop the message."""
    msg = email.message_from_bytes(raw)
    get = lambda k: " ".join(str(msg.get(k, "") or "").split())
    try:
        t = email.utils.parsedate_to_datetime(get("Date"))
    except (TypeError, ValueError, IndexError):
        return None
    if t is None:
        return None
    if t.tzinfo is None:
        t = t.replace(tzinfo=dt.timezone.utc)
    mids = message_ids(get("Message-ID"))
    return {
        "box": box, "uid": uid, "t": t.astimezone(dt.timezone.utc),
        "message_id": mids[0] if mids else None,
        "from": addresses(get("From")), "to": addresses(get("To")) + addresses(get("Cc")),
        "refs": set(message_ids(get("In-Reply-To")) + message_ids(get("References"))),
        "auto_submitted": get("Auto-Submitted").lower(),
        "precedence": get("Precedence").lower(),
        "list_unsubscribe": bool(get("List-Unsubscribe")),
    }


def is_bulk(m):
    if m["list_unsubscribe"]:
        return True
    if m["auto_submitted"] and m["auto_submitted"] != "no":
        return True
    return m["precedence"] in ("bulk", "list", "junk")


def imap_password():
    out = subprocess.run(["pass", "show", IMAP_PASS_ENTRY], capture_output=True, text=True,
                         timeout=30)
    if out.returncode != 0 or not out.stdout.strip():
        raise RuntimeError("pass show %s failed" % IMAP_PASS_ENTRY)
    return out.stdout.splitlines()[0]


def fetch_zoho(since=None):
    """Return {box: [record, ...]} for the inbound boxes and Sent. Read-only."""
    conn = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT, timeout=IMAP_TIMEOUT)
    try:
        conn.login(IMAP_USER, imap_password())
        out = {}
        for box in INBOUND_BOXES + [SENT_BOX]:
            status, _ = conn.select('"%s"' % box, readonly=True)
            if status != "OK":
                raise RuntimeError("cannot open folder %s" % box)
            crit = ("SINCE", since.strftime("%d-%b-%Y")) if since else ("ALL",)
            status, data = conn.uid("search", None, *crit)
            uids = data[0].split() if status == "OK" and data and data[0] else []
            rows = []
            for k in range(0, len(uids), 100):
                status, resp = conn.uid("fetch", b",".join(uids[k:k + 100]), FETCH_ITEM)
                if status != "OK":
                    raise RuntimeError("fetch failed in %s" % box)
                for part in resp:
                    if not isinstance(part, tuple):
                        continue
                    m = re.search(rb"UID (\d+)", part[0])
                    rec = parse_headers(part[1], box, m.group(1).decode() if m else "?")
                    if rec:
                        rows.append(rec)
            out[box] = rows
        return out
    finally:
        try:
            conn.logout()
        except Exception:  # noqa: BLE001  (closing only)
            pass


def dedupe(records):
    """One record per Message-ID across folders (first seen wins)."""
    seen, out = set(), []
    for r in records:
        key = r["message_id"] or "%s:%s:%s" % (r["box"], r["uid"], iso(r["t"]))
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out


def email_key(rec):
    basis = rec["message_id"] or "%s:%s:%s" % (rec["box"], rec["uid"], iso(rec["t"]))
    return "zoho:email:" + hashlib.sha1(basis.encode()).hexdigest()[:16]


def email_answer(first_t, until, ids, sent, mine_out, quo):
    """(closed, answer time, via, match) for a burst that starts at first_t, looking only
    at contact before until (the next client mail; None = no later mail).

    Anything that answers the client closes the burst: a Sent naming a burst message
    (thread, to any recipient), a Sent to one of the client's addresses, or a Quo text or
    call to the client's number. Only a thread answers after 7 days; a later Sent or Quo
    contact still closes the burst, unanswered. closed=False means nothing yet, so the
    next client mail joins this burst.
    """
    week = dt.timedelta(days=EMAIL_ADDRESS_DAYS)

    def inside(x):
        return first_t < x and (until is None or x < until)

    thread = next((r["t"] for r in sent if inside(r["t"]) and ids & r["refs"]), None)
    addr = next((r["t"] for r in mine_out if inside(r["t"])), None)
    q = next((x for x in quo if inside(x[0])), None)
    if thread is None and addr is None and q is None:
        return False, None, None, None
    if thread is not None:
        answer, via, match = thread, "email", "thread"
    elif addr is not None and addr - first_t <= week:
        answer, via, match = addr, "email", "address"
    else:
        answer, via, match = None, None, None
    if q and (q[0] < answer if answer else q[0] - first_t <= week):
        answer, via, match = q[0], q[1], q[1]
    return True, answer, via, match


def email_events(boxes, clients, quo_outgoing):
    """email_reply events for clients (docs/scorecard.md).

    A burst is the inbound mail from one client until something answers it (see
    email_answer); the next client mail after that starts a new burst. Its first message
    starts the event. Answer: the earliest Sent whose In-Reply-To or
    References names a message of the burst (thread); else the earliest Sent to one of the
    client's addresses within 7 days (address). A Quo text or call to the client's number
    before that answer (or within 7 days when there is none) answers it instead.
    """
    inbound = dedupe([r for b in INBOUND_BOXES for r in boxes.get(b, [])])
    sent = sorted(dedupe(boxes.get(SENT_BOX, [])), key=lambda r: r["t"])
    sent_ids = {r["message_id"] for r in sent if r["message_id"]}
    events = []
    for client in clients.rows:
        addrs = {a for a in (e.strip().lower() for e in client.get("emails") or [])
                 if a and not is_own(a)}
        if not addrs:
            continue
        mine_in = sorted((r for r in inbound
                          if r["message_id"] not in sent_ids and r["from"]
                          and r["from"][0] in addrs and not is_own(r["from"][0])
                          and not is_bulk(r)), key=lambda r: r["t"])
        mine_out = [r for r in sent if addrs & set(r["to"])]
        phones = {e164(p) for p in client.get("phones") or []} - {None}
        quo = sorted(x for p in phones for x in quo_outgoing.get(p, []))
        k = 0
        while k < len(mine_in):
            first = mine_in[k]
            burst, ids = [first], {first["message_id"]} - {None}
            k += 1
            # Grow the burst until something answers it before the next client mail.
            while True:
                until = mine_in[k]["t"] if k < len(mine_in) else None
                closed, answer, via, match = email_answer(first["t"], until, ids, sent,
                                                          mine_out, quo)
                if closed or until is None:
                    break
                burst.append(mine_in[k])
                ids |= {mine_in[k]["message_id"]} - {None}
                k += 1
            if not Clients.in_window(client, first["t"]):
                continue
            details = {"match": match} if match else {}
            if len(burst) > 1:
                details["burst"] = len(burst)
            events.append(make_event(email_key(first), "email", "email_reply", client,
                                     first["t"], answer, via, details))
    return events


# ---------- SWapp API ----------

def load_ops_env(path=OPS_ENV):
    env = {}
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    token = os.environ.get("SWAPP_OPERATIONS_TOKEN") or env.get("SWAPP_OPERATIONS_TOKEN")
    base = os.environ.get("SWAPP_BASE_URL") or env.get("SWAPP_BASE_URL") or DEFAULT_BASE
    return token, base.rstrip("/")


class ApiError(Exception):
    pass


def api(method, url, token, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": "Bearer " + token, "Content-Type": "application/json",
        "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            return json.loads(resp.read().decode() or "null")
    except urllib.error.HTTPError as e:
        raise ApiError("%s %s -> HTTP %s" % (method, url.split("?")[0], e.code)) from None
    except urllib.error.URLError as e:
        raise ApiError("%s %s -> %s" % (method, url.split("?")[0], e.reason)) from None


def load_clients(args, token, base):
    if args.clients_json:
        with open(args.clients_json) as f:
            data = json.load(f)
    else:
        data = api("GET", "%s/api/scorecard/clients?brand=%s" % (base, BRAND), token)
    if isinstance(data, dict):
        data = data.get("clients") or []
    return [r for r in data if r.get("contactId") and r.get("clientFrom")]


def post_events(base, token, source, events, sync):
    """Batches of up to BATCH; the sync record rides on the last batch."""
    chunks = [events[k:k + BATCH] for k in range(0, len(events), BATCH)] or [[]]
    for k, chunk in enumerate(chunks):
        body = {"brand": BRAND, "events": chunk}
        if k == len(chunks) - 1:
            body["sync"] = sync
        api("POST", base + "/api/scorecard/ingest", token, body)


# ---------- run ----------

def keep(events, now, backfill):
    if backfill:
        return events
    since = now - dt.timedelta(days=RECENT_DAYS)
    # Open events are always re-sent; an old event answered inside the window is re-sent
    # too, or SWapp would keep the open copy an earlier run posted.
    return [e for e in events if e["respondedAt"] is None
            or parse_ts(e["startedAt"]) >= since or parse_ts(e["respondedAt"]) >= since]


SOURCE_KINDS = {"quo": ["text_reply", "call_answered", "call_missed"], "zoho": ["email_reply"]}


def summary_lines(events, kinds):
    """Counts and clock medians per kind. No names, numbers or addresses."""
    lines = []
    for kind in kinds:
        rows = [e for e in events if e["kind"] == kind]
        spans = [(parse_ts(e["respondedAt"]) - parse_ts(e["startedAt"])).total_seconds() / 60
                 for e in rows if e["respondedAt"]]
        med = "%.1f" % statistics.median(spans) if spans else "-"
        extra = ""
        if kind == "call_missed":
            extra = " voicemail=%d" % sum(1 for e in rows if (e["details"] or {}).get("voicemail"))
        if kind == "email_reply":
            by = {}
            for e in rows:
                m = (e["details"] or {}).get("match") or "open"
                by[m] = by.get(m, 0) + 1
            extra = " " + " ".join("%s=%d" % kv for kv in sorted(by.items()))
        lines.append("%-14s count=%d answered=%d median_clock_min=%s%s"
                     % (kind, len(rows), len(spans), med, extra))
    return lines


def main(argv=None):
    ap = argparse.ArgumentParser(description="Collect Scorecard events (docs/scorecard.md)")
    ap.add_argument("--backfill", action="store_true", help="send all history")
    ap.add_argument("--dry-run", action="store_true", help="print counts only, post nothing")
    ap.add_argument("--source", choices=["quo", "zoho", "all"], default="all")
    ap.add_argument("--clients-json", help="read clients from this file instead of the API")
    args = ap.parse_args(argv)

    now = dt.datetime.now(dt.timezone.utc)
    token, base = load_ops_env()
    if not token and not (args.dry_run and args.clients_json):
        print("SWAPP_OPERATIONS_TOKEN is not set (%s)" % OPS_ENV, file=sys.stderr)
        return 1
    try:
        clients = Clients(load_clients(args, token, base))
    except (ApiError, OSError, ValueError) as e:
        print("clients: %s" % e, file=sys.stderr)
        return 1
    print("clients=%d" % len(clients.rows))

    failed = False
    db = open_sales_db()
    try:
        items, quo_covered = read_quo(db)
    finally:
        db.close()

    results = []  # (source, events, sync)
    if args.source in ("quo", "all"):
        ev = keep(quo_events(items, clients), now, args.backfill)
        results.append(("quo", ev, {"source": "quo", "coveredTo": iso(quo_covered), "ok": True,
                                    "note": "%d events" % len(ev)}))
    if args.source in ("zoho", "all"):
        try:
            since = None if args.backfill else now - dt.timedelta(days=IMAP_SINCE_DAYS)
            boxes = fetch_zoho(since)
            ev = keep(email_events(boxes, clients, outgoing_by_number(items)), now, args.backfill)
            sync = {"source": "zoho", "coveredTo": iso(now), "ok": True,
                    "note": "%d events" % len(ev)}
        except (imaplib.IMAP4.error, OSError, RuntimeError, subprocess.SubprocessError) as e:
            failed = True
            ev = []
            sync = {"source": "zoho", "coveredTo": None, "ok": False,
                    "note": "zoho read failed: %s" % type(e).__name__}
            print(sync["note"], file=sys.stderr)
        results.append(("zoho", ev, sync))

    for source, ev, sync in results:
        if args.dry_run:
            print("[%s] events=%d ok=%s" % (source, len(ev), sync["ok"]))
            for line in summary_lines(ev, SOURCE_KINDS[source]):
                print("  " + line)
            continue
        try:
            post_events(base, token, source, ev, sync)
            print("[%s] posted %d events" % (source, len(ev)))
        except ApiError as e:
            print("[%s] %s" % (source, e), file=sys.stderr)
            return 1
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
