# Dashboard analytics configuration

The dashboard may have a Google Analytics property ID saved for a brand while
the current server environment has no Google service-account credentials.
Treat that as an unavailable integration, not as a page error.

When the dashboard loads, call GA4 only when both the property's ID and server
credentials are present. If either is missing, show the Website section as not
configured and skip the GA4 requests. If the requests fail, show the section as
unavailable and log a warning; do not use `console.error` in a caught
Server Component request because Next.js development can display it as a full
error overlay. Never print credential values.
