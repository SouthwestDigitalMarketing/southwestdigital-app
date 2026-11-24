import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import swapp_scan_mailreviews as mr  # noqa: E402


class PlanTest(unittest.TestCase):
    def test_groups_answers_into_mailroom_commands(self):
        items = [
            {"id": "1", "review": "spam", "itemKey": "12", "answer": "spam"},
            {"id": "2", "review": "spam", "itemKey": "13", "answer": "not-spam"},
            {"id": "3", "review": "newsletter", "itemKey": "a@x.com", "answer": "keep"},
            {"id": "4", "review": "newsletter", "itemKey": "b@x.com", "answer": "clear"},
            {"id": "5", "review": "newsletter-undo", "itemKey": "t", "answer": "undo"},
        ]
        commands, refused = mr.plan(items)
        self.assertEqual(refused, [])
        args = [command[1:] for command, _ in commands]
        self.assertEqual(args, [
            ["restore", "13"],
            ["confirm", "12"],
            ["decide", "--keep", "a@x.com", "--clear", "b@x.com", "--yes"],
            ["undo"],
        ])

    def test_refuses_keys_that_could_smuggle_arguments(self):
        items = [
            {"id": "1", "review": "spam", "itemKey": "--yes", "answer": "spam"},
            {"id": "2", "review": "newsletter", "itemKey": "a@x.com,b@y.com", "answer": "clear"},
            {"id": "3", "review": "spam", "itemKey": "4", "answer": "purge"},
        ]
        commands, refused = mr.plan(items)
        self.assertEqual(commands, [])
        self.assertEqual([r["id"] for r in refused], ["1", "2", "3"])

    def test_apply_reports_results_and_pushes_lists(self):
        calls = []

        def api(url, token, method="GET", body=None):
            calls.append((url.rsplit("/api/", 1)[1], method, body))
            if method == "GET":
                return 200, {"items": [{"id": "1", "review": "spam", "itemKey": "5", "answer": "spam"}]}
            return 200, {}

        def run(command, timeout=0):
            if command[1:] == ["report", "--json"]:
                return 0, "[]"
            if command[1:] == ["show", "--json"]:
                return 0, "[]"
            return 0, "confirmed 1 message(s) as spam\n"

        self.assertEqual(mr.apply_answers("https://x", "t", api, run), 1)
        applied = [c for c in calls if c[0] == "scan/reviews/applied"][0][2]
        self.assertEqual(applied, {"results": [{"id": "1", "ok": True, "result": "confirmed 1 message(s) as spam"}]})
        self.assertEqual(calls[-1][0], "scan/reviews")
        self.assertEqual(calls[-1][2], {"lists": {"spam": [], "newsletter": []}})

    def test_unreadable_list_is_left_out(self):
        sent = []
        api = lambda url, token, method="GET", body=None: (sent.append(body) or (200, {}))
        run = lambda command, timeout=0: (1, "boom") if "show" in command else (0, "[]")
        self.assertEqual(mr.push_lists("https://x", "t", api, run), {"spam": 0, "newsletter": None})
        self.assertEqual(sent, [{"lists": {"spam": []}}])


if __name__ == "__main__":
    unittest.main()
