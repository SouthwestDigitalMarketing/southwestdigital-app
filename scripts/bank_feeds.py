#!/usr/bin/env python3
"""Bank feed health per client, as read from each client's QuickBooks Banking page.

QuickBooks' API does not expose bank-feed connection status, so an agent with a signed-in browser
(Sol, /qb-bank-transactions) reads Accounting > Bank transactions and records each connected
account here. The Reports card shows it, and a disconnected or failing feed makes the client's
status 'waiting' (Tom, 2026-11-18: a disconnected feed puts the ball in the client's court).

Record one account (replaces that account's last entry for the client):
  bank_feeds.py set <client-folder> "<account name>" <last-updated YYYY-MM-DD> <ok|stale|disconnected|error> [--pending N] [--note "..."]
Show what is recorded:
  bank_feeds.py show [<client-folder>]
File: ~/.local/share/swapp-phone-intake/bank-feeds.json
  {"clients": {"<folder>": {"checked": "2026-11-18", "accounts": [{"name", "lastUpdated", "state", "pending", "note"}]}}}
"""

import argparse
import datetime as dt
import json
import os

FILE = os.path.expanduser(os.environ.get("REPORT_BANK_FEEDS_FILE", "~/.local/share/swapp-phone-intake/bank-feeds.json"))
STATES = ("ok", "stale", "disconnected", "error")
BLOCKING = ("disconnected", "error")


def load():
    try:
        with open(FILE, encoding="utf-8") as handle:
            return json.load(handle) or {}
    except (OSError, ValueError):
        return {}


def for_client(folder):
    """{'checked', 'accounts': [...]} for one client, or {}."""
    return ((load().get("clients") or {}).get(folder)) or {}


def blocking(feed):
    """Accounts whose feed stops the close: disconnected or erroring."""
    return [a for a in feed.get("accounts") or [] if a.get("state") in BLOCKING]


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    put = sub.add_parser("set")
    put.add_argument("folder")
    put.add_argument("account")
    put.add_argument("last_updated")
    put.add_argument("state", choices=STATES)
    put.add_argument("--pending", type=int)
    put.add_argument("--note", default="")
    show = sub.add_parser("show")
    show.add_argument("folder", nargs="?")
    args = parser.parse_args()
    data = load()
    clients = data.setdefault("clients", {})
    if args.command == "show":
        print(json.dumps(clients.get(args.folder) if args.folder else clients, indent=2))
        return
    dt.date.fromisoformat(args.last_updated)  # refuse anything that is not a date
    client = clients.setdefault(args.folder, {"accounts": []})
    client["accounts"] = [a for a in client.get("accounts") or [] if a.get("name") != args.account]
    client["accounts"].append({"name": args.account, "lastUpdated": args.last_updated, "state": args.state,
                               "pending": args.pending, "note": args.note})
    client["checked"] = dt.date.today().isoformat()
    os.makedirs(os.path.dirname(FILE), exist_ok=True)
    tmp = FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2)
    os.replace(tmp, FILE)
    print("recorded %s / %s: %s, last updated %s" % (args.folder, args.account, args.state, args.last_updated))


if __name__ == "__main__":
    main()
