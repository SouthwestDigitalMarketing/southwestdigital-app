"""`mail stats` counts, and `mail empty` deletes for good.

These are opposite ends of the same risk. Stats must never fetch, mark or
move anything -- it exists to answer "how much mail is there" on a mailbox
too big to page through. Empty is the one irreversible command in the file,
so it counts first, shows the damage per account, and refuses to act on a
bare invocation.
"""
import contextlib
import importlib.machinery
import importlib.util
import io
import unittest
from pathlib import Path
from unittest import mock

SPEC = importlib.util.spec_from_loader(
    "mailroom_mail_stats",
    importlib.machinery.SourceFileLoader(
        "mailroom_mail_stats", str(Path(__file__).parents[1] / "bin" / "mail")))
mail = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mail)

TRASH_LIST = [b'(\\HasNoChildren) "/" "INBOX"',
              b'(\\HasNoChildren) "/" "[Gmail]/Trash"']


class Conn:
    """Enough IMAP to count and to empty, recording what was asked."""
    capabilities = [b"MOVE"]

    def __init__(self, counts=None, uids=b"1 2 3", rows=None,
                 select_ok=True):
        self.counts = counts or {"INBOX": (6476, 5318), "[Gmail]/Trash": (16, 0)}
        self.uids = uids
        self.rows = TRASH_LIST if rows is None else rows
        self.select_ok = select_ok
        self.selected, self.stored, self.expunged = [], [], 0
        self.readonly = []

    def status(self, box, items):
        name = box.strip('"')
        if name not in self.counts:
            return "NO", [b"no such mailbox"]
        messages, unseen = self.counts[name]
        return "OK", [b'"%s" (MESSAGES %d UNSEEN %d)'
                      % (name.encode(), messages, unseen)]

    def list(self):
        return "OK", self.rows

    def select(self, box, readonly=False):
        self.selected.append(box.strip('"'))
        self.readonly.append(readonly)
        return ("OK", [b"1"]) if self.select_ok else ("NO", [b"nope"])

    def uid(self, command, *rest):
        if command == "SEARCH":
            return "OK", [self.uids]
        if command == "STORE":
            self.stored.append(rest)
            return "OK", [b"done"]
        return "OK", [b"done"]

    def expunge(self):
        self.expunged += 1
        return "OK", [b"done"]

    def logout(self):
        pass


class CountingTests(unittest.TestCase):
    """STATUS answers from the server's own counters. A 15,000-message
    account is exactly where fetching headers to count them is wrong."""

    def test_status_counts_are_read_off_the_reply(self):
        self.assertEqual(mail.status_counts(Conn(), "INBOX"),
                         {"MESSAGES": 6476, "UNSEEN": 5318})

    def test_a_mailbox_the_server_will_not_report_is_empty_not_fatal(self):
        self.assertEqual(mail.status_counts(Conn(), "Nowhere"), {})

    def test_a_server_that_raises_on_status_is_empty_not_fatal(self):
        class Angry(Conn):
            def status(self, box, items):
                raise OSError("connection reset")
        self.assertEqual(mail.status_counts(Angry(), "INBOX"), {})

    def test_search_count_counts_the_uids(self):
        self.assertEqual(mail.search_count(Conn(), "INBOX", "FLAGGED"), 3)

    def test_search_count_reads_only(self):
        conn = Conn()
        mail.search_count(conn, "INBOX", "FLAGGED")
        self.assertEqual(conn.readonly, [True])

    def test_search_count_of_an_unopenable_mailbox_is_unknown_not_zero(self):
        """Zero would be a lie that reads as good news."""
        self.assertIsNone(
            mail.search_count(Conn(select_ok=False), "INBOX", "FLAGGED"))


