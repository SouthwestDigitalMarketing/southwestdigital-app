"""How an appointment got onto the calendar.

Zoho rewrites PRODID on everything it stores, so the field that is meant to
say which application created an event always says Zoho. What survives is
the meeting link, the organizer, and the shape of the UID, and between them
they answer the question Tom actually asks: did this come from the booking
page, from a stranger's invite, or from us?
"""

# Checked against the link, longest host first so a more specific host wins.
PLATFORMS = [
    ('app.cal.com', 'Cal.com'),
    ('cal.com', 'Cal.com'),
    ('calendly.com', 'Calendly'),
    ('meet.google.com', 'Google Meet'),
    ('teams.microsoft.com', 'Teams'),
    ('teams.live.com', 'Teams'),
    ('zoom.us', 'Zoom'),
    ('whereby.com', 'Whereby'),
    ('webex.com', 'Webex'),
    ('meet.jit.si', 'Jitsi'),
]

# A booking tool that writes straight into the calendar is the funnel: the
# event exists because someone picked a slot on a page we published.
SELF_SERVICE = ('Cal.com', 'Calendly')

SYSTEMS = [
    ('@mailroom', 'this calendar'),
    ('@google.com', 'Google Calendar'),
    ('@calendly.com', 'Calendly'),
    ('@zoho.com', 'Zoho'),
]

# Exchange and Outlook stamp a Global Object Id rather than an address-shaped
# UID. It is the one reliable sign that an invitation came out of Outlook.
OUTLOOK_UID = '040000008200e000'


def address(value):
    """The bare address from an ORGANIZER or ATTENDEE value."""
    text = str(value or '').strip()
    if text.upper().startswith('MAILTO:'):
        text = text[7:]
    if '<' in text and '>' in text:
        text = text.split('<', 1)[1].split('>', 1)[0]
    return text.strip().strip('"').lower()


def platform(event):
    """The video or meeting service, from the link on the event."""
    link = ' '.join([str(event.get('url') or ''), str(event.get('location') or ''),
                     str(event.get('description') or '')]).lower()
    for host, name in PLATFORMS:
        if host in link:
            return name
    return ''


def system(event):
    uid = str(event.get('uid') or '').lower()
    if uid.startswith(OUTLOOK_UID):
        return 'Outlook'
    for marker, name in SYSTEMS:
        if uid.endswith(marker):
            return name
    return ''


def describe(event, me=''):
    """One line: how this appointment was booked.

    The booking page comes first because that is the lead funnel. An
    invitation from outside comes next, named by who sent it, because that
    is a relationship rather than a funnel. Anything else was made here.
    """
    service = platform(event)
    organizer = address(event.get('organizer'))
    mine = not organizer or organizer == address(me)
    origin = system(event)

    if service in SELF_SERVICE:
        head = service + ' booking page'
    elif not mine:
        head = 'Invite from ' + organizer
        if origin == 'Outlook':
            head += ' (Outlook)'
    elif origin == 'this calendar':
        head = 'Created here'
    elif origin:
        head = 'Created in ' + origin
    else:
        head = 'Created by you'

    if service and service not in SELF_SERVICE:
        head += ' · ' + service
    return head
