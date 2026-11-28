"""How an appointment arrived. The shapes here are the ones Tom's own
calendar actually returns: Zoho rewrites PRODID on every event, so the
answer has to come from the link, the organizer, and the UID."""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).parents[1] / 'app'))
import calendar_source as source

ME = 'thomas@bookkeepingconroe.com'


def event(**fields):
    base = {'summary': 'Something', 'location': '', 'description': '',
            'url': '', 'uid': '', 'organizer': ''}
    base.update(fields)
    return base


class SourceTests(unittest.TestCase):
    def test_a_booking_page_is_named_first(self):
        """The funnel question: this one exists because someone picked a slot."""
        got = source.describe(event(
            location='https://app.cal.com/video/8zvJddPpDVZnKP6zeK328H',
            uid='bc372ecf29fd4a1dbe108a5557c0c92c@zoho.com',
            organizer='MAILTO:thomas@bookkeepingconroe.com'), ME)
        self.assertEqual(got, 'Cal.com booking page')

    def test_an_outside_invitation_names_the_sender(self):
        got = source.describe(event(
            location='https://us02web.zoom.us/j/84936366276?pwd=abc',
            uid='040000008200E00074C5B7101A82E00800000000',
            organizer='MAILTO:rick@shankshauser.com'), ME)
        self.assertEqual(got, 'Invite from rick@shankshauser.com (Outlook) · Zoom')

    def test_your_own_zoho_event_says_where_it_was_made(self):
        got = source.describe(event(
            location='https://meet.google.com/sqq-jfjh-iqx',
            url='https://meet.google.com/sqq-jfjh-iqx',
            uid='108bb062ed214d0a8658e3ad4203a4bd@zoho.com',
            organizer='MAILTO:thomas@bookkeepingconroe.com'), ME)
        self.assertEqual(got, 'Created in Zoho · Google Meet')

    def test_an_event_we_created_says_so(self):
        got = source.describe(event(uid='9f1c-uuid@mailroom',
                                    organizer='MAILTO:thomas@bookkeepingconroe.com'), ME)
        self.assertEqual(got, 'Created here')

    def test_calendly_counts_as_a_booking_page(self):
        got = source.describe(event(location='https://calendly.com/events/abc',
                                    uid='abc@calendly.com'), ME)
        self.assertEqual(got, 'Calendly booking page')

    def test_a_bare_event_does_not_invent_a_source(self):
        self.assertEqual(source.describe(event(), ME), 'Created by you')

    def test_a_link_in_the_notes_still_counts(self):
        got = source.describe(event(
            description='Join Zoom Meeting https://us02web.zoom.us/j/123',
            uid='x@zoho.com'), ME)
        self.assertEqual(got, 'Created in Zoho · Zoom')

    def test_an_address_is_read_out_of_any_shape(self):
        for raw in ['MAILTO:rick@shankshauser.com', 'mailto:Rick@ShanksHauser.com',
                    '"Rick" <rick@shankshauser.com>', 'rick@shankshauser.com']:
            self.assertEqual(source.address(raw), 'rick@shankshauser.com')

    def test_teams_and_meet_are_told_apart(self):
        self.assertEqual(source.platform(event(
            location='https://teams.microsoft.com/l/meetup-join/x')), 'Teams')
        self.assertEqual(source.platform(event(
            location='https://meet.google.com/abc')), 'Google Meet')

    def test_the_fields_it_needs_are_kept_by_the_reader(self):
        body = (pathlib.Path(__file__).parents[1] / 'bin' / 'calendar').read_text()
        body = body.split('def parse_events(')[1].split('\ndef ')[0]
        for field in ("'uid'", "'organizer'", "'url'"):
            self.assertIn(field, body)