class AccountStatsTests(unittest.TestCase):
    def test_a_full_row(self):
        with mock.patch.object(mail, "connect",
                               return_value=(Conn(),
                                             {"user": "t@g.com",
                                              "trash": "[Gmail]/Trash"})):
            row, err = mail.account_stats("gmail")
        self.assertIsNone(err)
        self.assertEqual((row["messages"], row["unseen"], row["flagged"],
                          row["trash"], row["trash_box"]),
                         (6476, 5318, 3, 16, "[Gmail]/Trash"))

    def test_an_account_with_no_trash_still_reports_its_inbox(self):
        conn = Conn(rows=[b'(\\HasNoChildren) "/" "INBOX"'])
        with mock.patch.object(mail, "connect",
                               return_value=(conn, {"user": "t@g.com",
                                                    "trash": "[Gmail]/Trash"})):
            row, err = mail.account_stats("gmail")
        self.assertIsNone(err)
        self.assertEqual(row["messages"], 6476)
        self.assertIsNone(row["trash_box"])
        self.assertIsNone(row["trash"])

    def test_an_account_that_is_down_is_reported_not_raised(self):
        with mock.patch.object(mail, "connect",
                               side_effect=OSError("no route to host")):
            row, err = mail.account_stats("gmail")
        self.assertIn("cannot sign in", err)
        self.assertIsNone(row["messages"])


class CmdStatsTests(unittest.TestCase):
    def stats(self, rows):
        args = mail.argparse.Namespace(account=None, box="INBOX")
        buf = io.StringIO()
        names = {"a%d" % i: {} for i in range(len(rows))}
        with mock.patch.object(mail, "resolve_account", side_effect=lambda v: v), \
             mock.patch.object(mail, "accounts", return_value=names), \
             mock.patch.object(mail, "account_stats", side_effect=rows), \
             mock.patch.object(mail, "record_stats_snapshot",
                               return_value=({"date": "2026-10-05",
                                              "accounts": {}}, [])), \
             contextlib.redirect_stdout(buf):
            mail.cmd_stats(args)
        return buf.getvalue()

    def row(self, address, messages, unseen, flagged, trash,
            trash_box="[Gmail]/Trash"):
        return ({"account": address, "address": address, "messages": messages,
                 "unseen": unseen, "flagged": flagged, "trash": trash,
                 "trash_box": trash_box}, None)

    def test_each_account_and_a_unified_total(self):
        text = self.stats([self.row("a@g.com", 100, 10, 1, 5),
                           self.row("b@g.com", 200, 20, 2, 7)])
        self.assertIn("a@g.com", text)
        self.assertIn("b@g.com", text)
        unified = [l for l in text.splitlines() if l.startswith("unified")][0]
        self.assertEqual(unified.split()[1:], ["300", "30", "3", "12"])

    def test_an_account_that_did_not_answer_is_said_out_loud(self):
        down = ({"account": "b", "address": "b@g.com", "messages": None,
                 "unseen": None, "flagged": None, "trash": None,
                 "trash_box": None}, "b: cannot sign in")
        text = self.stats([self.row("a@g.com", 100, 10, 1, 5), down])
        self.assertIn("cannot sign in", text)
        self.assertIn("totals are short", text)

    def test_a_missing_count_prints_as_unknown_not_zero(self):
        text = self.stats([self.row("a@g.com", 100, 10, None, None,
                                    trash_box=None)])
        self.assertIn("-", text)
        self.assertIn("no Trash visible over IMAP: a@g.com", text)


