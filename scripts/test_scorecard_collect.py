"""Tests for scorecard_collect.py. No network, no real data.

Run: python3 -m unittest scripts/test_scorecard_collect.py
"""

import datetime as dt
import os
import sqlite3
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import scorecard_collect as sc  # noqa: E402

LINE = "PNline1"
OUR = "+19365550000"
CLIENT = "+12815550101"
STRANGER = "+12815550199"


def client_row(**over):
    row = {"contactId": "c1", "name": "Test", "phones": ["(281) 555-0101"],
           "emails": ["pat@example.com"], "clientFrom": "2026-01-01", "clientUntil": None}
    row.update(over)
    return row


def t(day, hm):
    """2026-03-<day> at hh:mm UTC."""
    h, m = hm.split(":")
    return dt.datetime(2026, 3, day, int(h), int(m), tzinfo=dt.timezone.utc)


def db():
    conn = sqlite3.connect(":memory:")
    conn.executescript("""
      CREATE TABLE messages (id TEXT, provider TEXT, direction TEXT, phone_number_id TEXT,
        from_number TEXT, to_numbers TEXT, participants TEXT, body TEXT, status TEXT,
        created_at TEXT, raw_json TEXT);
      CREATE TABLE calls (provider TEXT, provider_id TEXT, direction TEXT, status TEXT,
        phone_number_id TEXT, line_number TEXT, participants TEXT, phone TEXT,
        scheduled_for TEXT, answered_at TEXT, duration INTEGER);
    """)
    return conn


def text(conn, mid, direction, when, status=None, body="hi", number=CLIENT):
    status = status or ("received" if direction == "incoming" else "delivered")
    conn.execute("INSERT INTO messages VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                 (mid, "quo", direction, LINE, None, "[]", '["%s"]' % number, body, status,
                  sc.iso(when), "{}"))


def call(conn, pid, direction, when, status="completed", answered=None, duration=0,
         number=CLIENT):
    conn.execute("INSERT INTO calls VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                 ("quo", pid, direction, status, LINE, OUR, '["%s","%s"]' % (number, OUR), None,
                  sc.iso(when), sc.iso(answered), duration))


def run_quo(conn, rows=None):
    items, _ = sc.read_quo(conn)
    return sc.quo_events(items, sc.Clients(rows or [client_row()])), items


