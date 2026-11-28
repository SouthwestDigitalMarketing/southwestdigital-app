import datetime as dt
import io
import pathlib
import runpy
import sys
import unittest
from unittest.mock import MagicMock, patch
from zoneinfo import ZoneInfo

sys.path.insert(0, str(pathlib.Path(__file__).parents[1] / 'app'))
import calendar_tui as ui

ZONE = ZoneInfo('America/Chicago')


class DateTests(unittest.TestCase):
    def test_month_end(self):
        self.assertEqual(ui.shift_month(dt.date(2026, 1, 31), 1), dt.date(2026, 2, 28))
        self.assertEqual(ui.shift_month(dt.date(2026, 1, 31), -1), dt.date(2025, 12, 31))

    def test_week_bounds(self):
        start, end = ui.bounds(dt.date(2026, 10, 1), 'Week', ZONE)
        self.assertEqual(start.date(), dt.date(2026, 9, 28))
        self.assertEqual(end.date(), dt.date(2026, 10, 5))

    def test_invalid_and_clock_changes(self):
        for date, time, length in [('2026-03-08', '02:30', '30'),
                                   ('2026-11-01', '01:30', '30'),
                                   ('2026-10-01', '09:00', '0')]:
            with self.assertRaises(ValueError):
                ui.appointment(date, time, length, ZONE)

    def test_elapsed_duration(self):
        start, end = ui.appointment('2026-03-08', '01:30', '120', ZONE)
        self.assertEqual(end.hour, 4)
        self.assertEqual(end.timestamp() - start.timestamp(), 7200)


class FlowTests(unittest.TestCase):
    def make(self):
        client = MagicMock(user='test@example.com')
        client.events.return_value = []
        app = ui.CalendarUI(MagicMock(), lambda: client, ZONE)
        app.client, app.calendars = client, [('/calendar/', 'Work')]
        app.field = MagicMock(side_effect=['Planning', '2026-10-02', '10:00', '30', 'Office'])
        app.draw = MagicMock()
        app.modal = MagicMock(return_value=None)
        app.refresh = MagicMock()
        return app, client

    def test_cancel_never_writes(self):
        app, client = self.make()
        app.create()
        client.create.assert_not_called()

    def test_review_saves_once(self):
        app, client = self.make()
        app.modal.return_value = ord('s')
        app.create()
        client.create.assert_called_once()
        app.refresh.assert_called_once()

    def test_conflict_failure_blocks_save(self):
        app, client = self.make()
        client.events.side_effect = RuntimeError('offline')
        app.create()
        client.create.assert_not_called()
        self.assertEqual(app.modal.call_args.args[0], 'Appointment not confirmed')

    def test_partial_read_is_labeled(self):
        app, client = self.make()
        client.calendars.return_value = app.calendars
        client.events.side_effect = RuntimeError('offline')
        ui.CalendarUI.refresh(app)
        self.assertTrue(app.failed)
        self.assertIn('offline', app.status)


try:
    import icalendar
except ImportError:
    icalendar = None


@unittest.skipUnless(icalendar, 'Calendar environment required')
class SaveTests(unittest.TestCase):
    def test_create_only_put_and_readback(self):
        mod = runpy.run_path(str(pathlib.Path(__file__).parents[1] / 'bin/calendar'))
        client = mod['Client'].__new__(mod['Client'])
        client.auth, client.opener = 'Basic test', MagicMock()
        captured = []
        def response(req, **kwargs):
            captured.append(req)
            result = MagicMock()
            result.__enter__.return_value = result
            result.status = 201
            result.read.return_value = captured[0].data
            return result
        client.opener.open.side_effect = response
        start, end = ui.appointment('2026-10-02', '10:00', '30', ZONE)
        client.create('/calendar/', 'Planning', start, end, 'Office')
        self.assertEqual([r.get_method() for r in captured], ['PUT', 'GET'])
        self.assertEqual(captured[0].get_header('If-none-match'), '*')
        event = icalendar.Calendar.from_ical(captured[0].data).walk('VEVENT')[0]
        self.assertNotIn('ATTENDEE', event)
        self.assertNotIn('ORGANIZER', event)

    def test_unknown_save_is_not_retried(self):
        mod = runpy.run_path(str(pathlib.Path(__file__).parents[1] / 'bin/calendar'))
        client = mod['Client'].__new__(mod['Client'])
        client.auth, client.opener = 'Basic test', MagicMock()
        client.opener.open.side_effect = TimeoutError('timeout')
        start, end = ui.appointment('2026-10-02', '10:00', '30', ZONE)
        with self.assertRaisesRegex(RuntimeError, 'may exist'):
            client.create('/calendar/', 'Planning', start, end)
        client.opener.open.assert_called_once()