class CmdEmptyTests(unittest.TestCase):
    """The one irreversible command here. Every test below is about what
    it refuses to do."""

    def empty(self, conn=None, yes=False, answers=None, tty=True,
              acct=None):
        conn = conn or Conn()
        answers = iter(answers or [])
        args = mail.argparse.Namespace(account=None, yes=yes)
        buf = io.StringIO()
        buf.isatty = lambda: True
        with mock.patch.object(mail, "resolve_account", side_effect=lambda v: v), \
             mock.patch.object(mail, "accounts", return_value={"gmail": {}}), \
             mock.patch.object(mail, "connect",
                               return_value=(conn, acct or
                                             {"user": "t@g.com",
                                              "trash": "[Gmail]/Trash"})), \
             mock.patch.object(mail.sys.stdin, "isatty", return_value=tty), \
             mock.patch("builtins.input",
                        side_effect=lambda *a: next(answers)), \
             contextlib.redirect_stdout(buf):
            mail.cmd_empty(args)
        return conn, buf.getvalue()

    def test_yes_deletes_and_expunges(self):
        conn, text = self.empty(yes=True)
        self.assertEqual(conn.expunged, 1)
        self.assertIn("\\\\Deleted", str(conn.stored))
        self.assertIn("deleted 3 message(s)", text)

    def test_it_opens_the_trash_writable_and_never_touches_the_inbox(self):
        conn, _ = self.empty(yes=True)
        self.assertEqual(conn.selected[-1], "[Gmail]/Trash")
        self.assertNotIn("INBOX", conn.selected[len(conn.selected) - 1:])
        self.assertFalse(conn.readonly[-1])

    def test_a_bare_run_outside_a_terminal_refuses(self):
        with self.assertRaises(SystemExit) as stopped:
            self.empty(tty=False)
        self.assertIn("without --yes", str(stopped.exception))

    def test_saying_no_keeps_everything(self):
        conn, text = self.empty(answers=["1", "n"])
        self.assertEqual(conn.expunged, 0)
        self.assertEqual(conn.stored, [])
        self.assertIn("kept everything", text)

    def test_saying_yes_at_the_prompt_goes_ahead(self):
        conn, text = self.empty(answers=["1", "y"])
        self.assertEqual(conn.expunged, 1)

    def test_the_count_is_shown_before_the_question(self):
        shown = []
        # A fixed answer here spun the chooser at bin/mail:420 forever while
        # each call snapshotted the growing buffer: ~28 GB, which oomd answered
        # by killing the whole terminal. Finite answers cannot loop.
        answers = iter(["1", "n"])
        conn = Conn()
        args = mail.argparse.Namespace(account=None, yes=False)
        buf = io.StringIO()
        buf.isatty = lambda: True
        with mock.patch.object(mail, "resolve_account", side_effect=lambda v: v), \
             mock.patch.object(mail, "accounts", return_value={"gmail": {}}), \
             mock.patch.object(mail, "connect",
                               return_value=(conn, {"user": "t@g.com",
                                                    "trash": "[Gmail]/Trash"})), \
             mock.patch.object(mail.sys.stdin, "isatty", return_value=True), \
             mock.patch("builtins.input",
                        side_effect=lambda *a: shown.append(buf.getvalue())
                       or next(answers)), \
             contextlib.redirect_stdout(buf):
            mail.cmd_empty(args)
        self.assertIn("16 message(s) would be deleted permanently", shown[-1])

    def test_an_empty_trash_asks_nothing(self):
        conn = Conn(counts={"INBOX": (10, 0), "[Gmail]/Trash": (0, 0)})
        conn, text = self.empty(conn=conn, answers=["1"])
        self.assertIn("nothing to empty", text)
        self.assertEqual(conn.expunged, 0)

    def test_an_account_with_no_visible_trash_is_shown_and_skipped(self):
        conn = Conn(rows=[b'(\\HasNoChildren) "/" "INBOX"'])
        conn, text = self.empty(conn=conn, answers=["1"])
        self.assertIn("(none visible)", text)
        self.assertIn("nothing to empty", text)
        self.assertEqual(conn.expunged, 0)

    def test_it_refuses_to_expunge_inbox_as_a_trash_folder(self):
        """A config or a server that calls INBOX the trash would otherwise
        permanently delete every message in it."""
        conn = Conn(rows=[b'(\\HasNoChildren) "/" "INBOX"'],
                    counts={"INBOX": (6476, 5318)})
        conn, text = self.empty(conn=conn, yes=True,
                                acct={"user": "t@g.com", "trash": "INBOX"})
        self.assertIn("refusing to expunge INBOX", text)
        self.assertEqual(conn.expunged, 0)
        self.assertEqual(conn.stored, [])

    def test_no_account_flag_in_a_terminal_asks_which_one(self):
        conn = Conn()
        args = mail.argparse.Namespace(account=None, yes=False)
        buf = io.StringIO()
        buf.isatty = lambda: True
        with mock.patch.object(mail, "accounts", return_value={"gmail": {},
                                                              "zoho": {}}), \
             mock.patch.object(mail, "connect",
                               return_value=(conn, {"user": "t@g.com",
                                                    "trash": "[Gmail]/Trash"})), \
             mock.patch.object(mail, "choose_ls_scope",
                               return_value=["zoho"]) as chooser, \
             mock.patch.object(mail.sys.stdin, "isatty", return_value=True), \
             mock.patch("builtins.input", side_effect=iter(["n"])), \
             contextlib.redirect_stdout(buf):
            mail.cmd_empty(args)
        chooser.assert_called_once_with(None)

    def test_quitting_the_chooser_deletes_nothing(self):
        conn = Conn()
        args = mail.argparse.Namespace(account=None, yes=False)
        buf = io.StringIO()
        buf.isatty = lambda: True
        with mock.patch.object(mail, "accounts", return_value={"gmail": {}}), \
             mock.patch.object(mail, "connect",
                               return_value=(conn, {"user": "t@g.com",
                                                    "trash": "[Gmail]/Trash"})) as connected, \
             mock.patch.object(mail, "choose_ls_scope", return_value=None), \
             mock.patch.object(mail.sys.stdin, "isatty", return_value=True), \
             mock.patch("builtins.input",
                        side_effect=AssertionError("must not ask again")), \
             contextlib.redirect_stdout(buf):
            mail.cmd_empty(args)
        connected.assert_not_called()
        self.assertEqual(conn.expunged, 0)

    def test_the_account_flag_skips_the_chooser(self):
        conn = Conn()
        args = mail.argparse.Namespace(account=["gmail"], yes=True)
        buf = io.StringIO()
        buf.isatty = lambda: True
        with mock.patch.object(mail, "resolve_account", side_effect=lambda v: v), \
             mock.patch.object(mail, "accounts", return_value={"gmail": {},
                                                              "zoho": {}}), \
             mock.patch.object(mail, "connect",
                               return_value=(conn, {"user": "t@g.com",
                                                    "trash": "[Gmail]/Trash"})), \
             mock.patch.object(mail, "choose_ls_scope") as chooser, \
             mock.patch.object(mail.sys.stdin, "isatty", return_value=True), \
             contextlib.redirect_stdout(buf):
            mail.cmd_empty(args)
        chooser.assert_not_called()
        self.assertEqual(conn.expunged, 1)

    def test_yes_asks_nothing_at_all(self):
        """--yes means no questions, so it must not stop on the chooser
        either -- a script that passed it has no one to answer."""
        conn = Conn()
        args = mail.argparse.Namespace(account=None, yes=True)
        buf = io.StringIO()
        buf.isatty = lambda: True
        with mock.patch.object(mail, "accounts", return_value={"gmail": {}}), \
             mock.patch.object(mail, "connect",
                               return_value=(conn, {"user": "t@g.com",
                                                    "trash": "[Gmail]/Trash"})), \
             mock.patch.object(mail, "choose_ls_scope") as chooser, \
             mock.patch.object(mail.sys.stdin, "isatty", return_value=True), \
             mock.patch("builtins.input",
                        side_effect=AssertionError("must not prompt")), \
             contextlib.redirect_stdout(buf):
            mail.cmd_empty(args)
        chooser.assert_not_called()
        self.assertEqual(conn.expunged, 1)

    def test_an_unknown_account_is_named_not_a_traceback(self):
        args = mail.argparse.Namespace(account=["nope"], yes=True)
        with mock.patch.object(mail, "accounts", return_value={"gmail": {}}), \
             mock.patch.object(mail, "connect") as connected:
            with self.assertRaises(SystemExit) as stopped:
                mail.cmd_empty(args)
        connected.assert_not_called()
        self.assertIn("unknown account: nope", str(stopped.exception))

    def test_eof_at_the_prompt_deletes_nothing(self):
        conn = Conn()
        args = mail.argparse.Namespace(account=None, yes=False)
        buf = io.StringIO()
        buf.isatty = lambda: True
        with mock.patch.object(mail, "resolve_account", side_effect=lambda v: v), \
             mock.patch.object(mail, "accounts", return_value={"gmail": {}}), \
             mock.patch.object(mail, "connect",
                               return_value=(conn, {"user": "t@g.com",
                                                    "trash": "[Gmail]/Trash"})), \
             mock.patch.object(mail.sys.stdin, "isatty", return_value=True), \
             mock.patch("builtins.input", side_effect=EOFError), \
             contextlib.redirect_stdout(buf):
            mail.cmd_empty(args)
        self.assertEqual(conn.expunged, 0)


