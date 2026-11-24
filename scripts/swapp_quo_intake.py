"""Durable native Quo intake. No sends, blocks, archive or delete operations."""
import copy
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from swapp_scan_progress import publish

STATE = Path.home() / ".local/state/swapp-quo-intake"
CLIENTS = Path.home() / "projects/clients"
MARKER = re.compile(r"\s*\[SWapp:.*?\]")
BRANDS = {"Signage": "bookkeeping-conroe", "Bookkeeping Conroe": "bookkeeping-conroe",
          "The Real Estate Bookkeeper": "real-estate-bookkeeper"}
VERDICTS = {"lead", "known", "legitimate", "potential-spam", "spam", "uncertain"}

def now():
    return dt.datetime.now(dt.timezone.utc)

def iso(value=None):
    return (value or now()).isoformat()

def normalized(number):
    digits = re.sub(r"\D", "", number or "")
    if len(digits) == 10:
        digits = "1" + digits
    return "+" + digits if 8 <= len(digits) <= 15 else ""

def slug(value):
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:90]

def atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + ".tmp")
    temp.write_text(value)
    os.chmod(temp, 0o600)
    os.replace(temp, path)

class Intake:
    def __init__(self, state=STATE, clients=CLIENTS, client=None, progress=None):
        self.state, self.clients = Path(state), Path(clients)
        self.progress = progress or publish
        self.state.mkdir(mode=0o700, parents=True, exist_ok=True)
        if client is None:
            sys.path.insert(0, str(Path.home() / "projects/sales/src"))
            from lochside_sales.config import Settings
            from lochside_sales.quo import QuoClient
            client = QuoClient(Settings.from_env())
        self.client = client
        self.db = sqlite3.connect(self.state / "intake.sqlite")
        self.db.row_factory = sqlite3.Row
        os.chmod(self.state / "intake.sqlite", 0o600)
        self.db.executescript("""
          CREATE TABLE IF NOT EXISTS threads(
            key TEXT PRIMARY KEY, conversation TEXT NOT NULL, brand TEXT,
            number TEXT NOT NULL, fingerprint TEXT NOT NULL,
            reviewed_fingerprint TEXT, verdict TEXT, prepared TEXT,
            analysis TEXT, folder TEXT, native_contact TEXT,
            error TEXT, first_seen_at TEXT, review_after TEXT,
            updated_at TEXT, inventoried_at TEXT);
          CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
          CREATE TABLE IF NOT EXISTS caller_holds(
            brand TEXT, number TEXT, first_seen_at TEXT NOT NULL, review_after TEXT NOT NULL,
            active INTEGER NOT NULL, PRIMARY KEY(brand,number));
          CREATE TABLE IF NOT EXISTS events(
            id INTEGER PRIMARY KEY, thread_key TEXT, at TEXT, action TEXT, verification TEXT);
          CREATE TABLE IF NOT EXISTS exports(
            thread_key TEXT, destination TEXT NOT NULL, PRIMARY KEY(thread_key,destination));

        """)

        export_columns = {r[1] for r in self.db.execute("PRAGMA table_info(exports)")}
        if "destination" not in export_columns:
            self.db.executescript("""
              ALTER TABLE exports RENAME TO exports_legacy;
              CREATE TABLE exports(thread_key TEXT,destination TEXT NOT NULL,PRIMARY KEY(thread_key,destination));
              INSERT INTO exports SELECT thread_key,'legacy' FROM exports_legacy;
              DROP TABLE exports_legacy;
            """)
        columns = {r[1] for r in self.db.execute("PRAGMA table_info(threads)")}
        if "attempted_at" not in columns:
            self.db.execute("ALTER TABLE threads ADD COLUMN attempted_at TEXT")
            self.db.commit()

    def report(self, stage):
        self.progress(stage, self.status())

    def close(self):
        self.db.close()

    def row(self, key):
        row = self.db.execute("SELECT * FROM threads WHERE key=?", (key,)).fetchone()
        if row is None:
            raise ValueError("Thread is not in the verified native inventory")
        return dict(row)

    def inventory(self):
        self.report("Checking Quo phone lines")
        lines = self.client.list_phone_numbers()
        self.report("Reading the full conversation backlog")
        conversations = self.client.list_conversations(None, [line["id"] for line in lines])
        by_line = {line["id"]: line for line in lines}
        stamp = iso()
        for conversation in conversations:
            participants = conversation.get("participants") or []
            if not conversation.get("id"):
                raise ValueError("Quo conversation has no stable ID")
            number = normalized(participants[0]) if len(participants) == 1 else ""
            line = by_line.get(conversation.get("phoneNumberId"), {})
            signature = hashlib.sha256(json.dumps({
                "lastActivityAt": conversation.get("lastActivityAt"),
                "lastActivityId": conversation.get("lastActivityId"),
                "participants": participants, "deletedAt": conversation.get("deletedAt"),
            }, sort_keys=True).encode()).hexdigest()
            self.db.execute("""
              INSERT INTO threads(key,conversation,brand,number,fingerprint,updated_at,inventoried_at)
              VALUES(?,?,?,?,?,?,?)
              ON CONFLICT(key) DO UPDATE SET conversation=excluded.conversation,
              brand=excluded.brand,number=excluded.number,
              fingerprint=excluded.fingerprint,updated_at=excluded.updated_at,
              inventoried_at=excluded.inventoried_at
            """, (conversation["id"], json.dumps(conversation), BRANDS.get(line.get("name")),
                  number, signature, conversation.get("lastActivityAt") or conversation.get("createdAt"), stamp))
        self.db.execute("INSERT OR REPLACE INTO settings VALUES('inventory',?)", (stamp,))
        self.db.commit()
        self.report("Conversation inventory updated")
        return {**self.status(), "lines": [{"name": x.get("name"), "id": x["id"]} for x in lines],
                "inventoried": len(conversations)}

    def status(self):
        total = self.db.execute("SELECT count(*) FROM threads").fetchone()[0]
        outstanding = self.db.execute("""
          SELECT count(*) FROM threads WHERE reviewed_fingerprint IS NULL
          OR reviewed_fingerprint != fingerprint OR error IS NOT NULL OR
          verdict IN ('potential-spam','spam','uncertain')
        """).fetchone()[0]
        inventory = self.db.execute("SELECT value FROM settings WHERE key='inventory'").fetchone()
        due = self.db.execute("SELECT count(*) FROM threads WHERE review_after<=?", (iso(),)).fetchone()[0]
        return {"total": total, "remaining": outstanding, "review_due": due,
                "inventory_at": inventory[0] if inventory else None,
                "reviewed": total - self.db.execute("""
                  SELECT count(*) FROM threads WHERE reviewed_fingerprint IS NULL
                  OR reviewed_fingerprint != fingerprint
                """).fetchone()[0]}

    def contacts(self, number):
        return [c for c in self.client.list_contacts() if any(
            normalized(p.get("value")) == number
            for p in (c.get("defaultFields") or {}).get("phoneNumbers", []))]

    def get_optional(self, path):
        try:
            return self.client.get(path, []).get("data")
        except Exception as error:
            if isinstance(error.__cause__, urllib.error.HTTPError) and error.__cause__.code == 404:
                return None
            raise

    def verify_audio(self, path):
        result = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0",
                                 "-show_entries", "stream=codec_type", "-of", "csv=p=0", str(path)],
                                capture_output=True, text=True, timeout=20)
        if result.returncode or "audio" not in result.stdout:
            raise ValueError("Downloaded recording failed audio verification")

    def download(self, url, target):
        if target.is_file() and target.stat().st_size > 0:
            self.verify_audio(target)
            return
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme != "https" or not parsed.hostname:
            raise ValueError("Recording did not have a valid HTTPS download URL")
        request = urllib.request.Request(url, headers={"User-Agent": "swapp-intake/1"})
        temporary = target.with_suffix(".download")
        try:
            with urllib.request.urlopen(request, timeout=45) as response, temporary.open("wb") as out:
                size = 0
                while chunk := response.read(1024 * 1024):
                    size += len(chunk)
                    if size > 100 * 1024 * 1024:
                        raise ValueError("Recording exceeds the 100MB intake limit")
                    out.write(chunk)
            os.chmod(temporary, 0o600)
            self.verify_audio(temporary)
            os.replace(temporary, target)
        finally:
            temporary.unlink(missing_ok=True)

    def transcribe(self, audio, transcript):
        worker = Path(__file__).with_name("swapp_transcribe.py")
        python = Path.home() / "transcribe-mp4/.venv/bin/python"
        result = subprocess.run([str(python), str(worker), str(audio), str(transcript)],
                                capture_output=True, text=True, timeout=240)
        if result.returncode or not transcript.is_file():
            raise RuntimeError("Local voicemail transcription failed; check transcription worker")
        return transcript.read_text()

    def prepare(self, key):
        self.report("Reading conversation history")
        row = self.row(key)
        conversation = json.loads(row["conversation"])
        if not row["number"] or not row["brand"]:
            raise ValueError("Unknown brand or group conversation needs identity review")
        messages = self.client.list_messages(conversation, None)
        self.report("Checking calls and voicemails")
        calls = self.client.list_calls(conversation["phoneNumberId"], row["number"], None)
        self.report("Matching the caller to existing contacts")
        matches = self.contacts(row["number"])
        if len(matches) > 1:
            raise ValueError("Multiple native contacts match this number; review identity")
        directory = self.clients / "_unfiled-calls" / (row["updated_at"] or iso())[:10]
        directory.mkdir(parents=True, exist_ok=True)
        recordings, errors, transcripts = [], [], []
        for call in calls:
            if call.get("direction") != "incoming":
                continue
            call_id = call["id"]
            voicemail = self.get_optional("/call-voicemails/" + urllib.parse.quote(call_id, safe=""))
            if not voicemail:
                continue
            if voicemail.get("status") != "completed":
                errors.append(call_id + ": voicemail still processing")
                continue
            if not voicemail.get("recordingUrl"):
                errors.append(call_id + ": voicemail recording unavailable")
                continue
            name = "call-" + slug(call_id) + "-" + row["brand"] + "-" + row["number"][1:]
            audio = directory / (name + ".mp3")
            text_path = directory / ("transcript-" + name + ".txt")
            try:
                self.report("Checking saved voicemail recording" if audio.is_file() else "Downloading voicemail recording")
                self.download(voicemail["recordingUrl"], audio)
                self.report("Voicemail recording verified")
                text = (voicemail.get("transcript") or "").strip()
                origin = "Quo"
                if not text:
                    self.report("Transcribing voicemail audio")
                    text = self.transcribe(audio, text_path)
                    origin = "faster-whisper"
                text = text.strip() or "[No intelligible speech detected]"
                self.report("Saving voicemail transcript")
                atomic(text_path, text + "\n")
                recordings.append({"call_id": call_id, "audio": str(audio),
                                   "transcript": str(text_path), "transcript_source": origin,
                                   "sha256": hashlib.sha256(audio.read_bytes()).hexdigest()})
                transcripts.append({"call_id": call_id, "text": text})
            except (OSError, RuntimeError, ValueError, subprocess.TimeoutExpired, urllib.error.URLError):
                errors.append(call_id + ": recording download or transcription failed")
                self.report("Voicemail download or transcription needs attention")
        evidence = {"key": key, "brand": row["brand"], "number": row["number"],
                    "conversation_id": conversation["id"],
                    "messages": messages, "calls": calls, "transcripts": transcripts,
                    "recordings": recordings, "contacts": matches, "errors": errors}
        evidence["context_complete"] = len(json.dumps(evidence)) <= 70000
        if not evidence["context_complete"]:
            errors.append("Conversation exceeds the bounded review context; needs a larger-context review")
        self.db.execute("UPDATE threads SET prepared=?,error=? WHERE key=?",
                        (json.dumps(evidence), "; ".join(errors) if errors else None, key))
        self.db.commit()
        if not evidence["context_complete"]:
            return {"key": key, "error": errors[-1], "context_complete": False}
        self.report("Analyzing conversation and voicemail")
        return evidence

    def next_item(self):
        row = self.db.execute("""
          SELECT key FROM threads WHERE reviewed_fingerprint IS NULL
          OR reviewed_fingerprint!=fingerprint
          ORDER BY attempted_at IS NOT NULL, attempted_at, updated_at DESC LIMIT 1
        """).fetchone()
        if row is None:
            row = self.db.execute("SELECT key FROM threads WHERE error IS NOT NULL ORDER BY updated_at DESC LIMIT 1").fetchone()
        if row is None:
            return {"item": None, **self.status()}
        self.db.execute("UPDATE threads SET attempted_at=? WHERE key=?", (iso(), row["key"]))
        self.db.commit()
        try:
            return {"item": self.prepare(row["key"]), **self.status()}
        except Exception as error:
            self.db.execute("UPDATE threads SET error=? WHERE key=?", (str(error)[:280], row["key"]))
            self.db.commit()
            self.report("Conversation needs attention")
            return {"item": {"key": row["key"], "error": str(error)[:280]}, **self.status()}

    def write_contact(self, existing, number, facts, verdict, review_after):
        fields = copy.deepcopy((existing or {}).get("defaultFields") or {})
        for key in ("firstName", "lastName", "company"):
            if facts.get(key) and (not fields.get(key) or fields[key] in ("Unknown", "Caller")):
                fields[key] = facts[key]
        fields.setdefault("firstName", "Unknown")
        fields.setdefault("lastName", "Caller")
        fields.setdefault("phoneNumbers", [{"name": "Phone", "value": number}])
        fields.setdefault("emails", [])
        if facts.get("email") and not fields["emails"]:
            fields["emails"] = [{"name": "Email", "value": facts["email"]}]
        base_role = MARKER.sub("", fields.get("role") or "").strip()
        label = {"potential-spam": "Potential spam", "spam": "Potential spam", "lead": "Lead"}.get(verdict)
        original_role = fields.get("role")
        fields["role"] = base_role + ((" [SWapp: " + label +
            ("; review " + review_after[:10] if review_after and verdict != "lead" else "") + "]") if label else "")
        if not label and not original_role:
            fields["role"] = original_role
        body = {"defaultFields": fields, "customFields": copy.deepcopy((existing or {}).get("customFields") or [])}
        for key in ("externalId", "source", "sourceUrl"):
            if existing and existing.get(key) is not None:
                body[key] = existing[key]
        if existing:
            path, method = "/contacts/" + existing["id"], "PATCH"
        else:
            body.update({"externalId": "swapp-" + number[1:], "source": "swapp-scan"})
            path, method = "/contacts", "POST"
        request = urllib.request.Request(self.client.base_url + path, data=json.dumps(body).encode(),
             method=method, headers={"Authorization": self.client.settings.quo_api_key,
             "Content-Type": "application/json", "User-Agent": "lochside-sales/0.1"})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                saved = json.load(response)["data"]
        except urllib.error.HTTPError as error:
            raise RuntimeError("Quo contact write failed (HTTP %d); native update remains pending" % error.code) from error
        verified = self.client.get("/contacts/" + saved["id"], [])["data"]
        actual_fields = verified.get("defaultFields") or {}
        for field, expected in fields.items():
            actual = actual_fields.get(field)
            if field in ("phoneNumbers", "emails"):
                # Quo adds its own IDs to each array item. Verify the contact
                # values without treating those server IDs as a mismatch.
                expected = sorted((item.get("name"), item.get("value")) for item in expected or [])
                actual = sorted((item.get("name"), item.get("value")) for item in actual or [])
            if actual != expected:
                raise RuntimeError("Quo contact read-back mismatch in " + field)
        expected_custom = {item["key"]: item.get("value") for item in body["customFields"]}
        actual_custom = {item["key"]: item.get("value") for item in verified.get("customFields", [])}
        if actual_custom != expected_custom:
            raise RuntimeError("Quo contact read-back mismatch in custom fields")
        return verified

    def folder(self, row, facts, create=True):
        if row["folder"]:
            path = Path(row["folder"]).resolve()
            if not path.is_relative_to(self.clients.resolve()):
                raise ValueError("Stored folder is outside client storage")
            if not path.is_relative_to((self.clients / "_unfiled-calls").resolve()):
                return path
        matches = set()
        for base in (self.clients / "_leads", self.clients):
            base.mkdir(parents=True, exist_ok=True)
            for directory in base.iterdir():
                if not directory.is_dir() or directory.name.startswith("_"):
                    continue
                identity_names = {slug(facts.get("company") or ""),
                                  slug(" ".join(filter(None, [facts.get("firstName"), facts.get("lastName")])))} - {""}
                if directory.name in identity_names:
                    matches.add(directory)
                if any(row["number"][1:] in re.sub(r"\D", "", item.name)
                       for item in (directory / "comms").glob("*") if item.is_file()):
                    matches.add(directory)
                for file in directory.glob("*.md"):
                    if row["number"][1:] in re.sub(r"\D", "", file.read_text(errors="replace")):
                        matches.add(directory)
        if len(matches) > 1:
            raise ValueError("Multiple folders match this caller; identity review required")
        if matches:
            return matches.pop()
        if not create:
            return None
        label = facts.get("company") or " ".join(filter(None, [facts.get("firstName"), facts.get("lastName")]))
        return self.clients / "_leads" / ((slug(label) or "caller") + "-" + row["number"][1:])

    def apply(self, key, verdict, facts, summary, evidence_ids):
        self.report("Verifying the conversation analysis")
        if verdict not in VERDICTS or not isinstance(facts, dict) or not summary.strip():
            raise ValueError("Disposition, facts and summary are required")
        if any(k not in ("firstName", "lastName", "company", "email") or not isinstance(v, str)
               or len(v) > 250 for k, v in facts.items()):
            raise ValueError("Invalid contact facts")
        row = self.row(key)
        if not row["prepared"]:
            raise ValueError("Read and prepare this thread before classifying it")
        evidence = json.loads(row["prepared"])
        if evidence.get("context_complete") is False:
            raise ValueError("Full conversation exceeds reviewer context; leave it pending")
        conversation = json.loads(row["conversation"])
        fresh_messages = self.client.list_messages(conversation, None)
        fresh_calls = self.client.list_calls(conversation["phoneNumberId"], row["number"], None)
        ids = {x["id"] for x in evidence["messages"] + evidence["calls"]}
        if ids != {x["id"] for x in fresh_messages + fresh_calls}:
            raise ValueError("Conversation changed during review; refresh it before applying a disposition")
        if not evidence_ids or not set(evidence_ids).issubset(ids):
            raise ValueError("Classification must reference actual source IDs")
        matches = self.contacts(row["number"])
        if len(matches) > 1:
            raise ValueError("Multiple contacts match this number")
        contact = matches[0] if matches else None
        established = self.db.execute("""
            SELECT 1 FROM threads WHERE brand=? AND number=? AND verdict IN ('lead','known') LIMIT 1
        """, (row["brand"], row["number"])).fetchone()
        known = bool(contact and (
            contact.get("source") != "swapp-scan"
            or "[SWapp: Lead]" in ((contact.get("defaultFields") or {}).get("role") or "")
            or established
        ))
        if known and verdict in ("potential-spam", "spam"):
            raise ValueError("Existing native contact is protected; resolve its identity instead")
        inbound = [m for m in evidence["messages"] if m.get("direction") == "incoming"]
        substantive = any((m.get("text") or m.get("body") or "").strip() for m in inbound) or any(
            t["text"] != "[No intelligible speech detected]" for t in evidence["transcripts"])
        incoming_calls = any(c.get("direction") == "incoming" and not c.get("answeredAt")
                             for c in evidence["calls"])
        if evidence["errors"] and verdict in ("potential-spam", "spam"):
            raise ValueError("Voicemail evidence is incomplete; do not infer spam from missing media")
        if not substantive and not known and incoming_calls:
            verdict = "potential-spam"
        elif not substantive and not known:
            verdict = "uncertain"
        first_seen, review_after = row["first_seen_at"], row["review_after"]
        if verdict in ("potential-spam", "spam"):
            self.report("Recording a 14-day potential-spam hold")
            hold = self.db.execute(
                "SELECT * FROM caller_holds WHERE brand=? AND number=?",
                (row["brand"], row["number"])).fetchone()
            first_seen = hold["first_seen_at"] if hold and hold["active"] else iso()
            review_after = iso(dt.datetime.fromisoformat(first_seen) + dt.timedelta(days=14))
            self.db.execute("INSERT OR REPLACE INTO caller_holds VALUES(?,?,?,?,1)",
                            (row["brand"], row["number"], first_seen, review_after))
        else:
            review_after = None
            if verdict in ("lead", "known", "legitimate"):
                self.db.execute("UPDATE caller_holds SET active=0 WHERE brand=? AND number=?",
                                (row["brand"], row["number"]))
                self.db.execute("""UPDATE threads SET review_after=NULL, verdict='legitimate'
                  WHERE brand=? AND number=? AND verdict IN ('potential-spam','spam')""",
                  (row["brand"], row["number"]))
        analysis = {"verdict": verdict, "facts": facts, "summary": summary,
                    "evidence_ids": evidence_ids, "analyzed_at": iso()}
        self.db.execute("UPDATE threads SET verdict=?,analysis=?,first_seen_at=?,review_after=? WHERE key=?",
                        (verdict, json.dumps(analysis), first_seen, review_after, key))
        self.db.commit()
        errors, actions = list(evidence["errors"]), []
        if verdict == "uncertain":
            errors.append("Conversation requires an identity or intent decision")
        folder = None
        if verdict == "lead" or (known and verdict == "known"):
            self.report("Filing conversation evidence on Ripley")
            folder_facts = {k: v for k, v in ((contact or {}).get("defaultFields") or {}).items()
                            if k in ("firstName", "lastName", "company") and v}
            folder_facts.update({k: v for k, v in facts.items() if v})
            folder = self.folder(row, folder_facts, create=verdict == "lead")
            if folder is None:
                folder = self.clients / "_unfiled-calls" / (row["updated_at"] or iso())[:10]
                errors.append("Known contact has no matched client folder; confirm the filing destination")
            (folder / "comms").mkdir(parents=True, exist_ok=True)
            for media in evidence["recordings"]:
                for name in ("audio", "transcript"):
                    original = Path(media[name])
                    target = folder / "comms" / original.name
                    if original != target:
                        shutil.copy2(original, target)
                        if hashlib.sha256(target.read_bytes()).digest() != hashlib.sha256(original.read_bytes()).digest():
                            raise RuntimeError("Filed media failed checksum verification")
                        media[name] = str(target)
            manifest = {"brand": row["brand"], "phone": row["number"], "conversation_id": key,
                        "analysis": analysis, "recordings": evidence["recordings"],
                        "phone_line_id": conversation["phoneNumberId"], "filed_at": iso()}
            atomic(folder / "comms" / ("intake-" + slug(key) + ".json"), json.dumps(manifest, indent=2))
            atomic(folder / "comms" / ("analysis-" + slug(key) + ".md"),
                   "# Quo conversation review\n\n" + summary + "\n\nSource IDs: " + ", ".join(evidence_ids) + "\n")
            self.db.execute("UPDATE threads SET folder=? WHERE key=?", (str(folder), key))
            self.db.commit()
            actions.append("Filed analysis and %d voicemail recordings in %s" % (len(evidence["recordings"]), folder))
        if verdict in ("lead", "potential-spam", "spam") or (
                contact and "[SWapp:" in ((contact.get("defaultFields") or {}).get("role") or "")):
            try:
                self.report("Updating Quo contact fields")
                contact = self.write_contact(contact, row["number"], facts, verdict, review_after)
                self.report("Quo contact update verified")
                actions.append("Verified native Quo contact and disposition")
            except RuntimeError as error:
                errors.append(str(error))
        for media in evidence["recordings"]:
            actions.append("Verified audio and transcript for " + media["call_id"])
        self.db.execute("UPDATE threads SET reviewed_fingerprint=?,native_contact=?,error=?,prepared=? WHERE key=?",
            (row["fingerprint"], contact["id"] if contact else None, "; ".join(errors) if errors else None,
             json.dumps(evidence), key))
        for action in actions:
            self.db.execute("INSERT INTO events(thread_key,at,action,verification) VALUES(?,?,?,?)",
                            (key, iso(), action, "Read-back and/or local checksum verified"))
        self.db.commit()
        self.report("Conversation review saved" if not errors else "Conversation saved with work still pending")
        return {"key": key, "verdict": verdict, "actions": actions, "errors": errors,
                "review_after": review_after, "folder": str(folder) if folder else None, **self.status()}

    def event_cursor(self):
        return self.db.execute("SELECT coalesce(max(id),0) FROM events").fetchone()[0]

    def events_after(self, cursor):
        return [dict(r) for r in self.db.execute("SELECT * FROM events WHERE id>? ORDER BY id", (cursor,))]

    def lead_exports(self, destination="default"):
        result = []
        for row in self.db.execute("""SELECT * FROM threads WHERE verdict='lead'
            AND folder IS NOT NULL AND error IS NULL
            AND key NOT IN (SELECT thread_key FROM exports WHERE destination=?) LIMIT 20""", (destination,)):
            analysis = json.loads(row["analysis"])
            facts = analysis["facts"]
            result.append({"key": row["key"], "brand": row["brand"],
                "name": " ".join(filter(None,[facts.get("firstName"),facts.get("lastName")])) or facts.get("company") or row["number"],
                "phone": row["number"], "email": facts.get("email"), "company": facts.get("company"),
                "source": "quo", "sourceDetail": "Evidence-reviewed Quo conversation",
                "note": analysis["summary"] + " | Files: " + row["folder"]})
        return result

    def acknowledge_exports(self, keys, destination="default"):
        self.db.executemany("INSERT OR IGNORE INTO exports VALUES(?,?)", [(key,destination) for key in keys])
        self.db.commit()
        return {"acknowledged": len(keys)}

    def held_items(self):
        return [dict(r) for r in self.db.execute("""
           SELECT key,number,brand,verdict,first_seen_at,review_after,error FROM threads
           WHERE review_after IS NOT NULL ORDER BY review_after
        """)]

def execute(operation, **arguments):
    STATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (STATE / "intake.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        service = Intake()
        try:
            operations = {"inventory": service.inventory, "next": service.next_item,
                          "apply": service.apply, "inspect": service.prepare, "status": service.status, "holds": service.held_items,
                          "event_cursor": service.event_cursor, "events_after": service.events_after,
                          "lead_exports": service.lead_exports, "acknowledge_exports": service.acknowledge_exports}
            if operation not in operations:
                raise ValueError("Unknown intake operation")
            return operations[operation](**arguments)
        finally:
            service.close()
