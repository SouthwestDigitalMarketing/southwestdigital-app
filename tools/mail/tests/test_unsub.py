"""`mail unsub <number>` leaves a mailing list the way the sender's own
List-Unsubscribe header asks to be left, and nothing else.

Only an https URL is trusted — a plain http or mailto target is treated as
no link at all, matching the policy already proven in app/server.py's
notmuch-side mover. A one-click (RFC 8058) POST is required to answer with
a success code before this calls it done; a plain GET is reported as
"opened", never as confirmed, because many lists need a second click on
their own page.
"""
import contextlib
import importlib.util
import io
import json
import tempfile
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest import mock

SPEC = importlib.util.spec_from_loader(
    "mailroom_mail",
    importlib.machinery.SourceFileLoader(
        "mailroom_mail", str(Path(__file__).parents[1] / "bin" / "mail")))
mail = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mail)


class ParseUnsubTests(unittest.TestCase):
    def test_https_with_one_click_post(self):
        msg = {"List-Unsubscribe":
               "<https://list.test/u/1>, <mailto:l@list.test>",
               "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"}
        self.assertEqual(mail.parse_unsub(msg), ("https://list.test/u/1", True))

    def test_mailto_only_is_no_link(self):
        self.assertEqual(
            mail.parse_unsub({"List-Unsubscribe": "<mailto:l@list.test>"}),
            (None, False))

    def test_plain_http_is_no_link(self):
        self.assertEqual(
            mail.parse_unsub({"List-Unsubscribe": "<http://list.test/u>"}),
            (None, False))

    def test_missing_header_is_no_link(self):
        self.assertEqual(mail.parse_unsub({}), (None, False))

    def test_one_click_post_is_case_insensitive(self):
        msg = {"List-Unsubscribe": "<https://list.test/u>",
               "List-Unsubscribe-Post": "LIST-UNSUBSCRIBE=ONE-CLICK"}
        self.assertEqual(mail.parse_unsub(msg), ("https://list.test/u", True))

    def test_without_post_header_is_not_one_click(self):
        msg = {"List-Unsubscribe": "<https://list.test/u>"}
        self.assertEqual(mail.parse_unsub(msg), ("https://list.test/u", False))


class DoUnsubscribeTests(unittest.TestCase):
    class Resp:
        def __init__(self, status):
            self.status = status

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    def test_one_click_posts_the_required_body(self):
        seen = {}

        def fake_open(req, timeout=None):
            seen["req"] = req
            return self.Resp(200)

        with mock.patch("urllib.request.urlopen", side_effect=fake_open):
            line = mail.do_unsubscribe("https://list.test/u", True)
        self.assertEqual(seen["req"].get_method(), "POST")
        self.assertEqual(seen["req"].data, b"List-Unsubscribe=One-Click")
        self.assertIn("unsubscribed", line)

    def test_plain_link_is_a_get_and_only_reported_as_opened(self):
        seen = {}

        def fake_open(req, timeout=None):
            seen["req"] = req
            return self.Resp(200)

        with mock.patch("urllib.request.urlopen", side_effect=fake_open):
            line = mail.do_unsubscribe("https://list.test/u", False)
        self.assertEqual(seen["req"].get_method(), "GET")
        self.assertIsNone(seen["req"].data)
        self.assertIn("opened", line)
        self.assertNotIn("unsubscribed --", line)

    def test_refuses_a_non_https_url(self):
        with self.assertRaises(SystemExit) as stopped:
            mail.do_unsubscribe("http://list.test/u", False)
        self.assertIn("non-https", str(stopped.exception))

    def test_one_click_with_a_bad_status_is_not_called_done(self):
        with mock.patch("urllib.request.urlopen",
                        side_effect=lambda req, timeout=None: self.Resp(500)):
            with self.assertRaises(SystemExit) as stopped:
                mail.do_unsubscribe("https://list.test/u", True)
        self.assertIn("500", str(stopped.exception))

    def test_http_error_is_reported_not_raised_raw(self):
        err = urllib.error.HTTPError("https://list.test/u", 500, "boom", {}, None)
        with mock.patch("urllib.request.urlopen", side_effect=err):
            with self.assertRaises(SystemExit) as stopped:
                mail.do_unsubscribe("https://list.test/u", True)
        self.assertIn("500", str(stopped.exception))


