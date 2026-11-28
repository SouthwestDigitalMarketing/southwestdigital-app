"""Reminders for the unified calendar.

The reminder belongs to our calendar, not to whichever server happens to
host the event: the same rules run for Zoho today and for anything added
later. Nothing here talks to a calendar server. It decides what is due,
what is held back, and what to say; `bin/calendar-notify` supplies the
events and the clock, and `bin/calendar quiet` writes the same state file.
"""
import datetime as dt
import json
import os
import pathlib
import subprocess
import tempfile

CONFIG_PATH = pathlib.Path(os.path.expanduser('~/.config/mailroom/calendar-notify.json'))
STATE_PATH = pathlib.Path(os.path.expanduser('~/.local/state/mailroom/calendar-notify.json'))

DEFAULTS = {
    # Two reminders, Tom's choice on 2026-10-02: time to finish something,
    # then time to walk to the desk.
    'lead_minutes': [60, 10],
    # "An hour before" an all-day event is 11 PM the night before, which is
    # no use to anybody. All-day events get one reminder in the morning.
    'all_day_hour': 8,
    'quiet_default_minutes': 60,
}

# A reminder whose moment passed longer ago than this is not fired. It is
# the difference between catching up after a short outage and shouting
# about an event that was already nearly underway when we first saw it.
CATCHUP = dt.timedelta(minutes=5)


def config():
    merged = dict(DEFAULTS)
    try:
        stored = json.loads(CONFIG_PATH.read_text())
        if isinstance(stored, dict):
            merged.update({k: v for k, v in stored.items() if k in DEFAULTS})
    except Exception:
        pass
    if not isinstance(merged['lead_minutes'], list) or not merged['lead_minutes']:
        merged['lead_minutes'] = list(DEFAULTS['lead_minutes'])
    return merged


def load_state():
    try:
        state = json.loads(STATE_PATH.read_text())
    except Exception:
        state = {}
    if not isinstance(state, dict):
        state = {}
    state.setdefault('quiet_until', None)
    state.setdefault('fired', {})
    state.setdefault('held', [])
    state.setdefault('snoozed', [])
    state.setdefault('last_alert', None)
    return state


def save_state(state):
    """Write whole, or not at all: the CLI and the daemon share this file."""
    try:
        STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        handle, temporary = tempfile.mkstemp(dir=str(STATE_PATH.parent))
        with os.fdopen(handle, 'w') as fh:
            json.dump(state, fh)
        os.replace(temporary, str(STATE_PATH))
    except Exception:
        pass


def reminders_for(event, settings, zone):
    """[(label, when)] for one event. The label is also what we say."""
    if event['all_day']:
        morning = dt.datetime.combine(
            event['start'].date(), dt.time(int(settings['all_day_hour'])), zone)
        return [('today', morning)]
    return [(int(m), event['start'] - dt.timedelta(minutes=int(m)))
            for m in sorted(settings['lead_minutes'], reverse=True)]


def reminder_key(event, label):
    """Stable across refreshes. CalDAV UIDs do not survive our event dicts,
    and a recurring event repeats its summary, so the start time is what
    tells two occurrences apart."""
    return '%s|%s|%s' % (event['start'].isoformat(), event['summary'], label)


def due(events, now, settings, fired, zone):
    """[(key, event, label)] for reminders that should fire at `now`."""
    ready = []
    for event in events:
        end = event['end'] if event['all_day'] else event['start']
        for label, when in reminders_for(event, settings, zone):
            if not when <= now < end or now - when > CATCHUP:
                continue
            key = reminder_key(event, label)
            if key not in fired:
                ready.append((key, event, label))
    return ready


def lead_words(label):
    if label == 'today':
        return 'today'
    minutes = int(label)
    if minutes and minutes % 60 == 0:
        hours = minutes // 60
        return '1 hour' if hours == 1 else '%d hours' % hours
    return '%d minutes' % minutes


def describe(event, label, zone):
    """(title, body) for one reminder, in the words Tom reads on screen."""
    if label == 'today':
        return (event['summary'], 'All day today · ' + event.get('calendar', ''))
    clock = event['start'].astimezone(zone).strftime('%I:%M %p').lstrip('0')
    where = event.get('location') or ''
    body = 'Starts in %s · %s · %s' % (lead_words(label), clock,
                                       event.get('calendar', ''))
    if where:
        body += '\n' + where[:120]
    return (event['summary'], body)


def quiet_until(state):
    value = state.get('quiet_until')
    try:
        return dt.datetime.fromtimestamp(float(value), dt.timezone.utc) if value else None
    except Exception:
        return None


def is_quiet(state, now):
    until = quiet_until(state)
    return bool(until and now < until)


def start_quiet(state, minutes, now):
    state['quiet_until'] = (now + dt.timedelta(minutes=int(minutes))).timestamp()
    return state


def stop_quiet(state):
    state['quiet_until'] = None
    return state


def hold(state, title, body):
    """Quiet holds a reminder; it never drops it silently."""
    state['held'].append({'title': title, 'body': body})
    return state


def release(state):
    """What was held while quiet, as one (title, body), or None."""
    held = state.get('held') or []
    state['held'] = []
    if not held:
        return None
    if len(held) == 1:
        return ('Held while quiet', held[0]['title'] + ' — ' + held[0]['body'].split('\n')[0])
    lines = [item['title'] + ' — ' + item['body'].split('\n')[0] for item in held]
    return ('%d reminders held while quiet' % len(held), '\n'.join(lines))


def snooze(state, minutes, now):
    """Push the reminder that just fired. Nothing to push is not an error."""
    alert = state.get('last_alert')
    if not alert:
        return None
    state['snoozed'].append({'title': alert['title'], 'body': alert['body'],
                             'at': (now + dt.timedelta(minutes=int(minutes))).timestamp()})
    return alert['title']


def ripe_snoozes(state, now):
    ripe, waiting = [], []
    for item in state.get('snoozed') or []:
        try:
            when = dt.datetime.fromtimestamp(float(item['at']), dt.timezone.utc)
        except Exception:
            continue
        (ripe if when <= now else waiting).append(item)
    state['snoozed'] = waiting
    return ripe


def popup(title, body):
    """Desktop notification. Returns whether the desktop took it."""
    try:
        done = subprocess.run(
            ['notify-send', '--app-name=Calendar', '--urgency=normal', title, body],
            capture_output=True, timeout=10)
        return done.returncode == 0
    except Exception:
        return False


def announce(state, title, body, now, send=True):
    """Fire or hold, and leave a record the calendar UI can read.

    `send=False` records the decision without calling the desktop, so a
    caller can write the state file first and pop up afterwards: notify-send
    can block for seconds, and nothing should hold a stale state file open
    across that while Tom may be typing `calendar quiet`.
    """
    if is_quiet(state, now):
        hold(state, title, body)
        return False
    state['last_alert'] = {'title': title, 'body': body, 'at': now.timestamp()}
    if send:
        popup(title, body)
    return True
