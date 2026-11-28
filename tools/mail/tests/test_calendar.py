import datetime as dt
import pathlib
import runpy
import unittest
from unittest.mock import MagicMock, patch

try:
    import recurring_ical_events
except ImportError:
    recurring_ical_events = None


class CLISurfaceTests(unittest.TestCase):
    def test_add_command_is_available_and_confirmed(self):
        source = (pathlib.Path(__file__).parents[1] / 'bin' / 'calendar').read_text()
        self.assertIn("'add'", source)
        self.assertIn('def add_event():', source)
        self.assertIn('Create this event? [y/N]', source)
        self.assertIn('client.create(path, title, start, end, location)', source)


@unittest.skipUnless(recurring_ical_events, 'Use the calendar venv to test recurrence support')
class CalendarTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mod = runpy.run_path(str(pathlib.Path(__file__).parents[1] / 'bin/calendar'))

    def parse(self, body, first='2026-10-01', last='2026-10-08'):
        zone = self.mod['ZONE']
        start = dt.datetime.fromisoformat(first).replace(tzinfo=zone)
        end = dt.datetime.fromisoformat(last).replace(tzinfo=zone)
        text = 'BEGIN:VCALENDAR\nVERSION:2.0\n' + body + '\nEND:VCALENDAR'
        return self.mod['parse_events'](text, start, end)

    def test_biweekly_recurs_from_old_start(self):
        rows = self.parse('BEGIN:VEVENT\nUID:1\nSUMMARY:Office hours\n'
            'DTSTART;TZID=America/Chicago:20260527T150000\n'
            'DTEND;TZID=America/Chicago:20260527T153000\n'
            'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=WE\nEND:VEVENT', '2026-10-08', '2026-10-15')
        self.assertEqual([(r['start'].day, r['start'].hour) for r in rows], [(14, 15)])

    def test_excluded_occurrence(self):
        rows = self.parse('BEGIN:VEVENT\nUID:1\nDTSTART:20261001T150000Z\n'
            'DTEND:20261001T160000Z\nRRULE:FREQ=DAILY;COUNT=3\n'
            'EXDATE:20261002T150000Z\nEND:VEVENT')
        self.assertEqual([r['start'].day for r in rows], [1, 3])

    def test_all_day_and_cancelled(self):
        rows = self.parse('BEGIN:VEVENT\nUID:1\nDTSTART;VALUE=DATE:20261002\n'
            'DTEND;VALUE=DATE:20261004\nSUMMARY:Time off\nEND:VEVENT\n'
            'BEGIN:VEVENT\nUID:2\nDTSTART:20261002T150000Z\nSTATUS:CANCELLED\nEND:VEVENT')
        self.assertEqual(len(rows), 1)
        self.assertTrue(rows[0]['all_day'])
        self.assertEqual(rows[0]['end'].day, 4)

    def test_dst_preserves_local_hour(self):
        rows = self.parse('BEGIN:VEVENT\nUID:1\nDTSTART;TZID=America/Chicago:20261030T150000\n'
            'DTEND;TZID=America/Chicago:20261030T153000\n'
            'RRULE:FREQ=DAILY;COUNT=4\nEND:VEVENT', '2026-10-30', '2026-11-04')
        self.assertEqual([r['start'].hour for r in rows], [15] * 4)
        self.assertNotEqual(rows[0]['start'].utcoffset(), rows[-1]['start'].utcoffset())

    def test_moved_occurrence_replaces_original(self):
        rows = self.parse('BEGIN:VEVENT\nUID:1\nDTSTART:20261001T150000Z\n'
            'DTEND:20261001T160000Z\nRRULE:FREQ=DAILY;COUNT=2\nEND:VEVENT\n'
            'BEGIN:VEVENT\nUID:1\nRECURRENCE-ID:20261002T150000Z\n'
            'DTSTART:20261002T170000Z\nDTEND:20261002T180000Z\nEND:VEVENT')
        self.assertEqual([(r['start'].day, r['start'].hour) for r in rows], [(1, 10), (2, 12)])

    def test_control_characters_removed(self):
        self.assertNotIn('\x1b', self.mod['clean']('meeting\x1b[2J\nhello'))

    def test_cli_appointment_rejects_bad_duration(self):
        with self.assertRaises(ValueError):
            self.mod['appointment']('2026-10-02', '10:00', '0')

    def test_cli_add_cancel_never_writes(self):
        client = MagicMock(user='test@example.com')
        client.calendars.return_value = [('/calendar/', 'Work')]
        client.events.return_value = []
        globals_dict = self.mod['add_event'].__globals__
        original = globals_dict['Client']
        globals_dict['Client'] = lambda: client
        try:
            with patch('builtins.input', side_effect=[
                    'Planning', '2026-10-02', '10:00', '30', '', 'n']):
                self.assertEqual(self.mod['add_event'](), 0)
        finally:
            globals_dict['Client'] = original
        client.create.assert_not_called()

    def test_cli_add_confirm_writes_after_conflict_check(self):
        client = MagicMock(user='test@example.com')
        client.calendars.return_value = [('/calendar/', 'Work')]
        client.events.return_value = []
        client.create.return_value = 'new@mailroom'
        globals_dict = self.mod['add_event'].__globals__
        original = globals_dict['Client']
        globals_dict['Client'] = lambda: client
        try:
            with patch('builtins.input', side_effect=[
                    'Planning', '2026-10-02', '10:00', '30', '', 'y']):
                self.assertEqual(self.mod['add_event'](), 0)
        finally:
            globals_dict['Client'] = original
        client.create.assert_called_once()