class CmdUnsubTests(unittest.TestCase):
    """End to end: persistent number -> registry lookup -> header fetch ->
    unsubscribe, without touching a real socket.

    cmd_unsub also writes to the persistent unsub log on a successful fire,
    so every test here gets its own throwaway UNSUB_LOG -- the real one at
    ~/.local/state/mailroom/unsubscribed.json is Tom's actual history and
    must never pick up a test's fake address and subject.
    """

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        patcher = mock.patch.object(
            mail, "UNSUB_LOG", str(Path(self.tmp.name) / "unsubscribed.json"))
        patcher.start()
        self.addCleanup(patcher.stop)

    def run_unsub(self, number, entries, header_bytes):
        class FakeConn:
            def __init__(self):
                self.logged_out = False

            def uid(self, command, uid, spec):
                self.last = (command, uid, spec)
                return "OK", [(b"1 FETCH", header_bytes)]

            def logout(self):
                self.logged_out = True

        conn = FakeConn()
        args = mail.argparse.Namespace(numbers=str(number))
        with mock.patch.object(mail, "registry_entries",
                               return_value=(entries, None)), \
             mock.patch.object(mail, "connect", return_value=(conn, {})), \
             mock.patch.object(mail, "select"), \
             mock.patch.object(mail, "do_unsubscribe",
                               return_value="unsubscribed -- no more from this list") as fired:
            mail.cmd_unsub(args)
        return conn, fired

    def test_unknown_number_refuses(self):
        with mock.patch.object(mail, "registry_entries", return_value=({}, None)):
            with self.assertRaises(SystemExit) as stopped:
                mail.cmd_unsub(mail.argparse.Namespace(numbers="5"))
        self.assertIn("unknown", str(stopped.exception))

    def test_resolves_the_persistent_number_and_fires_the_link(self):
        entries = {5: ("gmail|id:x", {"account": "gmail", "uid": "144901",
                                      "box": "INBOX", "subject": "Deal"})}
        header = (b"Subject: Deal\r\nFrom: Pizza Hut <p@h.com>\r\n"
                 b"List-Unsubscribe: <https://list.test/u>\r\n"
                 b"List-Unsubscribe-Post: List-Unsubscribe=One-Click\r\n\r\n")
        conn, fired = self.run_unsub(5, entries, header)
        fired.assert_called_once_with("https://list.test/u", True)
        self.assertTrue(conn.logged_out)
        self.assertEqual(conn.last[:2], ("FETCH", "144901"))

    def test_no_header_is_listed_cannot_unsubscribe(self):
        """A linkless message is reported, not fatal: no exit, nothing
        fired, and the sender is still offered in the filter loop."""
        entries = {5: ("gmail|id:x", {"account": "gmail", "uid": "144903",
                                      "box": "INBOX", "subject": "Points"})}
        header = b"Subject: Points\r\nFrom: Dominos <r@d.com>\r\n\r\n"

        class FakeConn:
            def uid(self, command, uid, spec):
                return "OK", [(b"1 FETCH", header)]

            def logout(self):
                pass

        out = io.StringIO()
        with mock.patch.object(mail, "registry_entries",
                               return_value=(entries, None)), \
             mock.patch.object(mail, "connect",
                               return_value=(FakeConn(), {})), \
             mock.patch.object(mail, "select"), \
             mock.patch.object(mail, "do_unsubscribe") as fired, \
             mock.patch.object(mail, "offer_sender_cleanup") as offered, \
             contextlib.redirect_stdout(out):
            mail.cmd_unsub(mail.argparse.Namespace(numbers="5"))
        fired.assert_not_called()
        text = out.getvalue()
        self.assertIn("cannot unsubscribe 5:", text)
        self.assertIn("no https List-Unsubscribe link", text)
        offered.assert_called_once_with("r@d.com", False)

    def run_multi(self, entries, headers_by_uid):
        class FakeConn:
            def uid(self, command, uid, spec):
                return "OK", [(b"1 FETCH", headers_by_uid[uid])]

            def logout(self):
                pass

        args = mail.argparse.Namespace(numbers=",".join(
            str(n) for n in entries))
        out = io.StringIO()
        with mock.patch.object(mail, "registry_entries",
                               return_value=(entries, None)), \
             mock.patch.object(mail, "connect",
                               return_value=(FakeConn(), {})), \
             mock.patch.object(mail, "select"), \
             mock.patch.object(mail, "do_unsubscribe",
                               return_value="unsubscribed") as fired, \
             mock.patch.object(mail, "offer_sender_cleanup") as offered, \
             contextlib.redirect_stdout(out):
            mail.cmd_unsub(args)
        return fired, offered, out

    def test_comma_list_fires_each_message_own_link(self):
        entries = {
            12: ("gmail|id:a", {"account": "gmail", "uid": "101",
                                "box": "INBOX", "subject": "Deal"}),
            13: ("gmail|id:b", {"account": "gmail", "uid": "102",
                                "box": "INBOX", "subject": "Sale"}),
        }
        headers = {
            "101": (b"Subject: Deal\r\nFrom: Pizza Hut <p@h.com>\r\n"
                    b"List-Unsubscribe: <https://pizza.test/u>\r\n\r\n"),
            "102": (b"Subject: Sale\r\nFrom: Dominos <r@d.com>\r\n"
                    b"List-Unsubscribe: <https://dominos.test/u>\r\n\r\n"),
        }
        fired, offered, out = self.run_multi(entries, headers)
        self.assertEqual([c.args[0] for c in fired.call_args_list],
                         ["https://pizza.test/u", "https://dominos.test/u"])
        log = mail.load_unsub_log()
        self.assertIn("p@h.com", log)
        self.assertIn("r@d.com", log)
        self.assertEqual(sorted(c.args[0] for c in offered.call_args_list),
                         ["p@h.com", "r@d.com"])
        self.assertIn("unsubscribing 12,13:", out.getvalue())

    def test_same_link_fires_once_but_lists_both_numbers(self):
        """Two messages sharing one unsubscribe link fire it once: one
        request, one log entry, one cleanup offer, both numbers shown."""
        entries = {
            12: ("gmail|id:a", {"account": "gmail", "uid": "101",
                                "box": "INBOX", "subject": "Deal"}),
            16: ("gmail|id:c", {"account": "gmail", "uid": "103",
                                "box": "INBOX", "subject": "More"}),
        }
        header = (b"Subject: Deal\r\nFrom: Pizza Hut <p@h.com>\r\n"
                  b"List-Unsubscribe: <https://pizza.test/u>\r\n\r\n")
        fired, offered, out = self.run_multi(
            entries, {"101": header, "103": header})
        fired.assert_called_once_with("https://pizza.test/u", False)
        self.assertEqual(mail.load_unsub_log()["p@h.com"]["count"], 1)
        offered.assert_called_once_with("p@h.com", False)
        text = out.getvalue()
        self.assertIn("unsubscribing 12,16:", text)
        self.assertIn("method for 12,16:", text)

    def test_range_expands_to_every_number(self):
        entries = {
            12: ("gmail|id:a", {"account": "gmail", "uid": "101",
                                "box": "INBOX", "subject": "Deal"}),
            13: ("gmail|id:b", {"account": "gmail", "uid": "102",
                                "box": "INBOX", "subject": "Sale"}),
            14: ("gmail|id:c", {"account": "gmail", "uid": "103",
                                "box": "INBOX", "subject": "More"}),
        }
        headers = {
            "101": (b"Subject: Deal\r\nFrom: Pizza Hut <p@h.com>\r\n"
                    b"List-Unsubscribe: <https://pizza.test/u>\r\n\r\n"),
            "102": (b"Subject: Sale\r\nFrom: Dominos <r@d.com>\r\n"
                    b"List-Unsubscribe: <https://dominos.test/u>\r\n\r\n"),
            "103": (b"Subject: More\r\nFrom: Pizza Hut <p@h.com>\r\n"
                    b"List-Unsubscribe: <https://pizza.test/u>\r\n\r\n"),
        }

        class FakeConn:
            def uid(self, command, uid, spec):
                return "OK", [(b"1 FETCH", headers[uid])]

            def logout(self):
                pass

        out = io.StringIO()
        with mock.patch.object(mail, "registry_entries",
                               return_value=(entries, None)), \
             mock.patch.object(mail, "connect",
                               return_value=(FakeConn(), {})), \
             mock.patch.object(mail, "select"), \
             mock.patch.object(mail, "do_unsubscribe",
                               return_value="unsubscribed") as fired, \
             mock.patch.object(mail, "offer_sender_cleanup") as offered, \
             contextlib.redirect_stdout(out):
            mail.cmd_unsub(mail.argparse.Namespace(numbers="12-14"))
        self.assertEqual([c.args[0] for c in fired.call_args_list],
                         ["https://pizza.test/u", "https://dominos.test/u"])
        self.assertIn("unsubscribing 12,13,14:", out.getvalue())
        self.assertEqual(sorted(c.args[0] for c in offered.call_args_list),
                         ["p@h.com", "r@d.com"])

    def test_row_ranges_parse(self):
        self.assertEqual(mail.parse_row_numbers("189-192"), [189, 190, 191, 192])
        self.assertEqual(mail.parse_row_numbers("12,14-16"), [12, 14, 15, 16])
        self.assertEqual(mail.parse_row_numbers("12-14,13"), [12, 13, 14])
        self.assertEqual(mail.parse_row_numbers("n1,n2,n7-10,n12"),
                         [1, 2, 7, 8, 9, 10, 12])
        self.assertEqual(mail.parse_row_numbers("N4"), [4])
        with self.assertRaises(ValueError):
            mail.parse_row_numbers("202-189")
        with self.assertRaises(ValueError):
            mail.parse_row_numbers("12,x")
        with self.assertRaises(ValueError):
            mail.parse_row_numbers("5-")

    def test_bad_row_refuses_without_firing(self):
        with mock.patch.object(mail, "connect") as connect, \
             mock.patch.object(mail, "do_unsubscribe") as fired:
            with self.assertRaises(SystemExit) as stopped:
                mail.cmd_unsub(mail.argparse.Namespace(numbers="12,x"))
        connect.assert_not_called()
        fired.assert_not_called()
        self.assertIn("positive numbers", str(stopped.exception))

    def test_linkless_message_does_not_stop_the_rest(self):
        """Tom's Nextdoor case: 12 has no link at all, 13 unsubscribes
        anyway, and both senders are offered in the filter loop."""
        entries = {
            12: ("gmail|id:a", {"account": "gmail", "uid": "101",
                                "box": "INBOX", "subject": "Saw..."}),
            13: ("gmail|id:b", {"account": "gmail", "uid": "102",
                                "box": "INBOX", "subject": "Deal"}),
        }
        headers = {
            "101": (b"Subject: Saw...\r\n"
                    b"From: Trending on Nextdoor <no-reply@rs.email.nextdoor.com>\r\n"
                    b"\r\n"),
            "102": (b"Subject: Deal\r\nFrom: Pizza Hut <p@h.com>\r\n"
                    b"List-Unsubscribe: <https://pizza.test/u>\r\n\r\n"),
        }
        fired, offered, out = self.run_multi(entries, headers)
        fired.assert_called_once_with("https://pizza.test/u", False)
        self.assertIn("p@h.com", mail.load_unsub_log())
        text = out.getvalue()
        self.assertIn("unsubscribing 13:", text)
        self.assertIn("cannot unsubscribe 12:", text)
        self.assertIn("no https List-Unsubscribe link", text)
        self.assertEqual(
            sorted(c.args[0] for c in offered.call_args_list),
            ["no-reply@rs.email.nextdoor.com", "p@h.com"])

    def test_fire_failure_does_not_stop_the_rest(self):
        """A list whose server answers 500 still lets the next list
        through; the exit names only the failed one."""
        entries = {
            13: ("gmail|id:b", {"account": "gmail", "uid": "102",
                                "box": "INBOX", "subject": "Deal"}),
            16: ("gmail|id:c", {"account": "gmail", "uid": "103",
                                "box": "INBOX", "subject": "More"}),
        }
        headers = {
            "102": (b"Subject: Deal\r\nFrom: Pizza Hut <p@h.com>\r\n"
                    b"List-Unsubscribe: <https://pizza.test/u>\r\n\r\n"),
            "103": (b"Subject: More\r\nFrom: Dominos <r@d.com>\r\n"
                    b"List-Unsubscribe: <https://dominos.test/u>\r\n\r\n"),
        }

        class FakeConn:
            def uid(self, command, uid, spec):
                return "OK", [(b"1 FETCH", headers[uid])]

            def logout(self):
                pass

        with mock.patch.object(mail, "registry_entries",
                               return_value=(entries, None)), \
             mock.patch.object(mail, "connect",
                               return_value=(FakeConn(), {})), \
             mock.patch.object(mail, "select"), \
             mock.patch.object(mail, "do_unsubscribe", side_effect=[
                 SystemExit("unsubscribe answered 500"),
                 "unsubscribed -- no more from this list"]) as fired, \
             mock.patch.object(mail, "offer_sender_cleanup") as offered, \
             contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaises(SystemExit) as stopped:
                mail.cmd_unsub(mail.argparse.Namespace(numbers="13,16"))
        self.assertEqual(fired.call_count, 2)
        self.assertNotIn("p@h.com", mail.load_unsub_log())
        self.assertEqual(mail.load_unsub_log()["r@d.com"]["count"], 1)
        offered.assert_called_once_with("r@d.com", False)
        self.assertIn("message number 13", str(stopped.exception))

    def test_shared_link_failure_names_every_number(self):
        """One shared link, one request: when it fails, every number
        behind it is named and nothing is recorded."""
        entries = {
            13: ("gmail|id:b", {"account": "gmail", "uid": "102",
                                "box": "INBOX", "subject": "Deal"}),
            16: ("gmail|id:c", {"account": "gmail", "uid": "103",
                                "box": "INBOX", "subject": "More"}),
        }
        header = (b"Subject: Deal\r\nFrom: Pizza Hut <p@h.com>\r\n"
                  b"List-Unsubscribe: <https://pizza.test/u>\r\n\r\n")

        class FakeConn:
            def uid(self, command, uid, spec):
                return "OK", [(b"1 FETCH", header)]

            def logout(self):
                pass

        with mock.patch.object(mail, "registry_entries",
                               return_value=(entries, None)), \
             mock.patch.object(mail, "connect",
                               return_value=(FakeConn(), {})), \
             mock.patch.object(mail, "select"), \
             mock.patch.object(mail, "do_unsubscribe",
                               side_effect=SystemExit(
                                   "unsubscribe answered 500")) as fired, \
             mock.patch.object(mail, "offer_sender_cleanup") as offered, \
             contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaises(SystemExit) as stopped:
                mail.cmd_unsub(mail.argparse.Namespace(numbers="13,16"))
        fired.assert_called_once_with("https://pizza.test/u", False)
        self.assertEqual(mail.load_unsub_log(), {})
        offered.assert_not_called()
        self.assertIn("message number 13,16", str(stopped.exception))


