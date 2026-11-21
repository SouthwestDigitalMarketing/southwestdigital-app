# Local SEO geo grid

The staff page at `/local-seo` tracks Bookkeeping Conroe in Google Maps results
around 30.354404, -95.58152. It stores one result for each keyword and grid
point, plus the five highest ranking competitors returned alongside the
business. The provider request asks for 20 Maps results; a blank rank means the
business was not in those 20.

## Costs and schedules

The default is a 9 × 9 grid with points 4 miles apart (about 16 miles each way,
reaching Willis, Montgomery, The Woodlands and Magnolia) and nine phrases,
including the broad "bookkeeper" plus payroll, tax preparation, and CPA
searches. Chris Palmer reads grids over about 20 miles and tracks how far the
top-3 "proximity" reaches (All Thing `concepts/seo-strategy-chris-palmer.md`,
`sops/sop-local-seo-calendar.md`). A weekly Standard scan is 729 SERPs at
$0.0006, or $0.4374 per scan and about $1.89 per month at 4.33 weeks per month.
A manual Live scan costs $0.002 per SERP, or $1.458 with the defaults. The UI
shows the estimate before a scan, requires a cost check for Live scans, and the
server blocks runs above $2.00. Settings allow 3 × 3 through 9 × 9 grids,
0.5, 1, 2, 3, 4 or 5 mile spacing, and 1–12 phrases. A brand that already saved
settings keeps them until they are re-saved on the Local SEO page.

Vercel Cron runs once a day at 15:00 UTC. On Mondays it queues the weekly
Standard scan; every day it checks for completed tasks and saves results. This
single daily job also fits Vercel Hobby's once-a-day cron limit. Manual scans
use the Live endpoint and finish in the staff request.

## Setup

1. The schema is in production (included in the 2026-11-18 baseline,
   `prisma/migrations/0_init`).
2. Store DataForSEO's login and password in `pass` as `dataforseo/api`, then
   configure the production Vercel secrets `DATAFORSEO_LOGIN` and
   `DATAFORSEO_PASSWORD` from those values. Never commit either value.
3. Configure `CRON_SECRET` in Vercel so the scheduled route accepts its call.
4. Open `/local-seo`, save the phrases and grid settings, then check the first
   run's estimated cost before starting it.

Until the account credentials are set, API calls stay off. Recorded response
fixture `src/lib/localSeo/__fixtures__/maps-serp.json` covers result parsing.
