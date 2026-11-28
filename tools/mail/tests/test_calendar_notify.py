"""Reminders are ours, so the rules are tested here rather than trusted to
a calendar server. Nothing in this file touches the network, the desktop,
or the real state file."""
import datetime as dt
import os
import pathlib
import tempfile
import sys
import unittest
from unittest.mock import patch
from zoneinfo import ZoneInfo

sys.path.insert(0, str(pathlib.Path(__file__).parents[1] / 'app'))
import calendar_notify as notify

ZONE = ZoneInfo('America/Chicago')
SETTINGS = dict(notify.DEFAULTS)


def event(start, minutes=30, summary='Max Emory', all_day=False, name='Thomas'):
    return {'start': start, 'end': start + dt.timedelta(minutes=minutes),
            'all_day': all_day, 'summary': summary, 'location': '',
            'description': '', 'calendar': name}


class ScheduleTests(unittest.TestCase):
    START = dt.datetime(2026, 10, 2, 15, 0, tzinfo=ZONE)

    def test_two_reminders_an_hour_and_ten_minutes_ahead(self):
        times = notify.reminders_for(event(self.START), SETTINGS, ZONE)
        self.assertEqual([label for label, _ in times], [60, 10])
        self.assertEqual([when.astimezone(ZONE).strftime('%H:%M') for _, when in times],
                         ['14:00', '14:50'])

    def test_an_all_day_event_is_announced_in_the_morning(self):
        day = dt.datetime(2026, 10, 2, 0, 0, tzinfo=ZONE)
        times = notify.reminders_for(event(day, 1440, all_day=True), SETTINGS, ZONE)
        self.assertEqual(len(times), 1)
        self.assertEqual(times[0][0], 'today')
        self.assertEqual(times[0][1].astimezone(ZONE).strftime('%H:%M'), '08:00')

    def test_a_reminder_fires_once(self):
        now = self.START - dt.timedelta(minutes=10)
        ready = notify.due([event(self.START)], now, SETTINGS, {}, ZONE)
        self.assertEqual([label for _, _, label in ready], [10])
        fired = {key: now.timestamp() for key, _, _ in ready}
        self.assertEqual(notify.due([event(self.START)], now, SETTINGS, fired, ZONE), [])

    def test_a_short_outage_is_caught_up(self):
        now = self.START - dt.timedelta(minutes=7)  # the 10-minute mark, 3 late
        ready = notify.due([event(self.START)], now, SETTINGS, {}, ZONE)
        self.assertEqual([label for _, _, label in ready], [10])

    def test_an_event_already_close_skips_the_stale_hour_reminder(self):
        now = self.START - dt.timedelta(minutes=20)
        ready = notify.due([event(self.START)], now, SETTINGS, {}, ZONE)
        self.assertEqual(ready, [])
        later = notify.due([event(self.START)], self.START - dt.timedelta(minutes=10),
                           SETTINGS, {}, ZONE)
        self.assertEqual([label for _, _, label in later], [10])

    def test_nothing_fires_once_the_event_has_started(self):
        self.assertEqual(
            notify.due([event(self.START)], self.START, SETTINGS, {}, ZONE), [])

    def test_two_occurrences_of_one_series_are_separate(self):
        first = notify.reminder_key(event(self.START), 10)
        second = notify.reminder_key(event(self.START + dt.timedelta(days=14)), 10)
        self.assertNotEqual(first, second)


class WordingTests(unittest.TestCase):
    def test_an_hour_reads_as_an_hour(self):
        title, body = notify.describe(
            event(dt.datetime(2026, 10, 2, 15, 0, tzinfo=ZONE)), 60, ZONE)
        self.assertEqual(title, 'Max Emory')
        self.assertIn('Starts in 1 hour', body)
        self.assertIn('3:00 PM', body)

    def test_ten_minutes_reads_as_minutes(self):
        _, body = notify.describe(
            event(dt.datetime(2026, 10, 2, 15, 0, tzinfo=ZONE)), 10, ZONE)
        self.assertIn('Starts in 10 minutes', body)

    def test_an_all_day_event_says_all_day(self):
        _, body = notify.describe(
            event(dt.datetime(2026, 10, 2, 0, 0, tzinfo=ZONE), all_day=True),
            'today', ZONE)
        self.assertIn('All day today', body)