class QuoTests(unittest.TestCase):
    def test_e164(self):
        self.assertEqual(sc.e164("(281) 555-0101"), CLIENT)
        self.assertEqual(sc.e164("12815550101"), CLIENT)
        self.assertIsNone(sc.e164("123"))

    def test_burst_counts_once_and_answer_closes_it(self):
        conn = db()
        text(conn, "m1", "incoming", t(2, "15:00"))
        text(conn, "m2", "incoming", t(2, "15:05"))
        text(conn, "m3", "outgoing", t(2, "15:30"))
        text(conn, "m4", "incoming", t(2, "16:00"))
        events, _ = run_quo(conn)
        texts = [e for e in events if e["kind"] == "text_reply"]
        self.assertEqual([e["sourceKey"] for e in texts], ["quo:text:m1", "quo:text:m4"])
        self.assertEqual(texts[0]["respondedAt"], sc.iso(t(2, "15:30")))
        self.assertEqual(texts[0]["responseVia"], "text")
        self.assertEqual(texts[0]["details"], {"burst": 2})
        self.assertIsNone(texts[1]["respondedAt"])

    def test_stop_is_not_an_answer(self):
        conn = db()
        text(conn, "m1", "incoming", t(2, "15:00"))
        text(conn, "m2", "outgoing", t(2, "15:01"), body=" stop ")
        text(conn, "m3", "outgoing", t(2, "15:40"))
        events, _ = run_quo(conn)
        self.assertEqual(events[0]["respondedAt"], sc.iso(t(2, "15:40")))

    def test_undelivered_is_not_an_answer(self):
        conn = db()
        text(conn, "m1", "incoming", t(2, "15:00"))
        text(conn, "m2", "outgoing", t(2, "15:01"), status="undelivered")
        text(conn, "m3", "outgoing", t(2, "15:20"), status="sent")
        events, _ = run_quo(conn)
        self.assertEqual(events[0]["respondedAt"], sc.iso(t(2, "15:20")))

    def test_outgoing_call_answers_a_text(self):
        conn = db()
        text(conn, "m1", "incoming", t(2, "15:00"))
        call(conn, "CA1", "outgoing", t(2, "15:10"))
        events, _ = run_quo(conn)
        texts = [e for e in events if e["kind"] == "text_reply"]
        self.assertEqual(texts[0]["responseVia"], "call")

    def test_client_window_and_strangers(self):
        conn = db()
        text(conn, "m1", "incoming", t(2, "15:00"))  # before clientFrom
        text(conn, "m2", "outgoing", t(2, "15:10"))
        text(conn, "m3", "incoming", t(20, "15:00"))  # after clientUntil
        text(conn, "m4", "incoming", t(5, "15:00"), number=STRANGER)
        events, _ = run_quo(conn, [client_row(clientFrom="2026-03-03", clientUntil="2026-03-10")])
        self.assertEqual(events, [])

    def test_window_uses_firm_date(self):
        conn = db()
        # 2026-03-03 03:00 UTC is still 2 March in Chicago, before clientFrom.
        text(conn, "m1", "incoming", t(3, "03:00"))
        events, _ = run_quo(conn, [client_row(clientFrom="2026-03-03")])
        self.assertEqual(events, [])

    def test_calls_answered_missed_and_callback_by_text(self):
        conn = db()
        call(conn, "CA1", "incoming", t(2, "15:00"), answered=t(2, "15:00"))
        call(conn, "CA2", "incoming", t(2, "16:00"), status="no-answer", duration=12)
        call(conn, "CA3", "incoming", t(2, "16:30"), status="in-progress")
        text(conn, "m1", "outgoing", t(2, "16:20"))
        events, _ = run_quo(conn)
        by = {e["sourceKey"]: e for e in events}
        self.assertEqual(set(by), {"quo:call:CA1", "quo:call:CA2"})
        self.assertEqual(by["quo:call:CA1"]["kind"], "call_answered")
        missed = by["quo:call:CA2"]
        self.assertEqual(missed["kind"], "call_missed")
        self.assertEqual(missed["respondedAt"], sc.iso(t(2, "16:20")))
        self.assertEqual(missed["responseVia"], "text")
        self.assertEqual(missed["details"], {"voicemail": True})


def mail(box, uid, when, frm, to="thomas@bookkeepingconroe.com", mid=None, refs="", **extra):
    return {"box": box, "uid": str(uid), "t": when, "message_id": mid,
            "from": [frm], "to": [to], "refs": set(sc.message_ids(refs)),
            "auto_submitted": extra.get("auto", ""), "precedence": extra.get("prec", ""),
            "list_unsubscribe": extra.get("unsub", False)}


ME = "thomas@bookkeepingconroe.com"
PAT = "pat@example.com"


