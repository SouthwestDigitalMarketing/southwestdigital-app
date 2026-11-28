"""`mail spam <numbers> --block` reports spam, unsubscribes, and sweeps.

One flag does the whole triage: the named messages move to Spam, their
List-Unsubscribe links fire, and every message from those senders is
swept into Spam too. IMAP is mocked at the connection; nothing here
touches a real mailbox.
"""
import contextlib
import importlib.util
import io
import unittest
from pathlib import Path
from unittest import mock

SPEC = importlib.util.spec_from_loader(
    "mailroom_mail",
    importlib.machinery.SourceFileLoader(
        "mailroom_mail", str(Path(__file__).parents[1] / "bin" / "mail")))
mail = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mail)


class FakeConn:
    """One account: INBOX holds the mail, Spam takes the reports."""

    def __init__(self):
        self.capabilities = [b"IMAP4rev1", b"MOVE", b"UIDPLUS"]
        self.moved = []
        self.selected = None

    def select(self, box, readonly=False):
        self.selected = box
        return "OK", [b"1"]

    def list(self):
        return "OK", [b'(\\HasNoChildren \\Junk) "/" "Spam"',
                      b'(\\HasNoChildren) "/" "INBOX"']

    def uid(self, command, uid, dest):
        self.moved.append((command, str(uid), dest))
        return "OK", [b"moved"]

    def logout(self):
        pass


def run_block(entries, targets, sweep_items, conn, numbers="n1,n2"):
    out = io.StringIO()
    with mock.patch.object(mail, "registry_entries",
                           return_value=(entries, None)), \
         mock.patch.object(mail, "unsub_target",
                           side_effect=lambda n, e: targets[n]), \
         mock.patch.object(mail, "do_unsubscribe",
                           return_value="unsubscribed"), \
         mock.patch.object(mail, "record_unsub"), \
         mock.patch.object(mail, "connect",
                           return_value=(conn, {"spam": "Spam"})), \
         mock.patch.object(mail, "accounts",
                           return_value={"zoho": {}}), \
         mock.patch.object(mail, "fetch_sender",
                           return_value=(sweep_items, {}, [])), \
         contextlib.redirect_stdout(out):
        try:
            mail.cmd_spam_block(
                mail.argparse.Namespace(numbers=numbers, block=True))
        except SystemExit as stopped:
            return stopped.code, out.getvalue()
        return 0, out.getvalue()


class SpamBlockTests(unittest.TestCase):
    def test_block_moves_unsubs_and_sweeps(self):
        entries = {
            1: ("zoho|id:a", {"account": "zoho", "uid": "101",
                              "box": "INBOX", "subject": "Deal"}),
            2: ("zoho|id:b", {"account": "zoho", "uid": "102",
                              "box": "INBOX", "subject": "More deals"}),
        }
        targets = {
            1: ("bulk@example.test", "Bulk", "Deal",
                "https://list.test/u", True),
            2: ("bulk@example.test", "Bulk", "More deals",
                "https://list.test/u", True),
        }
        sweep = [{"account": "zoho", "uid": "109", "box": "INBOX",
                  "subject": "Older deal", "message_no": 9}]
        conn = FakeConn()
        code, text = run_block(entries, targets, sweep, conn)
        self.assertEqual(code, 0)
        moves = [call for call in conn.moved if call[0] == "MOVE"]
        self.assertEqual(
            sorted(uid for _, uid, _ in moves), ["101", "102", "109"])
        self.assertTrue(all(dest == '"Spam"' for _, _, dest in moves))
        self.assertIn("unsubscribing 1,2:", text)
        self.assertIn("marked spam message 1 -> Spam: Deal", text)
        self.assertIn("sweeping 1 message(s) from bulk@example.test", text)
        self.assertIn("future mail from bulk@example.test", text)

    def test_same_link_fires_once(self):
        entries = {
            1: ("zoho|id:a", {"account": "zoho", "uid": "101",
                              "box": "INBOX", "subject": "Deal"}),
            2: ("zoho|id:b", {"account": "zoho", "uid": "102",
                              "box": "INBOX", "subject": "More"}),
        }
        target = ("bulk@example.test", "Bulk", "Deal",
                  "https://list.test/u", True)
        conn = FakeConn()
        out = io.StringIO()
        with mock.patch.object(mail, "registry_entries",
                               return_value=(entries, None)), \
             mock.patch.object(mail, "unsub_target",
                               return_value=target), \
             mock.patch.object(mail, "do_unsubscribe",
                               return_value="unsubscribed") as fired, \
             mock.patch.object(mail, "record_unsub"), \
             mock.patch.object(mail, "connect",
                               return_value=(conn, {"spam": "Spam"})), \
             mock.patch.object(mail, "accounts",
                               return_value={"zoho": {}}), \
             mock.patch.object(mail, "fetch_sender",
                               return_value=([], {}, [])), \
             contextlib.redirect_stdout(out):
            mail.cmd_spam_block(
                mail.argparse.Namespace(numbers="1,2", block=True))
        fired.assert_called_once_with("https://list.test/u", True)
        self.assertIn("method for 1,2:", out.getvalue())

    def test_message_without_link_still_gets_reported_and_swept(self):
        entries = {
            1: ("zoho|id:a", {"account": "zoho", "uid": "101",
                              "box": "INBOX", "subject": "Hey"}),
        }
        targets = {1: ("pal@example.test", "Pal", "Hey", None, False)}
        conn = FakeConn()
        code, text = run_block(entries, targets, [], conn, numbers="n1")
        self.assertEqual(code, 0)
        self.assertIn("cannot unsubscribe 1:", text)
        self.assertIn("marked spam message 1 -> Spam: Hey", text)
        self.assertIn("no mail from pal@example.test in INBOX", text)

    def test_unknown_number_exits_before_anything_fires(self):
        conn = FakeConn()
        out = io.StringIO()
        with mock.patch.object(mail, "registry_entries",
                               return_value=({}, None)), \
             mock.patch.object(mail, "connect",
                               return_value=(conn, {})), \
             mock.patch.object(mail, "do_unsubscribe") as fired, \
             contextlib.redirect_stdout(out):
            with self.assertRaises(SystemExit):
                mail.cmd_spam_block(
                    mail.argparse.Namespace(numbers="1", block=True))
        fired.assert_not_called()
        self.assertEqual(conn.moved, [])

    def test_row_already_in_spam_is_skipped_not_moved(self):
        entries = {
            1: ("zoho|id:a", {"account": "zoho", "uid": "101",
                              "box": "Spam", "subject": "Deal"}),
        }
        targets = {1: ("bulk@example.test", "Bulk", "Deal", None, False)}
        conn = FakeConn()
        code, text = run_block(entries, targets, [], conn, numbers="n1")
        self.assertEqual(code, 0)
        self.assertEqual(conn.moved, [])
        self.assertIn("already in Spam; skipped", text)


class SpamDispatchTests(unittest.TestCase):
    def test_numbers_without_block_point_at_block(self):
        with self.assertRaises(SystemExit) as stopped:
            mail.cmd_spam(mail.argparse.Namespace(
                numbers="1,2", block=False, no_interactive=True,
                account=None, n=40, per=50, unseen=False, hours=None))
        self.assertIn("--block", str(stopped.exception))

    def test_block_without_numbers_asks_for_them(self):
        with self.assertRaises(SystemExit) as stopped:
            mail.cmd_spam(mail.argparse.Namespace(
                numbers=None, block=True, no_interactive=True,
                account=None, n=40, per=50, unseen=False, hours=None))
        self.assertIn("needs message numbers", str(stopped.exception))


if __name__ == "__main__":
    unittest.main()