class FindArchiveTests(unittest.TestCase):
    """The Archive box is found, never assumed: a flagged mailbox first,
    then a plain box named Archive, then the configured name."""

    def find(self, rows, configured=None):
        conn = Conn(rows=rows)
        return mail.find_archive(conn, configured)

    def test_flagged_archive_wins(self):
        rows = [b'(\\HasNoChildren \\Archive) "/" "Archiv"',
                b'(\\HasNoChildren) "/" "Archive"']
        self.assertEqual(self.find(rows), "Archiv")

    def test_plain_archive_name_matches(self):
        rows = [b'(\\HasNoChildren) "/" "INBOX"',
                b'(\\HasNoChildren) "/" "Archive"',
                b'(\\HasNoChildren \\Trash) "/" "[Gmail]/Trash"']
        self.assertEqual(self.find(rows), "Archive")

    def test_configured_name_is_a_fallback_not_a_fact(self):
        rows = [b'(\\HasNoChildren) "/" "INBOX"']
        self.assertIsNone(self.find(rows, configured="Archiv"))
        rows = [b'(\\HasNoChildren) "/" "INBOX"',
                b'(\\HasNoChildren) "/" "Archiv"']
        self.assertEqual(self.find(rows, configured="Archiv"), "Archiv")

    def test_nothing_matching_is_none(self):
        rows = [b'(\\HasNoChildren) "/" "INBOX"']
        self.assertIsNone(self.find(rows))


