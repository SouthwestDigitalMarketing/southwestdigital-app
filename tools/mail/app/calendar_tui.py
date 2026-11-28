"""Keyboard-first calendar UI. No event writes until the review screen's S key."""
import calendar
import curses
import datetime as dt
import textwrap
import time

import calendar_notify as notify
import calendar_source as source


def bounds(day, view, zone):
    first = day
    if view == 'Week':
        first -= dt.timedelta(days=day.weekday())
    elif view == 'Month':
        first = day.replace(day=1)
    count = 1 if view == 'Day' else 7 if view == 'Week' else calendar.monthrange(day.year, day.month)[1]
    start = dt.datetime.combine(first, dt.time.min, zone)
    return start, start + dt.timedelta(days=count)


def shift_month(day, step):
    year, month = divmod(day.year * 12 + day.month - 1 + step, 12)
    return day.replace(year=year, month=month + 1,
                       day=min(day.day, calendar.monthrange(year, month + 1)[1]))


def clip(text, width, limit):
    """Wrap text, keeping at most limit lines; mark a cut with an ellipsis."""
    wrapped = textwrap.wrap(str(text), max(4, width)) or ['None']
    if len(wrapped) > limit:
        wrapped = wrapped[:limit]
        wrapped[-1] = wrapped[-1][:max(1, width - 1)].rstrip() + '…'
    return wrapped