class Screen:
    """Minimal curses stand-in that records what was painted."""

    def __init__(self, height, width):
        self.height, self.width, self.rows = height, width, {}

    def getmaxyx(self):
        return self.height, self.width

    def erase(self):
        self.rows = {}

    def addnstr(self, y, x, text, n, style=0):
        row = self.rows.setdefault(y, [' '] * self.width)
        for i, char in enumerate(text[:n]):
            if x + i < self.width:
                row[x + i] = char

    def refresh(self):
        pass

    def line(self, y):
        return ''.join(self.rows.get(y, [])).rstrip()

    def dump(self):
        return '\n'.join(self.line(y) for y in range(self.height))


def event(start, minutes=30, summary='Office Hours', name='Thomas', all_day=False):
    return {'start': start, 'end': start + dt.timedelta(minutes=minutes), 'all_day': all_day,
            'summary': summary, 'description': 'Notes here', 'location': 'Conroe',
            'calendar': name}


class DrawTests(unittest.TestCase):
    MONDAY = dt.date(2026, 9, 28)

    def paint(self, height, width, events=(), view='Week', day=dt.date(2026, 9, 30), **state):
        screen = Screen(height, width)
        app = ui.CalendarUI(screen, MagicMock(), ZONE)
        app.day, app.view, app.events = day, view, list(events)
        app.status = 'Updated 09:00 AM'
        for key, value in state.items():
            setattr(app, key, value)
        with patch.object(ui.curses, 'color_pair', lambda pair: 0):
            app.draw()
        return app, screen

    def test_week_grid_shows_seven_days_and_a_details_panel(self):
        events = [event(dt.datetime(2026, 9, 28, 15, 0, tzinfo=ZONE), summary='Max Emory'),
                  event(dt.datetime(2026, 10, 1, 9, 30, tzinfo=ZONE), summary='Ledger review')]
        app, screen = self.paint(40, 160, events)
        for label in ['Mon 28', 'Tue 29', 'Wed 30', 'Thu 01', 'Fri 02', 'Sat 03', 'Sun 04']:
            self.assertIn(label, screen.line(6))
        self.assertIn('APPOINTMENT DETAILS', screen.line(6))
        panel = [screen.line(y)[len(screen.line(6).split('APPOINTMENT')[0]):] for y in range(9, 20)]
        self.assertIn('Max Emory', '\n'.join(panel))
        self.assertIn('Conroe', screen.dump())

    def test_week_heading_names_the_date_range(self):
        app, screen = self.paint(40, 160, [])
        self.assertIn('Sep 28, 2026 – Oct 04, 2026', screen.line(0))

    def test_shortcuts_sit_under_the_heading(self):
        app, screen = self.paint(40, 160, [])
        self.assertIn('[w] Week', screen.line(3))
        self.assertIn('q Quit', screen.line(4))

    def test_narrow_terminal_keeps_the_agenda_layout(self):
        events = [event(dt.datetime(2026, 9, 28, 15, 0, tzinfo=ZONE))]
        app, screen = self.paint(30, 100, events)
        self.assertNotIn('APPOINTMENT DETAILS', screen.dump())
        self.assertIn('APPOINTMENTS', screen.dump())
        self.assertIn('Office Hours', screen.dump())

    def test_empty_week_points_at_the_next_appointment(self):
        upcoming = event(dt.datetime(2026, 10, 14, 15, 0, tzinfo=ZONE), summary='Max Emory')
        app, screen = self.paint(40, 160, [], next_event=upcoming)
        self.assertIn('Nothing scheduled this week.', screen.dump())
        self.assertIn('Next: Oct 14 at 03:00 PM', screen.dump())

    def test_failed_load_is_not_reported_as_an_empty_week(self):
        app, screen = self.paint(40, 160, [], failed=True, status='Could not load completely: offline')
        self.assertIn('Press r to retry', screen.dump())
        self.assertNotIn('Nothing scheduled', screen.dump())

    def test_continuation_days_do_not_repeat_the_start_time(self):
        spanning = event(dt.datetime(2026, 9, 28, 0, 0, tzinfo=ZONE), minutes=3 * 24 * 60,
                         summary='Conference', all_day=True)
        app, screen = self.paint(40, 160, [spanning])
        self.assertEqual(screen.dump().count('↳ continues'), 2)
        self.assertEqual(screen.dump().count('All day'), 2)  # grid column plus details panel

    def test_tiny_terminal_only_asks_for_more_room(self):
        app, screen = self.paint(10, 40, [])
        self.assertIn('enlarge this terminal', screen.dump())
        self.assertNotIn('[w] Week', screen.dump())

    def test_next_appointment_is_looked_up_for_any_view(self):
        upcoming = event(dt.datetime(2026, 10, 14, 15, 0, tzinfo=ZONE), summary='Max Emory')
        client = MagicMock(user='test@example.com')
        client.calendars.return_value = [('/calendar/', 'Thomas')]
        client.events.side_effect = lambda path, start, end: \
            [upcoming] if start.date() > dt.date(2026, 10, 4) else []
        app = ui.CalendarUI(MagicMock(), lambda: client, ZONE)
        app.day, app.view, app.draw = dt.date(2026, 9, 30), 'Week', MagicMock()
        app.refresh()
        self.assertEqual(app.next_event['summary'], 'Max Emory')
        self.assertFalse(app.failed)

    def test_long_notes_are_clipped_in_the_panel(self):
        busy = event(dt.datetime(2026, 9, 29, 10, 0, tzinfo=ZONE), summary='Zoom with Sons')
        busy['description'] = 'Join Zoom Meeting ' + 'https://example.com/a-very-long-link ' * 20
        busy['location'] = 'https://example.com/' + 'x' * 400
        app, screen = self.paint(40, 160, [busy])
        dump = screen.dump()
        self.assertEqual(dump.count('…'), 2)  # location and notes each cut once
        self.assertIn('Enter for full details', dump)
        self.assertLess(len(dump.splitlines()[20]
                            .split('│')[-1].strip()), 60)

    def test_clip_keeps_short_text_whole(self):
        self.assertEqual(ui.clip('Conroe', 30, 2), ['Conroe'])
        self.assertEqual(ui.clip('', 30, 2), ['None'])
        self.assertEqual(ui.clip('word ' * 40, 20, 3)[-1][-1], '…')

    def test_one_calendar_name_is_never_printed(self):
        """A single source calendar repeated under every row says nothing."""
        events = [event(dt.datetime(2026, 9, 28, 15, 0, tzinfo=ZONE), name='Thomas'),
                  event(dt.datetime(2026, 10, 1, 9, 30, tzinfo=ZONE), name='Thomas')]
        app, screen = self.paint(40, 160, events)
        self.assertNotIn('Thomas', screen.dump())

    def test_the_booking_line_is_last_in_the_details(self):
        events = [dict(event(dt.datetime(2026, 9, 28, 15, 0, tzinfo=ZONE)),
                       location='https://app.cal.com/video/abc', uid='x@zoho.com',
                       organizer='MAILTO:thomas@bookkeepingconroe.com')]
        app, screen = self.paint(40, 160, events)
        lines = screen.dump().splitlines()
        booked = [y for y, line in enumerate(lines) if 'Cal.com booking page' in line]
        notes = [y for y, line in enumerate(lines) if line.rstrip().endswith('Notes')]
        self.assertTrue(booked and notes)
        self.assertGreater(booked[0], notes[0])

    def test_several_calendars_put_the_name_back(self):
        events = [event(dt.datetime(2026, 9, 28, 15, 0, tzinfo=ZONE), name='Thomas')]
        app, screen = self.paint(40, 160, events,
                                 calendars=[('/a/', 'Thomas'), ('/b/', 'Personal')])
        self.assertIn('Thomas', screen.dump())

    def test_the_agenda_keeps_one_line_per_appointment(self):
        events = [event(dt.datetime(2026, 9, 28, 15, 0, tzinfo=ZONE), summary='First'),
                  event(dt.datetime(2026, 9, 29, 16, 0, tzinfo=ZONE), summary='Second')]
        app, screen = self.paint(30, 100, events)
        lines = [y for y, line in enumerate(screen.dump().splitlines())
                 if 'First' in line or 'Second' in line]
        self.assertEqual(lines[1] - lines[0], 1)