class FindSpamTests(unittest.TestCase):
    def find(self, rows, configured=None):
        conn = Conn(rows=rows)
        return mail.find_spam(conn, configured)

    def test_flagged_junk_wins(self):
        rows = [b'(\\HasNoChildren \\Junk) "/" "Spam"',
                b'(\\HasNoChildren) "/" "INBOX"']
        self.assertEqual(self.find(rows), "Spam")

    def test_plain_spam_name_matches(self):
        rows = [b'(\\HasNoChildren) "/" "INBOX"',
                b'(\\HasNoChildren) "/" "Spam"']
        self.assertEqual(self.find(rows), "Spam")

    def test_no_spam_box_is_none(self):
        rows = [b'(\\HasNoChildren) "/" "INBOX"',
                b'(\\HasNoChildren \\Trash) "/" "[Gmail]/Trash"']
        self.assertIsNone(self.find(rows))


class SnapshotPilesTests(unittest.TestCase):
    """The ledger entry carries the piles, all read off STATUS."""

    class FullConn(Conn):
        def __init__(self):
            super().__init__(
                rows=[b'(\\HasNoChildren) "/" "INBOX"',
                      b'(\\HasNoChildren) "/" "Archive"',
                      b'(\\HasNoChildren) "/" "Trash"',
                      b'(\\HasNoChildren \\Junk) "/" "Spam"'])

        def status(self, box, items):
            marks = {"INBOX": (100, 60, 1001, 42),
                     "Archive": (20, 0, 2, 7),
                     "Trash": (5, 0, 6, 9),
                     "Spam": (12, 0, 13, 11)}
            name = box.strip('"')
            messages, unseen, uidnext, validity = marks[name]
            return "OK", [b'"%s" (MESSAGES %d UNSEEN %d UIDNEXT %d '
                           b'UIDVALIDITY %d)'
                           % (name.encode(), messages, unseen, uidnext,
                              validity)]

    def test_snapshot_carries_inbox_archive_trash_spam(self):
        entry, err = mail.snapshot_account(
            self.FullConn(), {"trash": "Trash"}, "INBOX")
        self.assertIsNone(err)
        self.assertEqual(
            (entry["count"], entry["unread"], entry["uidnext"],
             entry["archive"]["count"], entry["trash"]["count"],
             entry["spam"]["count"]),
            (100, 60, 1001, 20, 5, 12))


class StatusUidTests(unittest.TestCase):
    def test_uidnext_and_uidvalidity_ride_along(self):
        class FullConn(Conn):
            def status(self, box, items):
                self.asked = items
                return "OK", [b'"INBOX" (MESSAGES 100 UNSEEN 10 '
                               b'UIDNEXT 1001 UIDVALIDITY 42)']

        conn = FullConn()
        counts = mail.status_counts(conn, "INBOX")
        self.assertEqual(counts["UIDNEXT"], 1001)
        self.assertEqual(counts["UIDVALIDITY"], 42)
        self.assertIn("UIDNEXT", conn.asked)


