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

    def test_history_reviews_have_their_own_cap_so_new_mail_has_room(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = donna.LocalStore(tmp)
            store.daily_limit = 3
            store.background_limit = 1
            store.reserve_review(background=True)
            with self.assertRaisesRegex(RuntimeError, "history review limit"):
                store.reserve_review(background=True)
            store.reserve_review()
            store.reserve_review()
            with self.assertRaisesRegex(RuntimeError, "Daily review limit"):
                store.reserve_review()
            store.db.close()

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
            def reserve_review(self, **kwargs):
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
            def reserve_review(self, **kwargs): pass
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

    def test_filing_plan_protects_contacts_and_refuses_trash(self):
        messages = [{"from": "client@example.com", "outgoing": False, "folder": "INBOX"}]
        contacts = [{"email": "client@example.com"}]
        folders = [{"folder": "Spam"}, {"folder": "Newsletter"}]
        assessment = [{"fileTo": "Spam", "reply": None, "category": "noise"}]
        dest, reason = donna.filing_plan(assessment, messages, contacts, folders)
        self.assertIsNone(dest)
        self.assertEqual(reason, "known contact")
        self.assertIsNone(donna.resolve_file_dest("Trash", folders))
        self.assertEqual(donna.resolve_file_dest("newsletter", folders), "Newsletter")
        dest, reason = donna.filing_plan(
            [{"fileTo": "Newsletter", "reply": "Hi", "category": "noise"}],
            [{"from": "promo@shop.example", "outgoing": False, "folder": "INBOX"}],
            [],
            folders,
        )
        self.assertIsNone(dest)
        self.assertEqual(reason, "reply needed")

    def clean_fixture(self, tmp):
        store = donna.LocalStore(tmp)
        noise = message("<promo@example.com>", "Sale", sender="promo@shop.example")
        client_msg = message("<client@example.com>", "Report", sender="client@example.com")
        archived = message("<old@example.com>", "Old", sender="promo@shop.example")
        store.save("box", "INBOX", "1", 11, noise.as_bytes(), "ours@example.com", Helper)
        store.save("box", "INBOX", "1", 12, client_msg.as_bytes(), "ours@example.com", Helper)
        store.save("box", "Archive", "1", 13, archived.as_bytes(), "ours@example.com", Helper)
        store.db.commit()
        return store

    BY_SENDER = {
        "promo@shop.example": [{"key": "promo", "title": "Shop sale", "category": "noise", "owner": "Donna",
                                "state": "needs-you", "urgent": False, "summary": "Promo", "recommendation": "File",
                                "nextAction": "File to Newsletter", "reply": None, "dueAt": None,
                                "followUpAt": None, "waitingOn": None, "fileTo": "Newsletter"}],
        "client@example.com": [{"key": "report", "title": "Client report", "category": "client", "owner": "Donna",
                                "state": "needs-you", "urgent": False, "summary": "Needs reply",
                                "recommendation": "Draft", "nextAction": "Review draft",
                                "reply": "Here is the report.", "dueAt": None, "followUpAt": None,
                                "waitingOn": None, "fileTo": "Spam"}],
    }
    FOLDERS = {"folders": [{"folder": "INBOX", "messages": 2}, {"folder": "Newsletter", "messages": 10}], "gaps": []}

    def run_clean(self, store, options, filer=None, heartbeat_answer=None, job_id="j"):
        calls = []

        class Client:
            def call(self, op, **data):
                calls.append((op, data))
                if op == "heartbeat" and heartbeat_answer:
                    return heartbeat_answer(data)
                return {}

        def fake_assess(messages, existing, root, contacts=None, extra=""):
            return self.BY_SENDER[email.utils.parseaddr(messages[0]["from"])[1].lower()]

        work = {
            "job": {"id": job_id, "leaseToken": "l", "kind": "clean", "options": options},
            "mailbox": {"id": "box", "address": "ours@example.com"},
            "requests": [],
            "contacts": [{"email": "client@example.com", "_count": {"serviceRecords": 1}}],
            "filer": filer or (lambda *a: (_ for _ in ()).throw(AssertionError("must not file"))),
        }
        with patch.object(store, "inventory", return_value=self.FOLDERS), \
                patch.object(donna, "assess", side_effect=fake_assess):
            donna.process_job(Client(), store, work, 10)
        return calls

    def test_clean_preview_moves_nothing_and_records_the_plan(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = self.clean_fixture(tmp)
            calls = self.run_clean(store, {"preview": True})
            published = [data["packet"] for op, data in calls if op == "publish"]
            self.assertEqual(len(published), 2)
            self.assertFalse(any(r["state"] == "handled" for p in published for r in p["requests"]))
            self.assertNotIn("filed", [a["kind"] for p in published for a in p["activities"]])
            result = next(data["result"] for op, data in calls if op == "complete")
            report = result["report"]
            self.assertTrue(report["preview"])
            self.assertFalse(result["cancelled"])
            self.assertEqual([(i["folder"], i["subject"]) for i in report["filed"]], [("Newsletter", "Sale")])
            self.assertTrue(report["filed"][0]["thread"])
            self.assertEqual(report["needsYou"][0]["title"], "Client report")
            self.assertEqual(report["skipped"][0]["reason"], "known contact")
            self.assertEqual(result["coverage"]["clean"], report)
            self.assertNotIn("remaining_threads", result["coverage"])
            row = store.db.execute("SELECT folder FROM clean_plans WHERE job='j'").fetchall()
            self.assertEqual([r[0] for r in row], ["Newsletter"])
            store.db.close()

    def test_clean_preview_rereviews_threads_already_assessed(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = self.clean_fixture(tmp)
            for thread, fingerprint, _, _ in store.threads("box", []):
                store.db.execute("INSERT INTO assessments VALUES ('box',?,?)", (thread, fingerprint))
            store.db.commit()
            self.assertEqual(store.threads("box", []), [])
            report = next(d["result"]["report"] for op, d in self.run_clean(store, {"preview": True}) if op == "complete")
            self.assertEqual(len(report["filed"]), 1)
            store.db.close()

    def test_approved_plan_files_and_records_each_move(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = self.clean_fixture(tmp)
            preview = next(d["result"]["report"] for op, d in self.run_clean(store, {"preview": True}) if op == "complete")
            thread = preview["filed"][0]["thread"]
            moves = []
            calls = self.run_clean(store, {"previewJobId": "j", "plan": [{"thread": thread, "folder": "Newsletter"}]},
                                   filer=lambda uid, dest, mid: moves.append((uid, dest, mid)), job_id="real")
            self.assertEqual(moves, [(11, "Newsletter", "<promo@example.com>")])
            packet = next(d["packet"] for op, d in calls if op == "publish")
            self.assertEqual(packet["requests"][0]["state"], "handled")
            self.assertEqual(packet["requests"][0]["completionNote"], "Filed to Newsletter.")
            self.assertTrue(packet["requests"][0]["sourceVersion"].endswith(":filed"))
            self.assertIn("filed", [a["kind"] for a in packet["activities"]])
            report = next(d["result"]["report"] for op, d in calls if op == "complete")
            self.assertFalse(report["preview"])
            self.assertEqual(report["filed"][0]["messages"], ["<promo@example.com>"])
            self.assertEqual(store.filed_for("real")[0]["folder"], "Newsletter")
            # A rerun of the same job (after a pause) never files twice.
            again = self.run_clean(store, {"previewJobId": "j", "plan": [{"thread": thread}]}, job_id="real")
            self.assertEqual(len(next(d["result"]["report"] for op, d in again if op == "complete")["filed"]), 1)
            store.db.close()

    def test_plan_skips_changed_unknown_and_kept_threads(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = self.clean_fixture(tmp)
            preview = next(d["result"]["report"] for op, d in self.run_clean(store, {"preview": True}) if op == "complete")
            thread = preview["filed"][0]["thread"]
            store.db.execute("UPDATE clean_plans SET fingerprint='old' WHERE thread=?", (thread,))
            store.db.commit()
            calls = self.run_clean(store, {"previewJobId": "j", "plan": [{"thread": thread}, {"thread": "nope"}]},
                                   job_id="r1")
            reasons = [i["reason"] for i in next(d["result"]["report"] for op, d in calls if op == "complete")["skipped"]]
            self.assertEqual(reasons, ["changed since the preview", "no preview record on Ripley"])
            store.db.execute("DELETE FROM clean_plans")
            store.db.execute("INSERT INTO kept_in_inbox VALUES ('box',?)", (thread,))
            store.db.commit()
            again = next(d["result"]["report"] for op, d in self.run_clean(store, {"preview": True}) if op == "complete")
            self.assertEqual(again["filed"], [])
            self.assertIn("you moved it back to Inbox", [i["reason"] for i in again["skipped"]])
            store.db.close()

    def test_clean_files_on_its_own_and_does_not_rereview_decided_mail(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = self.clean_fixture(tmp)
            moves = []
            calls = self.run_clean(store, {"manual": True}, filer=lambda uid, dest, mid: moves.append((uid, dest, mid)))
            self.assertEqual(moves, [(11, "Newsletter", "<promo@example.com>")])
            result = next(d["result"] for op, d in calls if op == "complete")
            self.assertFalse(result["report"]["preview"])
            self.assertEqual(result["report"]["filed"][0]["messages"], ["<promo@example.com>"])
            self.assertEqual(result["report"]["skipped"][0]["reason"], "known contact")
            packets = [d["packet"] for op, d in calls if op == "publish"]
            filed = next(p for p in packets if p["requests"][0]["state"] == "handled")
            self.assertTrue(filed["requests"][0]["sourceVersion"].endswith(":filed"))
            self.assertEqual(store.filed_for("j")[0]["folder"], "Newsletter")
            # The client thread was decided (stays); a later Clean does not review it again.
            calls = []
            class Client:
                def call(self, op, **data):
                    calls.append((op, data))
                    return {}
            work = {"job": {"id": "j2", "leaseToken": "l", "kind": "clean", "options": {"auto": True}},
                    "mailbox": {"id": "box", "address": "ours@example.com"}, "requests": [],
                    "contacts": [{"email": "client@example.com", "_count": {"serviceRecords": 1}}]}
            with patch.object(store, "inventory", return_value=self.FOLDERS), \
                    patch.object(donna, "assess", side_effect=AssertionError("no re-review")):
                donna.process_job(Client(), store, work, 10)
            report = next(d["result"]["report"] for op, d in calls if op == "complete")
            self.assertEqual((report["reviewed"], report["filed"]), (0, []))
            store.db.close()

    def test_unreadable_attachment_blocks_filing_only_when_mail_could_matter(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = donna.LocalStore(tmp)
            for uid, key, sender in [(21, "<logo@x>", "promo@shop.example"), (22, "<odd@x>", "who@unknown.example")]:
                msg = message(key, "Hello", sender=sender)
                msg.add_attachment(b"\x89PNG", maintype="image", subtype="png", filename="logo.png")
                store.save("box", "INBOX", "1", uid, msg.as_bytes(), "ours@example.com", Helper)
            store.db.commit()
            unknown = dict(self.BY_SENDER["promo@shop.example"][0], key="odd", category="unknown")
            moves = []
            with patch.dict(self.BY_SENDER, {"who@unknown.example": [unknown]}):
                calls = self.run_clean(store, {"manual": True}, filer=lambda uid, dest, mid: moves.append(uid))
            self.assertEqual(moves, [21])
            report = next(d["result"]["report"] for op, d in calls if op == "complete")
            self.assertEqual([i["reason"] for i in report["skipped"]], ["attachment review needed"])
            store.db.close()

    def test_cancel_stops_before_the_next_move_and_reports_what_moved(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = self.clean_fixture(tmp)
            extra = message("<promo2@example.com>", "Another sale", sender="promo@shop.example")
            store.save("box", "INBOX", "1", 14, extra.as_bytes(), "ours@example.com", Helper)
            store.db.commit()
            preview = next(d["result"]["report"] for op, d in self.run_clean(store, {"preview": True}) if op == "complete")
            plan = [{"thread": i["thread"]} for i in preview["filed"]]
            self.assertEqual(len(plan), 2)
            moves = []
            calls = self.run_clean(store, {"previewJobId": "j", "plan": plan},
                                   filer=lambda *a: moves.append(a), job_id="real",
                                   heartbeat_answer=lambda data: {"cancelled": bool(moves)})
            self.assertEqual(len(moves), 1)
            result = next(d["result"] for op, d in calls if op == "complete")
            self.assertTrue(result["cancelled"])
            self.assertEqual(len(result["report"]["filed"]), 1)
            store.db.close()

    def test_pause_mid_clean_stops_without_failing_the_job(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = self.clean_fixture(tmp)

            def paused(data):
                raise donna.DonnaAPIError("heartbeat", 409)
            calls = self.run_clean(store, {"preview": True}, heartbeat_answer=paused)
            self.assertFalse(any(op in ("complete", "fail", "publish") for op, _ in calls))
            store.db.close()

    def test_undo_moves_recorded_mail_back_and_keeps_it_in_inbox(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = self.clean_fixture(tmp)
            preview = next(d["result"]["report"] for op, d in self.run_clean(store, {"preview": True}) if op == "complete")
            thread = preview["filed"][0]["thread"]
            self.run_clean(store, {"previewJobId": "j", "plan": [{"thread": thread}]},
                           filer=lambda *a: None, job_id="real")
            back = []
            calls = []

            class Client:
                def call(self, op, **data):
                    calls.append((op, data))
                    return {}
            work = {"job": {"id": "u", "leaseToken": "l", "kind": "undo",
                            "options": {"cleanJobId": "real", "threads": [thread, "missing"]}},
                    "mailbox": {"id": "box", "address": "ours@example.com"}, "requests": [],
                    "unfiler": lambda folder, key: back.append((folder, key))}
            donna.process_job(Client(), store, work, 10)
            self.assertEqual(back, [("Newsletter", "<promo@example.com>")])
            undo = next(d["result"]["undo"] for op, d in calls if op == "complete")
            self.assertEqual(undo["undone"], [thread])
            self.assertEqual(undo["failed"][0]["thread"], "missing")
            self.assertTrue(store.kept("box", thread))
            payload = json.loads(store.db.execute("SELECT payload FROM messages WHERE key='<promo@example.com>'").fetchone()[0])
            self.assertEqual(payload["folder"], "INBOX")
            store.db.close()

    def test_clean_ignores_non_inbox_threads(self):
        class Store:
            root = "/tmp"
            deferred = 0
            def reserve_review(self, **kwargs):
                raise AssertionError("Archive mail must not be reviewed during Clean")
            def inventory(self, *args):
                return {"folders": [{"folder": "Archive", "messages": 1}], "gaps": []}
            def threads(self, *args, **kwargs):
                return [("archived", "hash", [{"folder": "Archive", "outgoing": False}], [])]
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
        work = {"job": {"id": "j", "leaseToken": "l", "kind": "clean"},
                "mailbox": {"id": "box", "address": "ours@example.com"}, "requests": []}
        donna.process_job(Client(), Store(), work, 10)
        self.assertFalse(any(op == "publish" for op, _ in calls))
        coverage = next(data["result"]["coverage"] for op, data in calls if op == "complete")
        self.assertEqual(coverage["clean"]["reviewed"], 0)
        self.assertEqual(coverage["clean"]["remaining"], 0)


if __name__ == "__main__":
    unittest.main()