class EmailTests(unittest.TestCase):
    def events(self, boxes, quo=None, rows=None):
        return sc.email_events(boxes, sc.Clients(rows or [client_row()]), quo or {})

    def test_thread_match(self):
        boxes = {"INBOX": [mail("INBOX", 1, t(2, "15:00"), PAT, mid="<a@x>")],
                 "Sent": [mail("Sent", 9, t(2, "17:00"), ME, to="other@example.com",
                               mid="<r@me>", refs="<a@x>")]}
        ev = self.events(boxes)
        self.assertEqual(len(ev), 1)
        self.assertEqual(ev[0]["details"], {"match": "thread"})
        self.assertEqual(ev[0]["respondedAt"], sc.iso(t(2, "17:00")))
        self.assertTrue(ev[0]["sourceKey"].startswith("zoho:email:"))
        self.assertEqual(len(ev[0]["sourceKey"]), len("zoho:email:") + 16)

    def test_address_match_within_seven_days(self):
        boxes = {"INBOX": [mail("INBOX", 1, t(2, "15:00"), PAT, mid="<a@x>"),
                           mail("INBOX", 2, t(20, "15:00"), PAT, mid="<b@x>")],
                 "Sent": [mail("Sent", 9, t(3, "15:00"), ME, to=PAT, mid="<r@me>"),
                          mail("Sent", 10, t(29, "15:00"), ME, to=PAT, mid="<s@me>")]}
        ev = self.events(boxes)
        self.assertEqual(ev[0]["details"], {"match": "address"})
        self.assertEqual(ev[0]["respondedAt"], sc.iso(t(3, "15:00")))
        self.assertIsNone(ev[1]["respondedAt"])  # 9 days later, no thread

    def test_quo_contact_answers_email(self):
        boxes = {"INBOX": [mail("INBOX", 1, t(2, "15:00"), PAT, mid="<a@x>")],
                 "Sent": [mail("Sent", 9, t(3, "15:00"), ME, to=PAT, mid="<r@me>")]}
        ev = self.events(boxes, quo={CLIENT: [(t(2, "15:30"), "call")]})
        self.assertEqual(ev[0]["responseVia"], "call")
        self.assertEqual(ev[0]["respondedAt"], sc.iso(t(2, "15:30")))

    def test_burst_and_dedupe_across_folders(self):
        boxes = {"INBOX": [mail("INBOX", 1, t(2, "15:00"), PAT, mid="<a@x>"),
                           mail("INBOX", 2, t(2, "15:10"), PAT, mid="<b@x>")],
                 "Archive": [mail("Archive", 7, t(2, "15:00"), PAT, mid="<a@x>")],
                 "Sent": [mail("Sent", 9, t(2, "16:00"), ME, to=PAT, mid="<r@me>", refs="<b@x>")]}
        ev = self.events(boxes)
        self.assertEqual(len(ev), 1)
        self.assertEqual(ev[0]["details"], {"match": "thread", "burst": 2})

    def test_own_addresses_and_bulk_are_skipped(self):
        rows = [client_row(emails=[PAT, "tom@southwestdigital.io"])]
        boxes = {"INBOX": [mail("INBOX", 1, t(2, "15:00"), "tom@southwestdigital.io", mid="<o@x>"),
                           mail("INBOX", 2, t(3, "15:00"), PAT, mid="<u@x>", unsub=True),
                           mail("INBOX", 3, t(4, "15:00"), PAT, mid="<v@x>", auto="auto-replied"),
                           mail("INBOX", 4, t(5, "15:00"), PAT, mid="<w@x>", prec="bulk"),
                           mail("INBOX", 5, t(6, "15:00"), PAT, mid="<n@x>", auto="no")],
                 "Sent": []}
        ev = self.events(boxes, rows=rows)
        self.assertEqual(len(ev), 1)
        self.assertEqual(ev[0]["startedAt"], sc.iso(t(6, "15:00")))

    def test_parse_headers(self):
        raw = (b"From: Pat <PAT@Example.com>\r\nTo: thomas@bookkeepingconroe.com\r\n"
               b"Date: Mon, 02 Mar 2026 09:00:00 -0600\r\nMessage-ID: <a@x>\r\n"
               b"References: <p@x>\r\n <q@x>\r\nList-Unsubscribe: <mailto:u@x>\r\n\r\n")
        rec = sc.parse_headers(raw, "INBOX", "1")
        self.assertEqual(rec["from"], [PAT])
        self.assertEqual(rec["t"], t(2, "15:00"))
        self.assertEqual(rec["refs"], {"<p@x>", "<q@x>"})
        self.assertTrue(sc.is_bulk(rec))


class WindowTests(unittest.TestCase):
    def test_keep_recent_and_open(self):
        now = t(30, "12:00")
        evs = [{"startedAt": sc.iso(t(1, "12:00")), "respondedAt": sc.iso(t(1, "13:00"))},
               {"startedAt": sc.iso(t(1, "12:00")), "respondedAt": None},
               {"startedAt": sc.iso(t(25, "12:00")), "respondedAt": sc.iso(t(25, "13:00"))}]
        self.assertEqual(len(sc.keep(evs, now, False)), 2)
        self.assertEqual(len(sc.keep(evs, now, True)), 3)


if __name__ == "__main__":
    unittest.main()