class ComputePeriodTests(unittest.TestCase):
    """Arrived is exact off UIDNEXT; departed is whatever the count cannot
    explain; Archive growth is archived and the rest is deleted."""

    def entry(self, uidnext, count, archive_count=None, validity=42,
              unread=None, trash=None, spam=None):
        ent = {"box": "INBOX", "uidvalidity": validity,
               "uidnext": uidnext, "count": count, "unread": unread,
               "archive": None, "trash": None, "spam": None}
        if archive_count is not None:
            ent["archive"] = {"box": "Archive", "uidvalidity": validity,
                              "uidnext": 1, "count": archive_count}
        if trash is not None:
            ent["trash"] = {"box": "Trash", "count": trash}
        if spam is not None:
            ent["spam"] = {"box": "Spam", "count": spam}
        return ent

    def test_arrived_archived_deleted(self):
        old = self.entry(uidnext=1000, count=100, archive_count=20)
        new = self.entry(uidnext=1010, count=95, archive_count=27)
        row = mail.compute_period(old, new)
        self.assertEqual((row["arrived"], row["archived"], row["deleted"]),
                         (10, 7, 8))
        self.assertIsNone(row["note"])

    def test_archive_shrink_is_not_negative_archiving(self):
        old = self.entry(uidnext=1000, count=100, archive_count=20)
        new = self.entry(uidnext=1000, count=90, archive_count=18)
        row = mail.compute_period(old, new)
        self.assertEqual((row["arrived"], row["archived"], row["deleted"]),
                         (0, 0, 10))

    def test_uidvalidity_reset_starts_a_new_baseline(self):
        old = self.entry(uidnext=1000, count=100, archive_count=20)
        new = self.entry(uidnext=5, count=90, archive_count=20, validity=43)
        row = mail.compute_period(old, new)
        self.assertIsNone(row["arrived"])
        self.assertIn("baseline", row["note"])

    def test_missing_archive_leaves_archived_deleted_unknown(self):
        old = self.entry(uidnext=1000, count=100)
        new = self.entry(uidnext=1010, count=95)
        row = mail.compute_period(old, new)
        self.assertEqual(row["arrived"], 10)
        self.assertIsNone(row["archived"])
        self.assertIsNone(row["deleted"])
        self.assertIn("archive", row["note"])

    def test_no_baseline_is_said_out_loud(self):
        row = mail.compute_period(None, self.entry(1000, 100, 20))
        self.assertIsNone(row["arrived"])
        self.assertIn("no earlier snapshot", row["note"])

    def test_pile_deltas_are_new_minus_old(self):
        """Minus is progress, plus is buildup: 20 fewer unread, 4 more in
        Trash, Spam holding steady."""
        old = self.entry(uidnext=1000, count=100, archive_count=20,
                         unread=60, trash=5, spam=12)
        new = self.entry(uidnext=1010, count=95, archive_count=27,
                         unread=40, trash=9, spam=12)
        row = mail.compute_period(old, new)
        self.assertEqual((row["unread"], row["trash"], row["spam"]),
                         (-20, 4, 0))
        self.assertIsNone(row["note"])

    def test_piles_missing_either_side_stay_unknown(self):
        old = self.entry(uidnext=1000, count=100, archive_count=20,
                         unread=60, trash=5)
        new = self.entry(uidnext=1010, count=95, archive_count=27,
                         unread=40, trash=9)
        row = mail.compute_period(old, new)
        self.assertEqual((row["unread"], row["trash"], row["spam"]),
                         (-20, 4, None))
        self.assertIsNone(row["note"])


class PickBaselineTests(unittest.TestCase):
    def snap(self, day):
        return {"date": day, "accounts": {}}

    def test_week_picks_the_snapshot_seven_days_back(self):
        snaps = [self.snap("2026-09-28"), self.snap("2026-10-01"),
                 self.snap("2026-10-04"), self.snap("2026-10-05")]
        base, span = mail.pick_baseline(snaps, "2026-10-05", 7)
        self.assertEqual(base["date"], "2026-09-28")
        self.assertEqual(span, 7)

    def test_young_ledger_falls_back_to_oldest_with_honest_span(self):
        snaps = [self.snap("2026-10-03"), self.snap("2026-10-04")]
        base, span = mail.pick_baseline(snaps, "2026-10-05", 7)
        self.assertEqual(base["date"], "2026-10-03")
        self.assertEqual(span, 2)

    def test_no_earlier_snapshot_is_none(self):
        base, span = mail.pick_baseline([self.snap("2026-10-05")],
                                        "2026-10-05", 1)
        self.assertIsNone(base)
        self.assertEqual(span, 0)

    def test_corrupt_dates_are_skipped_not_fatal(self):
        snaps = [{"date": "not-a-date", "accounts": {}},
                 self.snap("2026-10-04")]
        base, span = mail.pick_baseline(snaps, "2026-10-05", 1)
        self.assertEqual(base["date"], "2026-10-04")
        self.assertEqual(span, 1)


