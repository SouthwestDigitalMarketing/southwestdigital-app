"""Bounded stdio MCP bridge for source-review CLIs, shared by Codex and Claude."""
import json
from pathlib import Path
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
                result = {"tools": [TOOL]}
            elif method == "tools/call":
                params = request["params"]
                if params["name"] != TOOL["name"]:
                    raise ValueError("Unknown tool")
                output = run_command(**params["arguments"])
                result = {"content": [{"type": "text", "text": json.dumps(output)}],
                          "isError": output["exit_code"] != 0}
            elif method == "ping":
                result = {}
            else:
                raise ValueError("Unsupported method")
            response = {"jsonrpc": "2.0", "id": request["id"], "result": result}
        except (ValueError, KeyError, OSError, subprocess.TimeoutExpired) as error:
            response = {"jsonrpc": "2.0", "id": request["id"],
                        "error": {"code": -32602, "message": str(error)}}
        print(json.dumps(response), flush=True)


if __name__ == "__main__":
    serve()
