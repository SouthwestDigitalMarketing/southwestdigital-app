"""Bounded stdio MCP bridge for source-review CLIs, shared by Codex and Claude."""
import json
from pathlib import Path
import swapp_quo_intake
import subprocess
import sys

SALES = Path.home() / "projects/sales/bin"
MAIL = Path.home() / "projects/mailroom-app/bin/mail"
VERBS = {
    "quo": ("status", "list", "help"),
    "sms": ("ls", "show", "status", "help"),
    "calls": ("ls", "show", "status", "help"),
    "pipe": ("help", "all", "show", "today", "tasks", "task ls", "task show",
             "task add", "task note", "task instructions"),
    "mail": ("ls", "read", "search", "draft", "move", "folders"),
}


def run_command(command, arguments):
    if command not in VERBS or not isinstance(arguments, list) or not all(isinstance(arg, str) for arg in arguments):
        raise ValueError("Unknown command or invalid arguments")
    if not any(arguments[:len(verb.split())] == verb.split() for verb in VERBS[command]):
        raise ValueError("This operation is outside the source review permissions")
    executable = MAIL if command == "mail" else SALES / command
    # Arguments are passed directly, never through a shell.
    result = subprocess.run([str(executable), *arguments], input="", capture_output=True,
                            text=True, timeout=60)
    return {"exit_code": result.returncode, "stdout": result.stdout[:60000], "stderr": result.stderr[:1000]}


TOOL = {
    "name": "source_command",
    "description": "Run an approved source-review CLI. Commands and verbs: " + json.dumps(VERBS),
    "inputSchema": {"type": "object", "properties": {
        "command": {"type": "string", "enum": list(VERBS)},
        "arguments": {"type": "array", "items": {"type": "string"}},
    }, "required": ["command", "arguments"], "additionalProperties": False},
}


INTAKE_TOOL = {
    "name": "quo_intake",
    "description": (
        "Native Quo intake across ALL lines. inventory refreshes the full conversation list. "
        "next reads one queued full thread, downloads available voicemail audio, and saves transcripts. "
        "apply records your evidence-based analysis, files media in the matched lead/client folder, "
        "updates native contact fields or the provisional Potential spam role, and persists a 14-day hold. "
        "status returns exact queue counts. holds lists retained provisional numbers. "
        "inspect with key rereads any held thread before a due review. "
        "Use next/apply repeatedly; then status. No deletion, blocking, or sending is available."
    ),
    "inputSchema": {"type": "object", "properties": {
        "operation": {"type": "string", "enum": ["inventory", "next", "inspect", "apply", "status", "holds"]},
        "key": {"type": "string"},
        "verdict": {"type": "string", "enum": sorted(swapp_quo_intake.VERDICTS)},
        "facts": {"type": "object", "properties": {
            k: {"type": "string"} for k in ["firstName", "lastName", "company", "email"]
        }, "additionalProperties": False},
        "summary": {"type": "string"},
        "evidence_ids": {"type": "array", "items": {"type": "string"}},
    }, "required": ["operation"], "additionalProperties": False},
}


def serve():
    for line in sys.stdin:
        request = json.loads(line)
        if "id" not in request:
            continue
        try:
            method = request["method"]
            if method == "initialize":
                result = {"protocolVersion": request.get("params", {}).get("protocolVersion", "2024-11-05"),
                          "capabilities": {"tools": {}},
                          "serverInfo": {"name": "swapp-source-review", "version": "1.0.0"}}
            elif method == "tools/list":
                result = {"tools": [TOOL, INTAKE_TOOL]}
            elif method == "tools/call":
                params = request["params"]
                if params["name"] == TOOL["name"]:
                    output = run_command(**params["arguments"])
                elif params["name"] == INTAKE_TOOL["name"]:
                    if params["arguments"].get("operation") not in {"inventory", "next", "inspect", "apply", "status", "holds"}:
                        raise ValueError("This intake operation is internal")
                    data = swapp_quo_intake.execute(**params["arguments"])
                    output = {"exit_code": 0, "data": data}
                else:
                    raise ValueError("Unknown tool")
                result = {"content": [{"type": "text", "text": json.dumps(output)}],
                          "isError": output["exit_code"] != 0}
            elif method == "ping":
                result = {}
            else:
                raise ValueError("Unsupported method")
            response = {"jsonrpc": "2.0", "id": request["id"], "result": result}
        except (ValueError, KeyError, TypeError, RuntimeError, OSError, subprocess.TimeoutExpired) as error:
            response = {"jsonrpc": "2.0", "id": request["id"],
                        "error": {"code": -32602, "message": str(error)}}
        print(json.dumps(response), flush=True)


if __name__ == "__main__":
    serve()