def span(delta):
    """A short countdown: 8m, 1h 08m, 2d 3h."""
    minutes = max(0, int(delta.total_seconds() // 60))
    if minutes < 60:
        return '%dm' % minutes
    if minutes < 1440:
        return '%dh %02dm' % divmod(minutes, 60)
    return '%dd %dh' % (minutes // 1440, minutes % 1440 // 60)


def appointment(date, time, minutes, zone):
    naive = dt.datetime.fromisoformat(date + 'T' + time)
    start = naive.replace(tzinfo=zone)
    # Reject nonexistent or ambiguous wall times rather than silently pick one.
    if start.astimezone(dt.timezone.utc).astimezone(zone).replace(tzinfo=None) != naive:
        raise ValueError('That time does not exist because of daylight saving time')
    if start.utcoffset() != start.replace(fold=1).utcoffset():
        raise ValueError('That time occurs twice; choose a time outside the clock change')
    duration = int(minutes)
    if not 1 <= duration <= 10080:
        raise ValueError('Duration must be 1 to 10080 minutes')
    return start, (start.astimezone(dt.timezone.utc) + dt.timedelta(minutes=duration)).astimezone(zone)


class CalendarUI:
    def __init__(self, screen, client_factory, zone):
        self.screen, self.factory, self.zone = screen, client_factory, zone
        self.client = None
        self.calendars, self.events = [], []
        self.day = dt.datetime.now(zone).date()
        self.view, self.selected = 'Week', 0
        self.status, self.failed = 'Connecting to Zoho…', False
        self.loaded = ''
        self.next_event = None
        self.alert, self.seen_alert, self.last_load = None, 0.0, 0.0
        self.polled = False

    def put(self, y, x, text, style=0, width=None):
        h, w = self.screen.getmaxyx()
        if 0 <= y < h and 0 <= x < w - 1:
            safe = ''.join(c if c.isprintable() else ' ' for c in str(text))
            try:
                self.screen.addnstr(y, x, safe, max(0, min(w - x - 1, width if width is not None else w)), style)
            except curses.error:
                pass

    def base(self, title, footer):
        self.screen.erase()
        h, w = self.screen.getmaxyx()
        self.put(0, 2, 'CALENDAR  /  ' + title, curses.A_BOLD | curses.color_pair(1))
        self.put(1, 2, 'Zoho · America/Chicago · Google not connected · ' +
                 self.reminder_note(), curses.A_DIM)
        self.put(h - 2, 2, footer, curses.color_pair(1))
        return h, w

    def reminder_note(self):
        """Reminders are ours, so their state belongs in our header."""
        try:
            state = notify.load_state()
            until = notify.quiet_until(state)
            if until and until > dt.datetime.now(dt.timezone.utc):
                held = len(state.get('held') or [])
                return ('QUIET until ' +
                        until.astimezone(self.zone).strftime('%I:%M %p').lstrip('0') +
                        (' · %d held' % held if held else ''))
        except Exception:
            return 'Reminders unknown'
        return 'Reminders on'

    def poll_alerts(self):
        """Pick up what the background notifier fired. The bell is the half
        of this that reaches Tom when he is viewing the session from
        another machine; the banner is for when he is looking at it."""
        try:
            state = notify.load_state()
        except Exception:
            return
        alert = state.get('last_alert') or {}
        at = float(alert.get('at') or 0)
        if at > self.seen_alert:
            self.seen_alert, self.alert = at, alert
            # The first pass inherits whatever fired before the UI opened:
            # worth showing in the banner, not worth ringing a bell about.
            if self.polled:
                try:
                    curses.beep()
                except curses.error:
                    pass
        self.polled = True

    def toggle_quiet(self):
        now = dt.datetime.now(dt.timezone.utc)
        state, settings = notify.load_state(), notify.config()
        if notify.is_quiet(state, now):
            notify.stop_quiet(state)
            summary = notify.release(state)
            self.status = 'Reminders on. ' + (summary[0] if summary else '')
        else:
            notify.start_quiet(state, settings['quiet_default_minutes'], now)
            self.status = ('Quiet until ' +
                           notify.quiet_until(state).astimezone(self.zone)
                           .strftime('%I:%M %p').lstrip('0') +
                           '. Reminders are held, not dropped.')
        notify.save_state(state)

    def refresh(self, reset=False):
        self.status = 'Reading Zoho…'
        self.draw()
        self.screen.refresh()
        events, errors = [], []
        try:
            self.client = self.client or self.factory()
            self.calendars = self.client.calendars()
            start, end = bounds(self.day, self.view, self.zone)
            for path, name in self.calendars:
                try:
                    for event in self.client.events(path, start, end):
                        event = dict(event, calendar=name, path=path)
                        events.append(event)
                except Exception as exc:
                    errors.append(name + ': ' + str(exc))
            if not self.calendars:
                errors.append('No calendars available; check Zoho CalDAV settings')
        except Exception as exc:
            errors.append(str(exc))
        self.events = sorted(events, key=lambda e: e['start'])
        self.next_event = None
        if not self.events and not errors:
            upcoming = []
            for path, name in self.calendars:
                try:
                    upcoming.extend(dict(e, calendar=name) for e in
                                    self.client.events(path, end, end + dt.timedelta(days=90)))
                except Exception as exc:
                    errors.append('Next appointment lookup failed: ' + str(exc))
            if upcoming:
                self.next_event = min(upcoming, key=lambda e: e['start'])
        if reset:
            now = dt.datetime.now(self.zone)
            self.selected = next((i for i, e in enumerate(self.events) if e['end'] > now), 0)
        else:
            self.selected = min(self.selected, max(0, len(self.events) - 1))
        self.failed = bool(errors)
        self.loaded = dt.datetime.now(self.zone).strftime('%I:%M %p')
        self.last_load = time.monotonic()
        self.status = ('Could not load completely: ' + '; '.join(errors)) if errors else 'Updated ' + self.loaded

    def draw(self):
        start, end = bounds(self.day, self.view, self.zone)
        title = self.day.strftime('%A, %B %d, %Y') if self.view == 'Day' else \
            start.strftime('%b %d, %Y') + ' – ' + (end - dt.timedelta(days=1)).strftime('%b %d, %Y')
        h, w = self.base(self.view + ' · ' + title, '')
        if h < 15 or w < 65:
            self.put(3, 2, 'Please enlarge this terminal to at least 65 columns × 15 rows.')
            self.put(h - 1, 2, 'q Quit · Resize to continue')
            self.screen.refresh()
            return
        if self.alert and time.time() - self.seen_alert < 600:
            self.put(2, 2, '⏰ ' + self.alert.get('title', '') + ' — ' +
                     self.alert.get('body', '').split('\n')[0], curses.A_REVERSE)
        self.put(3, 2, '[t] Today   [d] Day   [w] Week   [m] Month   [n] New', curses.color_pair(1))
        self.put(4, 2, '←→ Dates   ↑↓ Select   Enter Details   r Refresh   z Quiet   ? Help   q Quit',
                 curses.color_pair(1))
        if self.view == 'Week' and w >= 135 and h >= 22:
            self.draw_week(start, h, w)
            self.put(h - 2, 2, self.status, curses.color_pair(2) if self.failed else curses.A_DIM)
            self.screen.refresh()
            return
        row = 6
        if self.view == 'Month' and h >= 30:
            self.put(row, 2, ' Mo   Tu   We   Th   Fr   Sa   Su', curses.A_BOLD)
            row += 1
            for week in calendar.monthcalendar(self.day.year, self.day.month):
                for col, number in enumerate(week):
                    if not number:
                        continue
                    marker = '*' if any(e['start'].date() <= self.day.replace(day=number) <=
                        (e['end'] - dt.timedelta(microseconds=1)).date() for e in self.events) else ' '
                    self.put(row, 2 + col * 5, '%2d%s' % (number, marker),
                             curses.A_REVERSE if number == self.day.day else curses.A_NORMAL)
                row += 1
            self.put(row, 2, '* has events · agenda for the whole month below', curses.A_DIM)
            row += 2
        self.put(row, 2, 'APPOINTMENTS', curses.A_BOLD)
        row += 2
        capacity = max(1, h - row - 4)
        now = self.now()
        rows = [('event', i) for i in range(len(self.events))]
        if self.events and start <= now < end:
            rows.insert(next((n for n, e in enumerate(self.events) if e['start'] > now),
                             len(rows)), ('now', None))
        place = next((n for n, (kind, i) in enumerate(rows) if kind == 'event' and i == self.selected), 0)
        offset = max(0, place - capacity + 1)
        if not self.events:
            self.put(row, 2, 'Schedule unavailable. Press r to retry.' if self.failed else 'No appointments in this view.')
            self.put(row + 2, 2, self.next_hint() or
                     'Press m for this month, or n to add an appointment.')
        for kind, i in rows[offset:offset + capacity]:
            if kind == 'now':
                until = self.countdown(now)
                tag = ' NOW ' + self.clock(now) + ' '
                rest = ' next in ' + until + ' ' if until else ' nothing else coming up '
                accent = curses.A_BOLD | curses.color_pair(3)
                self.put(row, 2, '─' * 2, accent)
                self.put(row, 4, tag, accent | curses.A_REVERSE)
                self.put(row, 4 + len(tag), (rest).ljust(max(0, min(w - 4, 64) - 2 - len(tag)), '─'), accent)
            else:
                event = self.events[i]
                when = 'All day' if event['all_day'] else event['start'].strftime('%I:%M %p')
                label = event['start'].strftime('%a %b %d') + '  ' + when + '  ' + event['summary']
                self.put(row, 2, ('› ' if i == self.selected else '  ') + label,
                         curses.A_REVERSE if i == self.selected else 0)
            row += 1
        if self.events:
            self.put(h - 4, 2, '%d of %d appointments' % (self.selected + 1, len(self.events)), curses.A_DIM)
        self.put(h - 3, 2, self.status, curses.color_pair(2) if self.failed else curses.A_DIM)
        self.screen.refresh()

    def now(self):
        return dt.datetime.now(self.zone)

    def countdown(self, now):
        """Time until the next timed appointment in view, or '' if none."""
        later = [e['start'] for e in self.events if not e['all_day'] and e['start'] > now]
        return span(min(later) - now) if later else ''

    def clock(self, now):
        return now.strftime('%I:%M %p').lstrip('0')

    def booking(self, event):
        """How this appointment arrived, for the last line of the details.

        The source calendar's name is only worth the line when there is more
        than one calendar to tell apart.
        """
        me = getattr(self.client, 'user', '') if self.client else ''
        line = source.describe(event, me)
        if len(self.calendars) > 1:
            line += ' · ' + event['calendar']
        return line

    def next_hint(self):
        if not self.next_event or self.failed:
            return ''
        event = self.next_event
        return ('Next: ' + event['start'].strftime('%b %d at %I:%M %p') +
                ' · ' + event['summary'])

    def draw_now(self, y, x, column, now):
        """Two rows in today's column: the clock, then time to the next one."""
        until = self.countdown(now)
        mark = curses.A_BOLD | curses.color_pair(3)
        self.put(y, x, ('NOW ' + self.clock(now)).ljust(column - 1), mark | curses.A_REVERSE, column - 1)
        self.put(y + 1, x, 'in ' + until if until else 'none left', mark, column - 1)
        return y + 2

    def draw_week(self, start, h, w):
        panel = min(55, max(32, w // 4))
        column = (w - panel - 5) // 7
        edge = 2 + column * 7
        now = self.now()
        today = now.date()
        self.selected = min(self.selected, max(0, len(self.events) - 1))
        for col in range(7):
            date = start.date() + dt.timedelta(days=col)
            x = 2 + col * column
            style = curses.A_DIM if date < today else curses.A_NORMAL
            if date == today:
                style = curses.A_BOLD | curses.color_pair(1)
            header = date.strftime('%a %d') + (' TODAY' if date == today else '')
            header_style = curses.A_REVERSE | curses.A_BOLD if date == today else style
            if date == today:
                header = header.ljust(column - 1)
            self.put(6, x, header, header_style, column - 1)
            self.put(7, x, '─' * (column - 1), style, column - 1)
            for y in range(6, h - 3):
                self.put(y, x + column - 1, '│', curses.A_DIM)
            items = [(i, e) for i, e in enumerate(self.events)
                     if e['start'].date() <= date and
                     (e['end'] > dt.datetime.combine(date, dt.time.min, self.zone)
                      or e['start'].date() == date)]
            marker = date == today and bool(items)
            capacity = max(1, (h - 13 - (2 if marker else 0)) // 4)
            selected_here = next((j for j, (i, _) in enumerate(items) if i == self.selected), 0)
            offset = max(0, selected_here - capacity + 1)
            at = next((j for j, (_, e) in enumerate(items) if e['start'] > now), len(items))
            if not items:
                self.put(9, x, 'Unavailable' if self.failed else 'No events', style, column - 1)
            y = 9
            shown = items[offset:offset + capacity]
            for n, (i, event) in enumerate(shown, offset):
                if marker and n == at:
                    y = self.draw_now(y, x, column, now)
                attr = curses.A_REVERSE | curses.color_pair(2) if i == self.selected else style
                when = 'All day' if event['all_day'] else event['start'].strftime('%I:%M %p')
                if event['start'].date() != date:
                    when = '↳ continues'
                self.put(y, x, when, attr, column - 2)
                for k, line in enumerate(textwrap.wrap(event['summary'], column - 2)[:2]):
                    self.put(y + 1 + k, x, line, attr, column - 2)
                y += 4
            if marker and at == offset + len(shown):
                self.draw_now(y, x, column, now)
            if len(items) > capacity:
                self.put(h - 4, x, '%d–%d of %d' % (offset + 1, min(offset + capacity, len(items)), len(items)), style, column - 1)
        x = edge + 2
        self.put(6, x, 'APPOINTMENT DETAILS', curses.A_BOLD, panel - 3)
        if not self.events:
            message = ('Could not load. Press r to retry.' if self.failed
                       else 'Nothing scheduled this week.')
            for n, line in enumerate(textwrap.wrap(message, panel - 4)):
                self.put(9 + n, x, line, width=panel - 3)
            for n, line in enumerate(textwrap.wrap(self.next_hint(), panel - 4)):
                self.put(12 + n, x, line, width=panel - 3)
            return
        event = self.events[self.selected]
        lines = [*clip(event['summary'], panel - 4, 3), '',
                 event['start'].strftime('%A, %B %d, %Y'),
                 'All day' if event['all_day'] else event['start'].strftime('%I:%M %p %Z') + ' – ' + event['end'].strftime('%I:%M %p %Z'),
                 '', 'Location', *clip(event['location'] or 'None', panel - 4, 2),
                 '', 'Notes', *clip(event.get('description') or 'None', panel - 4, 4),
                 '', 'Source', *clip(self.booking(event), panel - 4, 2)]
        wrapped = [part for line in lines for part in (textwrap.wrap(line, panel - 4) or [''])]
        for y, line in enumerate(wrapped[:h - 13], 9):
            self.put(y, x, line, width=panel - 3)
        self.put(h - 4, x, 'Enter for full details', curses.A_DIM, panel - 3)

    def modal(self, title, lines, footer='Esc / Enter Back', accept=()):
        scroll = 0
        while True:
            h, w = self.base(title, footer)
            wrapped = []
            for line in lines:
                wrapped.extend(textwrap.wrap(str(line), max(10, w - 6)) or [''])
            size = max(1, h - 6)
            for row, line in enumerate(wrapped[scroll:scroll + size], 3):
                self.put(row, 2, line)
            self.screen.refresh()
            key = self.screen.getch()
            if key in accept:
                return key
            if key in (27, 10, 13, ord('q')):
                return None
            if key == curses.KEY_DOWN:
                scroll = min(max(0, len(wrapped) - size), scroll + 1)
            elif key == curses.KEY_UP:
                scroll = max(0, scroll - 1)

    def field(self, label, default=''):
        value = default
        while True:
            self.base('New appointment', 'Enter Next  Esc Cancel  Ctrl-U Clear  Backspace Delete')
            self.put(3, 2, label, curses.A_BOLD)
            self.put(5, 2, value + '▏', curses.A_REVERSE)
            self.put(8, 2, 'Zoho appointment only. No guests or invitations in version 1.', curses.A_DIM)
            self.screen.refresh()
            key = self.screen.get_wch()
            if key == '\x1b':
                return None
            if key in ('\n', '\r'):
                return value
            if key == '\x15':
                value = ''
            elif key in ('\x7f', '\b', curses.KEY_BACKSPACE):
                value = value[:-1]
            elif isinstance(key, str) and key.isprintable() and len(value) < 300:
                value += key

    def create(self):
        if not self.calendars or self.client is None:
            self.modal('Unavailable', ['Connect to Zoho with r before adding an appointment.'])
            return
        fields = [('Title', ''), ('Date (YYYY-MM-DD)', self.day.isoformat()),
                  ('Start time (24-hour HH:MM, Chicago time)', '09:00'),
                  ('Duration in minutes', '30'), ('Location or meeting link (optional)', '')]
        values = []
        for label, default in fields:
            value = self.field(label, default)
            if value is None:
                return
            values.append(value)
        title, date, time, duration, location = values
        try:
            if not title.strip():
                raise ValueError('Please enter an appointment title')
            start, end = appointment(date, time, duration, self.zone)
            chosen = 0
            if len(self.calendars) > 1:
                choice = self.field('Calendar: ' + '  '.join('%d %s' % (i + 1, c[1])
                                    for i, c in enumerate(self.calendars)), '1')
                if choice is None:
                    return
                chosen = int(choice) - 1
                if not 0 <= chosen < len(self.calendars):
                    raise ValueError('Choose one of the listed calendars')
            path, name = self.calendars[chosen]
            self.status = 'Checking for conflicts…'
            self.draw()
            conflicts = []
            for source, source_name in self.calendars:
                for event in self.client.events(source, start, end):
                    if event['start'] < end and event['end'] > start:
                        conflicts.append(source_name + ': ' + event['summary'])
            lines = [title, '', 'Calendar: ' + name + ' · ' + self.client.user,
                     'Starts: ' + start.strftime('%a %b %d, %Y · %I:%M %p %Z'),
                     'Ends:   ' + end.strftime('%a %b %d, %Y · %I:%M %p %Z'),
                     'Location: ' + (location or 'None'), '',
                     'Overlapping Zoho events: ' + str(len(conflicts)), *conflicts,
                     'Only connected Zoho calendars were checked.', '',
                     'S saves this appointment to Zoho. No invitations will be sent.']
            if self.modal('Review appointment', lines, 'S Save to Zoho  Esc Cancel  ↑↓ Scroll',
                          (ord('s'), ord('S'))) is None:
                return
            self.status = 'Saving to Zoho…'
            self.draw()
            self.client.create(path, title, start, end, location)
            self.day, self.view = start.date(), 'Day'
            self.refresh()
            self.status = 'Saved and verified in Zoho. ' + self.status
        except Exception as exc:
            self.modal('Appointment not confirmed', [str(exc)])

    def loop(self):
        self.screen.keypad(True)
        try:
            curses.curs_set(0)
        except curses.error:
            pass
        if curses.has_colors():
            curses.start_color()
            curses.use_default_colors()
            curses.init_pair(1, curses.COLOR_CYAN, -1)
            curses.init_pair(2, curses.COLOR_YELLOW, -1)
            # Same slot herdr uses for its accent: the terminal's own blue, so
            # the line follows the Omarchy theme.
            curses.init_pair(3, curses.COLOR_BLUE, -1)
        self.refresh(reset=True)
        while True:
            self.poll_alerts()
            self.draw()
            self.screen.timeout(1000)
            key = self.screen.getch()
            self.screen.timeout(-1)
            if key == -1:
                if time.monotonic() - self.last_load >= 300:
                    self.refresh()
                continue
            if key in (ord('q'), 3):
                return
            if key in (curses.KEY_DOWN, ord('j')):
                self.selected = min(len(self.events) - 1, self.selected + 1) if self.events else 0
            elif key in (curses.KEY_UP, ord('k')):
                self.selected = max(0, self.selected - 1)
            elif key in (10, 13, curses.KEY_ENTER) and self.events:
                e = self.events[self.selected]
                self.modal(e['summary'], [
                    'Starts: ' + e['start'].strftime('%a %b %d, %Y %I:%M %p %Z'),
                    'Ends: ' + e['end'].strftime('%a %b %d, %Y %I:%M %p %Z'),
                    'All day (end date exclusive)' if e['all_day'] else '',
                    '', 'Location: ' + (e['location'] or 'None'), '',
                    e.get('description', ''), '', 'Source: ' + self.booking(e)])
            elif key == ord('n'):
                self.create()
            elif key == ord('z'):
                self.toggle_quiet()
            elif key == ord('?'):
                self.modal('Keys', ['↑↓ / j k: select appointment', 'Enter: appointment details',
                    '←→ / [ ]: previous or next day, week, or month', 't: return to today', 'The NOW line shows the time and how long until the next appointment',
                    'd / w / m: day, week, month', 'n: new appointment; review before saving',
                    'r: refresh from Zoho', 'z: quiet reminders for an hour, or turn them back on',
                    'q: quit', '',
                    'Reminders: 1 hour before and 10 minutes before, from this calendar.',
                    'Quiet always ends by itself, and says what it held.',
                    'Version 1: Zoho viewing and single timed appointments.',
                    'Google Calendar, editing, deletion, recurring creation, and invitations are not included.'])
            elif key in (ord('r'), ord('t'), ord('d'), ord('w'), ord('m'),
                         curses.KEY_LEFT, curses.KEY_RIGHT, ord('['), ord(']')):
                if key == ord('t'):
                    self.day, self.view = dt.datetime.now(self.zone).date(), 'Day'
                elif key in (ord('d'), ord('w'), ord('m')):
                    self.view = {ord('d'): 'Day', ord('w'): 'Week', ord('m'): 'Month'}[key]
                elif key in (curses.KEY_LEFT, curses.KEY_RIGHT, ord('['), ord(']')):
                    step = -1 if key in (curses.KEY_LEFT, ord('[')) else 1
                    self.day = shift_month(self.day, step) if self.view == 'Month' else \
                        self.day + dt.timedelta(days=step * (7 if self.view == 'Week' else 1))
                self.refresh(reset=True)


def run(client_factory, zone):
    try:
        curses.wrapper(lambda screen: CalendarUI(screen, client_factory, zone).loop())
    except KeyboardInterrupt:
        pass
    return 0
