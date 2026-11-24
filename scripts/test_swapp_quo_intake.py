import copy
import datetime as dt
import io
import json
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest
from unittest.mock import patch

import swapp_quo_intake as intake


class FakeQuo:
    base_url = "https://api.quo.com/v1"
    settings = SimpleNamespace(quo_api_key="test-not-a-real-key")

    def __init__(self):
        self.conversations = [{"id": "CV1", "phoneNumberId": "PN1",
                               "participants": ["+15555550123"], "lastActivityId": "AC1",
                               "lastActivityAt": "2026-11-23T00:00:00Z"}]
        self.messages = []
        self.calls = [{"id": "AC1", "direction": "incoming"}]
        self.saved_contacts = []
        self.voicemail = None

    def list_phone_numbers(self):
        return [{"id": "PN1", "name": "Signage"}]

    def list_conversations(self, *_):
        return self.conversations

    def list_messages(self, *_):
        return self.messages

    def list_calls(self, *_):
        return self.calls

    def list_contacts(self):
        return self.saved_contacts

    def get(self, path, *_):
        if path.startswith("/call-voicemails/"):
            return {"data": self.voicemail}
        return {"data": self.saved_contacts[0]}


class IntakeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.q = FakeQuo()
        self.service = intake.Intake(self.root/"state", self.root/"clients", self.q)
        self.addCleanup(lambda: self.service.close())
        self.service.inventory()

    def classify(self, verdict="potential-spam", facts=None):
        self.service.prepare("CV1")
        with patch.object(self.service, "write_contact", return_value={"id": "CT1"}):
            return self.service.apply("CV1", verdict, facts or {}, "Test evidence summary",
                                      ["M1"] if self.q.messages else ["AC1"])

    def test_no_message_never_becomes_confirmed_spam_and_hold_survives_restart(self):
        result = self.classify("spam")
        self.assertEqual(result["verdict"], "potential-spam")
        start = self.service.row("CV1")["first_seen_at"]
        due = dt.datetime.fromisoformat(result["review_after"])
        self.assertEqual(due - dt.datetime.fromisoformat(start), dt.timedelta(days=14))
        other = intake.Intake(self.root/"state", self.root/"clients", self.q)
        try:
            self.assertEqual(other.row("CV1")["review_after"], result["review_after"])
        finally:
            other.close()
        self.assertEqual(self.classify()["review_after"], result["review_after"])
        self.assertEqual(self.service.status()["remaining"], 1)

    def test_later_genuine_message_cancels_hold_and_reuses_lead_folder(self):
        self.classify()
        self.q.messages = [{"id": "M1", "direction": "incoming", "text": "I need bookkeeping"}]
        self.q.conversations[0]["lastActivityId"] = "M1"
        self.service.inventory()
        result = self.classify("lead", {"company": "Example business"})
        self.assertIsNone(result["review_after"])
        self.assertEqual(self.service.status()["review_due"], 0)
        folder = Path(result["folder"])
        self.assertTrue((folder/"comms/intake-cv1.json").exists())
        self.assertEqual(self.classify("lead", {"company": "A new spelling"})["folder"], str(folder))
        self.assertEqual(len(list((self.root/"clients/_leads").iterdir())), 1)

    def test_existing_real_contact_cannot_be_marked_spam(self):
        self.q.saved_contacts = [{"id": "CT1", "source": "manual", "defaultFields": {
            "firstName": "Existing client", "phoneNumbers": [{"value": "+15555550123"}]}}]
        with self.assertRaisesRegex(ValueError, "protected"):
            self.classify()

    def test_scan_created_lead_is_protected_from_later_spam_classification(self):
        self.q.saved_contacts = [{"id": "CT1", "source": "swapp-scan", "defaultFields": {
            "firstName": "Lead", "role": "[SWapp: Lead]", "phoneNumbers": [{"value": "+15555550123"}]}}]
        with self.assertRaisesRegex(ValueError, "protected"):
            self.classify()

    def test_failed_media_cannot_be_treated_as_silence(self):
        self.q.voicemail = {"status": "in-progress"}
        with self.assertRaisesRegex(ValueError, "incomplete"):
            self.classify()

    def test_contact_changes_do_not_invalidate_review_but_new_activity_does(self):
        self.classify()
        self.q.conversations[0]["updatedAt"] = "2026-11-24T00:00:00Z"
        self.service.inventory()
        self.assertEqual(self.service.status()["reviewed"], 1)
        self.q.conversations[0]["lastActivityId"] = "M2"
        self.service.inventory()
        self.assertEqual(self.service.status()["reviewed"], 0)

    def test_arbitrary_evidence_ids_rejected(self):
        self.service.prepare("CV1")
        with self.assertRaisesRegex(ValueError, "actual source IDs"):
            self.service.apply("CV1", "lead", {}, "Need bookkeeping", ["invented"])

    def test_unknown_outbound_only_conversation_is_not_spam(self):
        self.q.calls = [{"id": "AC1", "direction": "outgoing"}]
        self.assertEqual(self.classify("spam")["verdict"], "uncertain")

    def test_native_patch_preserves_other_phones_emails_roles_and_custom_fields(self):
        old = {"id": "CT1", "source": "manual", "defaultFields": {
            "firstName": "Existing", "lastName": "Person", "company": "Old Company",
            "role": "Director", "phoneNumbers": [{"name": "Work", "value": "+15555550123"},
                {"name": "Mobile", "value": "+15555550124"}],
            "emails": [{"name": "Work", "value": "existing@example.com"}]},
            "customFields": [{"key": "special", "value": "preserved"}]}
        observed = []

        def respond(request, **_):
            body = json.loads(request.data)
            observed.append(body)
            verified = copy.deepcopy({"id": "CT1", **body})
            for index, phone in enumerate(verified["defaultFields"]["phoneNumbers"]):
                phone["id"] = "server-added-id-" + str(index)
            self.q.saved_contacts = [verified]
            return io.BytesIO(json.dumps({"data": verified}).encode())

        with patch.object(intake.urllib.request, "urlopen", side_effect=respond):
            self.service.write_contact(old, "+15555550123", {"firstName": "Do not overwrite"}, "lead", None)
        fields = observed[0]["defaultFields"]
        self.assertEqual(fields["firstName"], "Existing")
        self.assertEqual(fields["phoneNumbers"], old["defaultFields"]["phoneNumbers"])
        self.assertEqual(fields["emails"], old["defaultFields"]["emails"])
        self.assertEqual(observed[0]["customFields"], old["customFields"])
        self.assertIn("Director", fields["role"])
        self.assertIn("[SWapp: Lead]", fields["role"])

    def test_exports_acknowledged_only_after_server_acceptance(self):
        self.q.messages = [{"id": "M1", "direction": "incoming", "text": "Need bookkeeping"}]
        self.classify("lead")
        self.assertEqual(len(self.service.lead_exports()), 1)
        self.service.acknowledge_exports(["CV1"])
        self.assertEqual(self.service.lead_exports(), [])
        self.assertEqual(len(self.service.lead_exports(destination="another-app")), 1)


if __name__ == "__main__":
    unittest.main()