class UnsubLogTests(unittest.TestCase):
    """The persistent log behind `mail unsubs` and the --unsubscribed filter.

    Every test here points mail.UNSUB_LOG at a throwaway file -- this is the
    one state file in the suite that holds Tom's real unsubscribe history,
    and no test may touch it.
    """

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        patcher = mock.patch.object(
            mail, "UNSUB_LOG", str(Path(self.tmp.name) / "unsubscribed.json"))
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_missing_file_is_an_empty_log(self):
        self.assertEqual(mail.load_unsub_log(), {})

    def test_record_then_load_round_trips(self):
        mail.record_unsub("p@h.com", "Pizza Hut", "50% off", "https://u",
                          True, "unsubscribed -- no more from this list")
        log = mail.load_unsub_log()
        self.assertEqual(log["p@h.com"]["name"], "Pizza Hut")
        self.assertEqual(log["p@h.com"]["count"], 1)
        self.assertTrue(log["p@h.com"]["one_click"])

    def test_repeated_record_increments_count_and_keeps_first_at(self):
        mail.record_unsub("p@h.com", "Pizza Hut", "50% off", "https://u",
                          True, "unsubscribed -- no more from this list")
        first_at = mail.load_unsub_log()["p@h.com"]["first_at"]
        mail.record_unsub("p@h.com", "Pizza Hut", "Back for more", "https://u",
                          True, "unsubscribed -- no more from this list")
        entry = mail.load_unsub_log()["p@h.com"]
        self.assertEqual(entry["count"], 2)
        self.assertEqual(entry["first_at"], first_at)
        self.assertEqual(entry["last_subject"], "Back for more")

    def test_no_address_is_not_recorded(self):
        mail.record_unsub("", "", "x", "https://u", True, "unsubscribed")
        self.assertEqual(mail.load_unsub_log(), {})

    def test_cmd_unsub_records_on_a_successful_fire(self):
        entries = {5: ("gmail|id:x", {"account": "gmail", "uid": "144901",
                                      "box": "INBOX", "subject": "Deal"})}
        header = (b"Subject: Deal\r\nFrom: Pizza Hut <p@h.com>\r\n"
                 b"List-Unsubscribe: <https://list.test/u>\r\n"
                 b"List-Unsubscribe-Post: List-Unsubscribe=One-Click\r\n\r\n")

        class FakeConn:
            def uid(self, command, uid, spec):
                return "OK", [(b"1 FETCH", header)]

            def logout(self):
                pass

        with mock.patch.object(mail, "registry_entries",
                               return_value=(entries, None)), \
             mock.patch.object(mail, "connect", return_value=(FakeConn(), {})), \
             mock.patch.object(mail, "select"), \
             mock.patch.object(mail, "do_unsubscribe",
                               return_value="unsubscribed -- no more from this list"), \
             contextlib.redirect_stdout(io.StringIO()):
            mail.cmd_unsub(mail.argparse.Namespace(numbers="5"))

        log = mail.load_unsub_log()
        self.assertEqual(log["p@h.com"]["count"], 1)
        self.assertEqual(log["p@h.com"]["name"], "Pizza Hut")
        self.assertEqual(log["p@h.com"]["last_subject"], "Deal")

    def test_cmd_unsubs_lists_recorded_senders(self):
        mail.record_unsub("p@h.com", "Pizza Hut", "50% off", "https://u",
                          True, "unsubscribed -- no more from this list")
        mail.record_unsub("d@h.com", "Domino's", "Last chance", "https://u",
                          False, "opened the list's unsubscribe link (answered 200)")
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            mail.cmd_unsubs(mail.argparse.Namespace())
        text = out.getvalue()
        self.assertIn("p@h.com", text)
        self.assertIn("Pizza Hut", text)
        self.assertIn("confirmed", text)
        self.assertIn("d@h.com", text)
        self.assertIn("opened", text)

    def test_cmd_unsubs_with_nothing_recorded_says_so(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            mail.cmd_unsubs(mail.argparse.Namespace())
        self.assertIn("no unsubscribe attempts recorded", out.getvalue())

    def test_filter_unsubbed_keeps_only_logged_senders(self):
        mail.record_unsub("p@h.com", "Pizza Hut", "x", "https://u", True, "unsubscribed")
        items = [{"from": "Pizza Hut <p@h.com>"}, {"from": "Boss <boss@work.com>"}]
        self.assertEqual(mail.filter_unsubbed(items), [items[0]])

    def test_filter_unsubbed_with_empty_log_keeps_nothing(self):
        items = [{"from": "Pizza Hut <p@h.com>"}]
        self.assertEqual(mail.filter_unsubbed(items), [])


class CmdPurgeTests(unittest.TestCase):
    """The mass-delete half: persistent numbers in, each moved to its own
    account's Trash, nothing touched until every account is confirmed open
    and able to MOVE."""

    class FakeConn:
        capabilities = [b"MOVE"]

        def __init__(self):
            self.moved = []
            self.logged_out = False

        def list(self):
            return "OK", [b'(\\HasNoChildren) "/" "Trash"',
                          b'(\\HasNoChildren) "/" "[Zoho]/Trash"',
                          b'(\\HasNoChildren) "/" "INBOX"']

        def select(self, box, readonly=False):
            return "OK", [b"1"]

        def uid(self, command, uid, dest):
            self.moved.append((uid, dest))
            return "OK", [b"done"]

        def logout(self):
            self.logged_out = True

    def test_purges_each_row_to_its_own_account_trash(self):
        items = [
            {"account": "gmail", "uid": "10", "message_no": 5, "subject": "Deal"},
            {"account": "zoho", "uid": "20", "message_no": 6, "subject": "Sale"},
        ]
        conns = {}

        def fake_connect(name):
            conn = self.FakeConn()
            conns[name] = conn
            return conn, {"trash": "Trash" if name == "gmail" else "[Zoho]/Trash"}

        args = mail.argparse.Namespace(
            rows="5,6", account=None, box="INBOX", per=50, unseen=False, hours=None)
        out = io.StringIO()
        with mock.patch.object(mail, "resolve_account", side_effect=lambda v: v), \
             mock.patch.object(mail, "accounts", return_value={"gmail": {}, "zoho": {}}), \
             mock.patch.object(mail, "fetch_inbox", return_value=(items, {}, [])), \
             mock.patch.object(mail, "connect", side_effect=fake_connect), \
             contextlib.redirect_stdout(out):
            mail.cmd_purge(args)

        self.assertEqual(conns["gmail"].moved, [("10", '"Trash"')])
        self.assertEqual(conns["zoho"].moved, [("20", '"[Zoho]/Trash"')])
        self.assertTrue(conns["gmail"].logged_out)
        self.assertTrue(conns["zoho"].logged_out)
        self.assertIn("purged message 5", out.getvalue())
        self.assertIn("purged message 6", out.getvalue())

    def test_missing_row_refuses_without_connecting(self):
        args = mail.argparse.Namespace(
            rows="9", account=None, box="INBOX", per=50, unseen=False, hours=None)
        with mock.patch.object(mail, "resolve_account", side_effect=lambda v: v), \
             mock.patch.object(mail, "accounts", return_value={"gmail": {}}), \
             mock.patch.object(mail, "fetch_inbox", return_value=([], {}, [])), \
             mock.patch.object(mail, "connect") as connect:
            with self.assertRaises(SystemExit) as stopped:
                mail.cmd_purge(args)
        connect.assert_not_called()
        self.assertIn("not in this inbox fetch", str(stopped.exception))

    def test_refuses_when_a_server_lacks_move(self):
        items = [{"account": "gmail", "uid": "10", "message_no": 5, "subject": "Deal"}]

        class NoMoveConn:
            capabilities = [b"IMAP4rev1"]

            def select(self, box, readonly=False):
                return "OK", [b"1"]

            def logout(self):
                pass

        args = mail.argparse.Namespace(
            rows="5", account=None, box="INBOX", per=50, unseen=False, hours=None)
        with mock.patch.object(mail, "resolve_account", side_effect=lambda v: v), \
             mock.patch.object(mail, "accounts", return_value={"gmail": {}}), \
             mock.patch.object(mail, "fetch_inbox", return_value=(items, {}, [])), \
             mock.patch.object(mail, "connect",
                               return_value=(NoMoveConn(), {"trash": "Trash"})):
            with self.assertRaises(SystemExit) as stopped:
                mail.cmd_purge(args)
        self.assertIn("does not support MOVE", str(stopped.exception))

    def test_incomplete_inbox_refuses_without_connecting(self):
        args = mail.argparse.Namespace(
            rows="5", account=None, box="INBOX", per=50, unseen=False, hours=None)
        with mock.patch.object(mail, "resolve_account", side_effect=lambda v: v), \
             mock.patch.object(mail, "accounts", return_value={"gmail": {}}), \
             mock.patch.object(mail, "fetch_inbox",
                               return_value=([], {}, ["gmail: cannot sign in"])), \
             mock.patch.object(mail, "connect") as connect:
            with self.assertRaises(SystemExit) as stopped:
                mail.cmd_purge(args)
        connect.assert_not_called()
        self.assertIn("incomplete", str(stopped.exception))


class PurgeItemsTests(unittest.TestCase):
    """The shared delete: act on the rows already in hand, open and check
    every account before moving anything, and raise rather than exit so a
    caller inside a prompt can keep going."""

    class FakeConn:
        capabilities = [b"MOVE"]

        def __init__(self):
            self.selected = []
            self.moved = []
            self.logged_out = False

        def list(self):
            return "OK", [b'(\\HasNoChildren) "/" "Trash"',
                          b'(\\HasNoChildren) "/" "[Zoho]/Trash"',
                          b'(\\HasNoChildren) "/" "INBOX"']

        def select(self, box, readonly=False):
            self.selected.append(box)
            return "OK", [b"1"]

        def uid(self, command, uid, dest):
            self.moved.append((uid, dest))
            return "OK", [b"done"]

        def logout(self):
            self.logged_out = True

    def test_uses_each_message_own_mailbox(self):
        """An item carries the box it was found in, so a caller that
        searched more than INBOX still deletes from the right place."""
        selected = [
            (5, {"account": "gmail", "uid": "10", "box": "INBOX",
                 "subject": "Deal"}),
            (6, {"account": "gmail", "uid": "11", "box": "Archive",
                 "subject": "Old"}),
        ]
        conns = []

        def fake_connect(name):
            conn = self.FakeConn()
            conns.append(conn)
            return conn, {"trash": "Trash"}

        out = io.StringIO()
        with mock.patch.object(mail, "connect", side_effect=fake_connect), \
             contextlib.redirect_stdout(out):
            mail.purge_items(selected)

        self.assertEqual(sorted(c.selected[0] for c in conns),
                         ['"Archive"', '"INBOX"'])
        self.assertTrue(all(c.logged_out for c in conns))
        self.assertIn("purged message 5", out.getvalue())
        self.assertIn("purged message 6", out.getvalue())

    def test_raises_instead_of_exiting_when_a_server_lacks_move(self):
        class NoMoveConn:
            capabilities = [b"IMAP4rev1"]

            def select(self, box, readonly=False):
                return "OK", [b"1"]

            def logout(self):
                pass

        selected = [(5, {"account": "gmail", "uid": "10", "subject": "Deal"})]
        with mock.patch.object(mail, "connect",
                               return_value=(NoMoveConn(), {"trash": "Trash"})):
            with self.assertRaises(RuntimeError) as raised:
                mail.purge_items(selected)
        self.assertIn("does not support MOVE", str(raised.exception))

    def test_nothing_moves_when_a_later_account_cannot_be_opened(self):
        """The capability pass runs over every account first, so a bad
        second account must not leave the first one half-purged."""
        good = self.FakeConn()

        class BadConn:
            capabilities = [b"MOVE"]

            def select(self, box, readonly=False):
                return "NO", [b"nope"]

            def logout(self):
                pass

        def fake_connect(name):
            return ((good, {"trash": "Trash"}) if name == "gmail"
                    else (BadConn(), {"trash": "Trash"}))

        selected = [
            (5, {"account": "gmail", "uid": "10", "subject": "Deal"}),
            (6, {"account": "zoho", "uid": "20", "subject": "Sale"}),
        ]
        with mock.patch.object(mail, "connect", side_effect=fake_connect):
            with self.assertRaises(RuntimeError):
                mail.purge_items(selected)
        self.assertEqual(good.moved, [])


class TrashDiscoveryTests(unittest.TestCase):
    """Where a delete actually goes. The configured name is a claim to
    check, not a fact: Gmail can be set to hide [Gmail]/Trash from IMAP
    entirely, and then there is no trash to move to."""

    class Conn:
        capabilities = [b"MOVE"]

        def __init__(self, rows):
            self.rows = rows

        def list(self):
            return "OK", self.rows

    def test_reads_a_plain_list_row(self):
        self.assertEqual(
            mail.parse_mailbox_row(b'(\\HasNoChildren) "/" "INBOX"'),
            ("\\hasnochildren", "INBOX"))

    def test_reads_a_name_with_spaces_and_a_slash(self):
        self.assertEqual(
            mail.parse_mailbox_row(b'(\\HasNoChildren) "/" "[Gmail]/All Mail"')[1],
            "[Gmail]/All Mail")

    def test_a_row_it_cannot_read_is_skipped_not_guessed(self):
        self.assertEqual(mail.parse_mailbox_row(b"* nonsense"), ("", ""))

    def test_the_servers_own_trash_flag_wins(self):
        conn = self.Conn([b'(\\HasNoChildren) "/" "Trash"',
                          b'(\\HasNoChildren \\Trash) "/" "Deleted Items"'])
        self.assertEqual(mail.find_trash(conn, "Trash"), "Deleted Items")

    def test_falls_back_to_the_configured_name_when_it_is_really_there(self):
        conn = self.Conn([b'(\\HasNoChildren) "/" "INBOX"',
                          b'(\\HasNoChildren) "/" "[Gmail]/Trash"'])
        self.assertEqual(mail.find_trash(conn, "[Gmail]/Trash"),
                         "[Gmail]/Trash")

    def test_a_configured_name_that_is_not_there_is_not_believed(self):
        conn = self.Conn([b'(\\HasNoChildren) "/" "INBOX"',
                          b'(\\HasNoChildren) "/" "Archive"'])
        self.assertIsNone(mail.find_trash(conn, "[Gmail]/Trash"))

    def test_the_gmail_hint_is_only_offered_to_gmail(self):
        self.assertIn("Show in IMAP",
                      mail.trash_hint({"host": "imap.gmail.com"}))
        self.assertEqual(mail.trash_hint({"host": "imap.zoho.com"}), "")

    def test_purge_refuses_before_moving_anything_with_no_trash(self):
        """The real 2026-10-04 failure: Gmail answered the first MOVE with
        TRYCREATE, mid-delete. The check belongs in the opening pass."""
        class NoTrashConn(self.Conn):
            def __init__(self):
                super().__init__([b'(\\HasNoChildren) "/" "INBOX"'])
                self.moved = []

            def select(self, box, readonly=False):
                return "OK", [b"1"]

            def uid(self, command, uid, dest):
                self.moved.append((uid, dest))
                return "OK", [b"done"]

            def logout(self):
                pass

        conn = NoTrashConn()
        selected = [(5, {"account": "gmail", "uid": "10", "subject": "Deal"}),
                    (6, {"account": "gmail", "uid": "11", "subject": "Sale"})]
        with mock.patch.object(
                mail, "connect",
                return_value=(conn, {"trash": "[Gmail]/Trash",
                                     "host": "imap.gmail.com"})):
            with self.assertRaises(RuntimeError) as raised:
                mail.purge_items(selected)
        self.assertEqual(conn.moved, [])
        self.assertIn("no Trash folder is visible", str(raised.exception))
        self.assertIn("Show in IMAP", str(raised.exception))


class FetchSenderTests(unittest.TestCase):
    """Every message from one sender, asked of each server directly --
    no recent-header window, and the server's substring FROM match
    narrowed back down to the exact address."""

    def test_asks_each_account_for_that_sender(self):
        calls = []

        def fake_gather(name, box, n, unseen, since=None, flagged=False,
                        frm=None):
            calls.append((name, box, frm))
            return [], None

        with mock.patch.object(mail, "accounts",
                               return_value={"gmail": {}, "zoho": {}}), \
             mock.patch.object(mail, "gather", side_effect=fake_gather):
            items, _, trouble = mail.fetch_sender(["gmail", "zoho"], "INBOX",
                                                  "p@h.com")
        self.assertEqual(calls, [("gmail", "INBOX", "p@h.com"),
                                 ("zoho", "INBOX", "p@h.com")])
        self.assertEqual(items, [])
        self.assertEqual(trouble, [])

    def test_drops_a_lookalike_the_server_substring_match_let_through(self):
        got = [
            {"from": "Pizza Hut <p@h.com>", "at": None, "uid": "1",
             "account": "gmail"},
            {"from": "Faker <not-p@h.com.example>", "at": None, "uid": "2",
             "account": "gmail"},
        ]
        with mock.patch.object(mail, "accounts", return_value={"gmail": {}}), \
             mock.patch.object(mail, "gather", return_value=(got, None)), \
             mock.patch.object(mail, "assign_message_numbers",
                               side_effect=lambda items: items):
            items, _, _ = mail.fetch_sender(["gmail"], "INBOX", "p@h.com")
        self.assertEqual([i["uid"] for i in items], ["1"])

    def test_an_account_that_is_down_is_reported_not_raised(self):
        with mock.patch.object(mail, "accounts", return_value={"gmail": {}}), \
             mock.patch.object(mail, "gather",
                               return_value=([], "gmail: cannot sign in")):
            items, _, trouble = mail.fetch_sender(["gmail"], "INBOX", "p@h.com")
        self.assertEqual(items, [])
        self.assertEqual(trouble, ["gmail: cannot sign in"])


class CmdFilterTests(unittest.TestCase):
    """`mail filter` reaches the cleanup loop on its own. Unsubscribing is
    a one-shot act; the mail it leaves behind outlives it."""

    def run_filter(self, target, entries=None):
        args = mail.argparse.Namespace(target=target, box="INBOX")
        with mock.patch.object(mail, "registry_entries",
                               return_value=(entries or {}, {})), \
             mock.patch.object(mail, "sender_cleanup_loop") as loop:
            mail.cmd_filter(args)
        return loop

    def test_an_address_goes_straight_to_the_loop(self):
        loop = self.run_filter("hello@e.stessa.com")
        loop.assert_called_once_with("hello@e.stessa.com", "INBOX")

    def test_an_address_in_angle_brackets_is_unwrapped(self):
        loop = self.run_filter('"Stessa" <Hello@E.Stessa.com>')
        loop.assert_called_once_with("hello@e.stessa.com", "INBOX")

    def test_a_message_number_uses_that_message_sender(self):
        entries = {76: ("key", {"from": '"Stessa" <hello@e.stessa.com>'})}
        loop = self.run_filter("76", entries)
        loop.assert_called_once_with("hello@e.stessa.com", "INBOX")

    def test_an_unknown_number_refuses(self):
        with self.assertRaises(SystemExit) as stopped:
            self.run_filter("99")
        self.assertIn("is unknown", str(stopped.exception))

    def test_a_row_numbered_before_senders_were_kept_reads_the_header(self):
        """Every row numbered by an older version lacks `from`. Re-listing
        mail Tom is looking at right now is not an acceptable price, so the
        header is fetched using the account and UID the registry does have."""
        class Conn:
            def __init__(self):
                self.fetched = []
                self.readonly = None

            def uid(self, command, uid, spec):
                self.fetched.append((command, uid, spec))
                return "OK", [(b"1", b'From: "Stessa" <hello@e.stessa.com>\r\n')]

            def logout(self):
                pass

        conn = Conn()
        entries = {76: ("key", {"account": "gmail", "uid": "10",
                                "box": "INBOX", "subject": "Deal"})}
        args = mail.argparse.Namespace(target="76", box="INBOX")
        with mock.patch.object(mail, "registry_entries",
                               return_value=(entries, {})), \
             mock.patch.object(mail, "connect", return_value=(conn, {})), \
             mock.patch.object(mail, "select") as selected, \
             mock.patch.object(mail, "sender_cleanup_loop") as loop:
            mail.cmd_filter(args)

        loop.assert_called_once_with("hello@e.stessa.com", "INBOX")
        self.assertEqual(selected.call_args[0][1], "INBOX")
        self.assertTrue(selected.call_args[1]["readonly"])
        self.assertIn("BODY.PEEK", conn.fetched[0][2])

    def test_a_row_with_no_account_on_record_refuses(self):
        with self.assertRaises(SystemExit) as stopped:
            self.run_filter("76", {76: ("key", {"subject": "Deal"})})
        self.assertIn("no account/uid on record", str(stopped.exception))

    def test_a_bare_word_is_neither_and_is_refused(self):
        with self.assertRaises(SystemExit) as stopped:
            self.run_filter("stessa")
        self.assertIn("email address, or a message number",
                      str(stopped.exception))

    def test_a_comma_list_loops_each_distinct_sender_once(self):
        entries = {14: ("key", {"from": "A <a@x.com>"}),
                   18: ("key", {"from": "B <b@y.com>"}),
                   22: ("key", {"from": "A <a@x.com>"})}
        loop = self.run_filter("14,18,22", entries)
        self.assertEqual([c.args[0] for c in loop.call_args_list],
                         ["a@x.com", "b@y.com"])

    def test_a_list_mixes_addresses_and_numbers(self):
        entries = {14: ("key", {"from": "A <a@x.com>"})}
        loop = self.run_filter("b@y.com,14", entries)
        self.assertEqual([c.args[0] for c in loop.call_args_list],
                         ["b@y.com", "a@x.com"])

    def test_a_bad_part_in_a_list_is_refused(self):
        entries = {14: ("key", {"from": "A <a@x.com>"})}
        with self.assertRaises(SystemExit) as stopped:
            self.run_filter("14,stessa", entries)
        self.assertIn("email address, or a message number",
                      str(stopped.exception))


class OfferCleanupTests(unittest.TestCase):
    """The prompt after `mail unsub`: list every message from that sender,
    then read one, delete some, delete all, or keep them. Read-only until
    a delete is actually chosen."""

    def setUp(self):
        self.items = [
            {"from": "Pizza Hut <p@h.com>", "message_no": 5,
             "account": "gmail", "box": "INBOX", "uid": "10",
             "subject": "Deal"},
            {"from": "Pizza Hut <p@h.com>", "message_no": 6,
             "account": "zoho", "box": "INBOX", "uid": "20",
             "subject": "Sale"},
        ]

    def offer(self, addr, no_prompt=False, answers=None, items=None,
              trouble=(), purge=None):
        answers = iter(answers or [])
        buf = io.StringIO()
        buf.isatty = lambda: True  # redirect_stdout puts this in sys.stdout
        found = self.items if items is None else items
        with mock.patch.object(mail.sys.stdin, "isatty", return_value=True), \
             mock.patch.object(mail.sys.stdout, "isatty", return_value=True), \
             mock.patch("builtins.input",
                        side_effect=lambda *a: next(answers)) as entered, \
             mock.patch.object(mail, "accounts",
                               return_value={"gmail": {}, "zoho": {}}), \
             mock.patch.object(mail, "fetch_sender",
                               return_value=(found, {}, list(trouble))) as fetched, \
             mock.patch.object(mail, "render_inbox") as rendered, \
             mock.patch.object(mail, "cmd_read") as read, \
             mock.patch.object(mail, "purge_items",
                               side_effect=purge) as purged, \
             contextlib.redirect_stdout(buf):
            mail.offer_sender_cleanup(addr, no_prompt)
        return entered, fetched, rendered, read, purged, buf.getvalue()

    def numbers(self, purged, call=0):
        """The message numbers one purge_items call was handed."""
        return [number for number, _ in purged.call_args_list[call][0][0]]

    def test_no_prompt_skips_without_asking(self):
        entered, fetched, _, _, _, _ = self.offer("p@h.com", no_prompt=True)
        entered.assert_not_called()
        fetched.assert_not_called()

    def test_empty_address_skips_without_asking(self):
        entered, fetched, _, _, _, _ = self.offer("", answers=[])
        entered.assert_not_called()
        fetched.assert_not_called()

    def test_no_fetches_nothing(self):
        entered, fetched, rendered, _, _, _ = self.offer("p@h.com",
                                                         answers=["n"])
        entered.assert_called_once()
        fetched.assert_not_called()
        rendered.assert_not_called()

    def test_the_question_promises_all_of_it(self):
        """The old prompt said "other mail" while only looking at a page of
        recent headers. The wording and the scope now match."""
        entered, _, _, _, _, _ = self.offer("p@h.com", answers=["n"])
        self.assertIn("List all mail from p@h.com",
                      entered.call_args[0][0])

    def test_yes_with_no_mail_from_that_sender_says_so(self):
        _, _, rendered, _, purged, text = self.offer(
            "p@h.com", answers=["y"], items=[])
        rendered.assert_not_called()
        purged.assert_not_called()
        self.assertIn("no mail from p@h.com", text)

    def test_yes_then_quit_keeps_them(self):
        _, _, rendered, _, purged, text = self.offer("p@h.com",
                                                     answers=["y", "q"])
        rendered.assert_called_once()
        purged.assert_not_called()
        self.assertIn("kept 2 message(s)", text)

    def test_yes_then_empty_keeps_them(self):
        _, _, _, _, purged, text = self.offer("p@h.com", answers=["y", ""])
        purged.assert_not_called()
        self.assertIn("kept 2 message(s)", text)

    def test_all_deletes_every_row_and_ends(self):
        _, _, rendered, _, purged, text = self.offer("p@h.com",
                                                     answers=["y", "all"])
        purged.assert_called_once()
        self.assertEqual(self.numbers(purged), [5, 6])
        self.assertEqual(rendered.call_count, 1)
        self.assertIn("no mail from p@h.com left", text)

    def test_rows_delete_the_subset_then_offer_the_rest(self):
        """The survivors are re-listed with their own numbers intact, which
        is the whole point of deleting some rather than all."""
        _, fetched, rendered, _, purged, _ = self.offer(
            "p@h.com", answers=["y", "5", "q"])
        self.assertEqual(self.numbers(purged), [5])
        self.assertEqual(rendered.call_count, 2)
        self.assertEqual([i["message_no"]
                          for i in rendered.call_args_list[1][0][0]], [6])
        fetched.assert_called_once()

    def test_rows_outside_the_list_delete_nothing(self):
        _, _, _, _, purged, text = self.offer("p@h.com",
                                              answers=["y", "9", "q"])
        purged.assert_not_called()
        self.assertIn("not in this list: 9", text)

    def test_garbled_rows_are_refused_and_the_list_stays(self):
        _, _, rendered, _, purged, text = self.offer(
            "p@h.com", answers=["y", "5;6", "q"])
        purged.assert_not_called()
        self.assertEqual(rendered.call_count, 2)
        self.assertIn("positive numbers", text)

    def test_read_prints_one_message_and_deletes_nothing(self):
        _, _, rendered, read, purged, _ = self.offer(
            "p@h.com", answers=["y", "r 5", "q"])
        read.assert_called_once()
        self.assertEqual(read.call_args[0][0].target, "5")
        self.assertFalse(read.call_args[0][0].mark)
        purged.assert_not_called()
        self.assertEqual(rendered.call_count, 2)

    def test_read_without_a_number_explains_the_shape(self):
        _, _, _, read, _, text = self.offer("p@h.com",
                                            answers=["y", "r", "q"])
        read.assert_not_called()
        self.assertIn("read takes one message number", text)

    def test_read_of_a_number_not_listed_is_refused(self):
        _, _, _, read, _, text = self.offer("p@h.com",
                                            answers=["y", "r 9", "q"])
        read.assert_not_called()
        self.assertIn("message 9 is not in this list", text)

    def test_a_short_fetch_is_said_out_loud(self):
        _, _, _, _, _, text = self.offer(
            "p@h.com", answers=["y", "q"],
            trouble=["zoho: cannot sign in"])
        self.assertIn("zoho: cannot sign in", text)
        self.assertIn("may be short", text)

    def test_a_failed_delete_is_reported_and_stops_the_loop(self):
        _, _, _, _, _, text = self.offer(
            "p@h.com", answers=["y", "all"],
            purge=RuntimeError("gmail: server does not support MOVE"))
        self.assertIn("does not support MOVE", text)

    def test_eof_at_the_question_leaves_quietly(self):
        with mock.patch.object(mail.sys.stdin, "isatty", return_value=True), \
             mock.patch.object(mail.sys.stdout, "isatty", return_value=True), \
             mock.patch("builtins.input", side_effect=EOFError), \
             mock.patch.object(mail, "fetch_sender") as fetched:
            mail.offer_sender_cleanup("p@h.com", False)
        fetched.assert_not_called()

    def test_eof_at_the_action_prompt_deletes_nothing(self):
        answers = iter(["y"])

        def once(*a):
            try:
                return next(answers)
            except StopIteration:
                raise EOFError
        buf = io.StringIO()
        buf.isatty = lambda: True
        with mock.patch.object(mail.sys.stdin, "isatty", return_value=True), \
             mock.patch.object(mail.sys.stdout, "isatty", return_value=True), \
             mock.patch("builtins.input", side_effect=once), \
             mock.patch.object(mail, "accounts", return_value={"gmail": {}}), \
             mock.patch.object(mail, "fetch_sender",
                               return_value=(self.items, {}, [])), \
             mock.patch.object(mail, "render_inbox"), \
             mock.patch.object(mail, "purge_items") as stopped, \
             contextlib.redirect_stdout(buf):
            mail.offer_sender_cleanup("p@h.com", False)
        stopped.assert_not_called()

    def test_non_tty_never_prompts(self):
        with mock.patch.object(mail.sys.stdin, "isatty", return_value=False), \
             mock.patch("builtins.input",
                        side_effect=AssertionError("must not prompt")):
            mail.offer_sender_cleanup("p@h.com", False)


if __name__ == "__main__":
    unittest.main()