class CmdStatsPeriodTests(unittest.TestCase):
    def period(self, ledger, flag="day"):
        args = mail.argparse.Namespace(account=None, box="INBOX", day=False,
                                       week=False, month=False)
        setattr(args, flag, True)
        current = {"date": "2026-10-05",
                   "accounts": {"gmail": {
                       "box": "INBOX", "uidvalidity": 42, "uidnext": 1010,
                       "count": 95,
                       "archive": {"box": "Archive", "uidvalidity": 42,
                                   "uidnext": 1, "count": 27}}}}
        buf = io.StringIO()
        with mock.patch.object(mail, "resolve_account", side_effect=lambda v: v), \
             mock.patch.object(mail, "accounts",
                               return_value={"gmail": {"user": "g@g.com"}}), \
             mock.patch.object(mail, "record_stats_snapshot",
                               return_value=(current, [])), \
             mock.patch.object(mail, "load_stats_ledger",
                               return_value=ledger), \
             contextlib.redirect_stdout(buf):
            mail.cmd_stats(args)
        return buf.getvalue()

    def ledger(self, day):
        return {"snapshots": [
            {"date": day, "accounts": {"gmail": {
                "box": "INBOX", "uidvalidity": 42, "uidnext": 1000,
                "count": 100,
                "archive": {"box": "Archive", "uidvalidity": 42,
                            "uidnext": 1, "count": 20}}}}]}

    def test_week_view_reports_arrived_archived_deleted(self):
        text = self.period(self.ledger("2026-09-28"), flag="week")
        self.assertIn("progress since 2026-09-28 (7 days):", text)
        self.assertIn("g@g.com", text)
        unified = [l for l in text.splitlines() if l.startswith("unified")][0]
        self.assertEqual(unified.split()[1:], ["10", "7", "8", "-", "-", "-"])

    def test_piles_print_signed(self):
        """-20 unread is progress you can see; +4 trash is buildup."""
        old = {"box": "INBOX", "uidvalidity": 42, "uidnext": 1000,
               "count": 100, "unread": 60,
               "archive": {"box": "Archive", "uidvalidity": 42,
                           "uidnext": 1, "count": 20},
               "trash": {"box": "Trash", "count": 5},
               "spam": {"box": "Spam", "count": 12}}
        new = {"box": "INBOX", "uidvalidity": 42, "uidnext": 1010,
               "count": 95, "unread": 40,
               "archive": {"box": "Archive", "uidvalidity": 42,
                           "uidnext": 1, "count": 27},
               "trash": {"box": "Trash", "count": 9},
               "spam": {"box": "Spam", "count": 12}}
        args = mail.argparse.Namespace(account=None, box="INBOX", day=True,
                                       week=False, month=False)
        buf = io.StringIO()
        with mock.patch.object(mail, "resolve_account", side_effect=lambda v: v), \
             mock.patch.object(mail, "accounts",
                               return_value={"gmail": {"user": "g@g.com"}}), \
             mock.patch.object(mail, "record_stats_snapshot",
                               return_value=({"date": "2026-10-05",
                                              "accounts": {"gmail": new}},
                                             [])), \
             mock.patch.object(mail, "load_stats_ledger",
                               return_value={"snapshots": [
                                   {"date": "2026-10-04",
                                    "accounts": {"gmail": old}}]}), \
             contextlib.redirect_stdout(buf):
            mail.cmd_stats(args)
        mine = [l for l in buf.getvalue().splitlines()
                if l.startswith("g@g.com")][0]
        self.assertEqual(mine.split()[1:],
                         ["10", "7", "8", "-20", "+4", "+0"])

    def test_first_run_says_the_ledger_just_started(self):
        text = self.period({"snapshots": []})
        self.assertIn("ledger started", text)
        self.assertIn("tomorrow", text)


if __name__ == "__main__":
    unittest.main()
