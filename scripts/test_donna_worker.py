import email
import email.policy
from email.message import EmailMessage
import json
from pathlib import Path
import tempfile
import unittest
import os
import datetime as dt
from unittest.mock import patch

import donna_worker as donna


def message(key, subject="Question", reply_to=None, sender="client@example.com"):
    msg = EmailMessage()
    msg["Message-ID"] = key
    msg["From"] = sender
    msg["To"] = "thomas@bookkeepingconroe.com"
    msg["Date"] = "Tue, 24 Nov 2026 10:00:00 -0600"
    msg["Subject"] = subject
    if reply_to:
        msg["References"] = reply_to
        msg["In-Reply-To"] = reply_to
    msg.set_content("Please send the corrected report. Thank you.")
    return msg


class Helper:
    @staticmethod
    def body_text(msg, limit):
        return msg.get_body(preferencelist=("plain",)).get_content()[:limit]


class WorkerTests(unittest.TestCase):
    def test_cache_uses_server_validity_and_far_to_near_uid_mapping(self):
        with tempfile.TemporaryDirectory() as tmp:
            box = Path(tmp) / "INBOX"
            (box / "cur").mkdir(parents=True)
            (box / "new").mkdir()
            (box / ".mbsyncstate").write_text("FarUidValidity 17\nNearUidValidity 2\n\n100 5 S\n")
            (box / "cur/test,U=5:2,S").write_bytes(b"cached message")
            with patch.dict(os.environ, {"DONNA_MAILDIR": tmp}):
                self.assertEqual(set(donna.LocalStore.cached_messages("INBOX", "17")), {100})
                self.assertEqual(donna.LocalStore.cached_messages("INBOX", "18"), {})
                self.assertEqual(donna.LocalStore.cached_messages("../outside", "17"), {})

    def test_review_budget_survives_restarts_and_counts_failed_attempts(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = donna.LocalStore(tmp)
            store.daily_limit = 1
            store.reserve_review()
            store.db.close()
            resumed = donna.LocalStore(tmp)
            resumed.daily_limit = 1
            with self.assertRaisesRegex(RuntimeError, "Daily review limit"):
                resumed.reserve_review()
            resumed.db.close()

    def test_reply_and_original_share_identity_without_subject_guessing(self):
        original = message("<root@example.com>")
        reply = message("<reply@example.com>", "Re: Question", "<root@example.com>", "thomas@bookkeepingconroe.com")
        other = message("<other@example.com>", "Question")
        self.assertEqual(donna.thread_identity(original, original["Message-ID"]), donna.thread_identity(reply, reply["Message-ID"]))
        self.assertNotEqual(donna.thread_identity(original, original["Message-ID"]), donna.thread_identity(other, other["Message-ID"]))

    def test_new_enquiry_is_not_starved_by_historical_client_backlog(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = donna.LocalStore(tmp)
            old = message("<old-client@example.com>", sender="client@example.com")
            old.replace_header("Date", "Sun, 01 Nov 2026 10:00:00 -0600")
            fresh = message("<new-prospect@example.com>", sender="prospect@example.com")
            fresh.replace_header("Date", "Wed, 25 Nov 2026 13:00:00 -0600")
            store.save("box", "INBOX", "1", 1, old.as_bytes(), "ours@example.com", Helper)
            store.save("box", "INBOX", "1", 2, fresh.as_bytes(), "ours@example.com", Helper)
            contacts = [{"email": "client@example.com", "_count": {"serviceRecords": 1}}]
            pending = store.threads("box", [], contacts, now=dt.datetime(2026, 11, 25, 20, tzinfo=dt.timezone.utc))
            self.assertEqual(pending[0][2][0]["key"], "<new-prospect@example.com>")
            store.db.close()

    def test_move_or_retry_retains_one_message_and_full_sent_context(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = donna.LocalStore(tmp)
            original = message("<root@example.com>").as_bytes()
            sent = message("<reply@example.com>", "Re: Question", "<root@example.com>", "thomas@bookkeepingconroe.com").as_bytes()
            store.save("box", "INBOX", "1", 1, original, "thomas@bookkeepingconroe.com", Helper)
            store.save("box", "Archive", "7", 22, original, "thomas@bookkeepingconroe.com", Helper)
            store.save("box", "Sent", "1", 3, sent, "thomas@bookkeepingconroe.com", Helper)
            self.assertEqual(store.db.execute("SELECT count(*) FROM messages").fetchone()[0], 2)
            threads = store.threads("box", [])
            self.assertEqual(len(threads), 1)
            self.assertEqual(len(threads[0][2]), 2)
            self.assertTrue(any(m["outgoing"] for m in threads[0][2]))
            thread, fingerprint, _, _ = threads[0]
            store.db.execute("INSERT INTO assessments VALUES (?,?,?)", ("box", thread, fingerprint))
            existing = [{"sourceKey": thread + ":report", "direction": None, "version": 1}]
            self.assertEqual(store.threads("box", existing), [])
            existing[0]["direction"] = "Use the corrected figures."
            self.assertEqual(len(store.threads("box", existing)), 1)
            store.db.close()

    def test_attachment_name_cannot_escape_private_source_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = donna.LocalStore(tmp)
            msg = message("<files@example.com>")
            msg.add_attachment(b"untrusted", maintype="application", subtype="octet-stream", filename="../../outside.exe")
            store.save("box", "INBOX", "1", 4, msg.as_bytes(), "thomas@bookkeepingconroe.com", Helper)
            row = json.loads(store.db.execute("SELECT payload FROM messages").fetchone()[0])
            self.assertIn("gap", row["attachments"][0])
            self.assertEqual(len(list((Path(tmp) / "messages/box").glob("*.eml"))), 1)
            self.assertFalse((Path(tmp) / "outside.exe").exists())
            store.db.close()

    def test_unsent_draft_never_counts_as_an_answer(self):
        messages = [{"key": "m1", "from": "client@example.com", "to": "ours@example.com", "subject": "Question",
                     "at": "2026-11-25T10:00:00Z", "outgoing": False, "draft": False,
                     "body": "Please help", "folder": "INBOX", "attachments": []},
                    {"key": "d1", "from": "ours@example.com", "to": "client@example.com", "subject": "Re: Question",
                     "at": "2026-11-25T11:00:00Z", "outgoing": True, "draft": True,
                     "body": "Unsent answer", "folder": "Drafts", "attachments": []}]
        assessment = {"key": "help", "title": "Help client", "category": "client", "owner": "Donna",
                      "state": "needs-you", "urgent": False, "summary": "Needs help", "recommendation": "Reply",
                      "nextAction": "Review draft", "reply": "Prepared answer", "dueAt": None, "followUpAt": None, "waitingOn": None}
        work = {"job": {"id": "j", "leaseToken": "l"}, "mailbox": {"address": "ours@example.com"}}
        packet = donna.packet_for(work, "thread", "fingerprint", messages, [], [assessment])
        self.assertIsNone(packet["requests"][0]["answeredAt"])
        self.assertNotIn("sent", [a["kind"] for a in packet["activities"]])

    def test_partial_job_is_not_complete_and_does_not_touch_live_mail(self):
        class Store:
            root = "/tmp"
            def reserve_review(self):
                pass
            def inventory(self, *args):
                return {"gaps": []}
            def threads(self, *args):
                return [("a", "hash", [], []), ("b", "hash", [], [])]
            class DB:
                def execute(self, *args):
                    pass
                def commit(self):
                    pass
            db = DB()
        calls = []
        class Client:
            def call(self, op, **data):
                calls.append((op, data))
                return {}
        work = {"job": {"id": "j", "leaseToken": "l"}, "mailbox": {"id": "box", "address": "ours@example.com"}, "requests": []}
        with patch.object(donna, "assess", return_value=[]), patch.object(donna, "packet_for", return_value={}):
            donna.process_job(Client(), Store(), work, 1)
        result = [c for op, c in calls if op == "complete"][0]["result"]["coverage"]
        self.assertEqual(result["remaining_threads"], 1)
        self.assertFalse(result["coverage_complete"])
        self.assertFalse(result["sending_enabled"])

    def test_one_failed_conversation_does_not_block_other_mail(self):
        class Store:
            root = "/tmp"
            failures = []
            def reserve_review(self): pass
            def inventory(self, *args): return {"gaps": []}
            def threads(self, *args): return [("broken", "h1", [], []), ("good", "h2", [], [])]
            def record_failure(self, *args): self.failures.append(args)
            class DB:
                def execute(self, *args): pass
                def commit(self): pass
            db = DB()
        calls = []
        class Client:
            def call(self, op, **data): calls.append((op, data)); return {}
        store = Store()
        work = {"job": {"id": "j", "leaseToken": "l"}, "mailbox": {"id": "box", "address": "ours@example.com"}, "requests": []}
        with patch.object(donna, "assess", side_effect=[RuntimeError("Oversized conversation"), []]), patch.object(donna, "packet_for", return_value={}):
            donna.process_job(Client(), store, work, 2)
        self.assertEqual(len(store.failures), 1)
        self.assertEqual(sum(op == "publish" for op, _ in calls), 1)
        self.assertFalse(any(op == "fail" for op, _ in calls))
        coverage = next(data["result"]["coverage"] for op, data in calls if op == "complete")
        self.assertEqual(coverage["threads_reviewed_this_pass"], 1)
        self.assertEqual(coverage["remaining_threads"], 1)
        self.assertEqual(coverage["deferred_threads"], 1)
        self.assertEqual(coverage["ready_threads"], 0)
        self.assertFalse(coverage["coverage_complete"])


if __name__ == "__main__":
    unittest.main()