class QuietTests(unittest.TestCase):
    NOW = dt.datetime(2026, 10, 2, 9, 0, tzinfo=dt.timezone.utc)

    def state(self):
        return {'quiet_until': None, 'fired': {}, 'held': [], 'snoozed': [],
                'last_alert': None}

    def test_quiet_ends_by_itself(self):
        state = notify.start_quiet(self.state(), 60, self.NOW)
        self.assertTrue(notify.is_quiet(state, self.NOW + dt.timedelta(minutes=59)))
        self.assertFalse(notify.is_quiet(state, self.NOW + dt.timedelta(minutes=61)))

    def test_a_held_reminder_is_not_dropped(self):
        state = notify.start_quiet(self.state(), 60, self.NOW)
        with patch.object(notify, 'popup') as popup:
            fired = notify.announce(state, 'Max Emory', 'Starts in 10 minutes', self.NOW)
        self.assertFalse(fired)
        popup.assert_not_called()
        self.assertEqual(len(state['held']), 1)
        title, body = notify.release(state)
        self.assertIn('Max Emory', body)
        self.assertEqual(state['held'], [])

    def test_several_held_reminders_are_counted(self):
        state = notify.start_quiet(self.state(), 60, self.NOW)
        with patch.object(notify, 'popup'):
            notify.announce(state, 'One', 'Starts in 1 hour', self.NOW)
            notify.announce(state, 'Two', 'Starts in 10 minutes', self.NOW)
        title, body = notify.release(state)
        self.assertEqual(title, '2 reminders held while quiet')
        self.assertIn('One', body)
        self.assertIn('Two', body)

    def test_release_with_nothing_held_says_nothing(self):
        self.assertIsNone(notify.release(self.state()))

    def test_a_reminder_outside_quiet_reaches_the_desktop(self):
        state = self.state()
        with patch.object(notify, 'popup') as popup:
            fired = notify.announce(state, 'Max Emory', 'Starts in 10 minutes', self.NOW)
        self.assertTrue(fired)
        popup.assert_called_once()
        self.assertEqual(state['last_alert']['title'], 'Max Emory')


class SnoozeTests(unittest.TestCase):
    NOW = dt.datetime(2026, 10, 2, 9, 0, tzinfo=dt.timezone.utc)

    def test_snooze_refires_later(self):
        state = {'quiet_until': None, 'fired': {}, 'held': [], 'snoozed': [],
                 'last_alert': {'title': 'Max Emory', 'body': 'Starts in 10 minutes',
                                'at': self.NOW.timestamp()}}
        self.assertEqual(notify.snooze(state, 5, self.NOW), 'Max Emory')
        self.assertEqual(notify.ripe_snoozes(state, self.NOW + dt.timedelta(minutes=4)), [])
        ripe = notify.ripe_snoozes(state, self.NOW + dt.timedelta(minutes=6))
        self.assertEqual([i['title'] for i in ripe], ['Max Emory'])
        self.assertEqual(state['snoozed'], [])

    def test_nothing_to_snooze_is_not_an_error(self):
        state = {'quiet_until': None, 'fired': {}, 'held': [], 'snoozed': [],
                 'last_alert': None}
        self.assertIsNone(notify.snooze(state, 5, self.NOW))


class ConfigTests(unittest.TestCase):
    def test_the_defaults_are_tom_s_choice(self):
        self.assertEqual(notify.DEFAULTS['lead_minutes'], [60, 10])
        self.assertEqual(notify.DEFAULTS['all_day_hour'], 8)
        self.assertEqual(notify.DEFAULTS['quiet_default_minutes'], 60)

    def written(self, text):
        """A config file of our own, never the one on this machine."""
        handle = tempfile.NamedTemporaryFile('w', suffix='.json', delete=False)
        handle.write(text)
        handle.close()
        self.addCleanup(os.unlink, handle.name)
        return patch.object(notify, 'CONFIG_PATH', pathlib.Path(handle.name))

    def test_a_broken_config_file_falls_back(self):
        with self.written('{{not json'):
            self.assertEqual(notify.config()['lead_minutes'], [60, 10])

    def test_an_empty_lead_list_is_refused(self):
        with self.written('{"lead_minutes": []}'):
            self.assertEqual(notify.config()['lead_minutes'], [60, 10])

    def test_a_real_setting_is_honoured(self):
        with self.written('{"lead_minutes": [30], "all_day_hour": 7}'):
            settings = notify.config()
        self.assertEqual(settings['lead_minutes'], [30])
        self.assertEqual(settings['all_day_hour'], 7)