class NowLineTests(unittest.TestCase):
    paint = DrawTests.paint
    NOW = dt.datetime(2026, 9, 30, 14, 52, tzinfo=ZONE)

    def events(self):
        return [event(dt.datetime(2026, 9, 30, 9, 0, tzinfo=ZONE), summary='Morning Call'),
                event(dt.datetime(2026, 9, 30, 16, 0, tzinfo=ZONE), summary='Max Emory')]

    def paint_now(self, height, width, **kw):
        return self.paint(height, width, self.events(), now=lambda: self.NOW, **kw)

    def test_span_reads_naturally(self):
        for minutes, text in [(0, '0m'), (8, '8m'), (68, '1h 08m'), (1500, '1d 1h')]:
            self.assertEqual(ui.span(dt.timedelta(minutes=minutes)), text)

    def test_agenda_puts_the_line_between_past_and_upcoming(self):
        app, screen = self.paint_now(30, 100, view='Day')
        rows = screen.dump().split('\n')
        at = next(n for n, r in enumerate(rows) if 'NOW 2:52 PM' in r)
        self.assertIn('Morning Call', rows[at - 1])
        self.assertIn('Max Emory', rows[at + 1])
        self.assertIn('next in 1h 08m', rows[at])

    def test_agenda_line_goes_last_when_nothing_is_left(self):
        late = dt.datetime(2026, 9, 30, 17, 30, tzinfo=ZONE)
        app, screen = self.paint(30, 100, self.events(), view='Day', now=lambda: late)
        rows = screen.dump().split('\n')
        at = next(n for n, r in enumerate(rows) if 'NOW 5:30 PM' in r)
        self.assertIn('Max Emory', rows[at - 1])
        self.assertIn('nothing else coming up', rows[at])

    def test_no_line_when_today_is_not_in_view(self):
        app, screen = self.paint(30, 100, self.events(), view='Day', day=dt.date(2026, 10, 7),
                                 now=lambda: self.NOW)
        self.assertNotIn('NOW', screen.dump())

    def test_the_line_does_not_become_the_selection(self):
        app, screen = self.paint_now(30, 100, view='Day', selected=1)
        self.assertEqual(app.selected, 1)
        self.assertIn('Max Emory', screen.dump())

    def test_all_day_events_do_not_count_as_the_next_meeting(self):
        tomorrow = event(dt.datetime(2026, 10, 1, 0, 0, tzinfo=ZONE), 1440, 'Holiday', all_day=True)
        app = ui.CalendarUI(Screen(30, 100), MagicMock(), ZONE)
        app.events = [tomorrow]
        self.assertEqual(app.countdown(self.NOW), '')

    def test_week_grid_marks_today_only(self):
        app, screen = self.paint_now(40, 160)
        self.assertEqual(screen.dump().count('NOW 2:52 PM'), 1)
        self.assertIn('in 1h 08m', screen.dump())
        rows = screen.dump().split('\n')
        at = next(n for n, r in enumerate(rows) if 'NOW 2:52 PM' in r)
        self.assertGreater(at, 9)  # below the morning call, not at the top
        self.assertIn('in 1h 08m', rows[at + 1])
        self.assertIn('Max Emory', rows[at + 3])
