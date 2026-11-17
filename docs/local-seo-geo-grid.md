# Local SEO geo grid

The staff page at `/local-seo` tracks Bookkeeping Conroe in Google Maps results
around 30.354404, -95.58152. It stores one result for each keyword and grid
point, plus the five highest ranking competitors returned alongside the
business. The provider request asks for 20 Maps results; a blank rank means the
business was not in those 20.

## Costs and schedules

The default is a 7 × 7 grid with eight phrases, including payroll, tax
preparation, and CPA searches. A weekly Standard scan is 392 SERPs at $0.0006,
or $0.2352 per scan and about $1.02 per month at 4.33 weeks per month. A
manual Live scan costs $0.002 per SERP, or $0.784 with the defaults. The UI
shows the estimate before a scan, requires a cost check for Live scans, and
the server blocks runs above $2.00. Settings allow 3 × 3 through 9 × 9 grids,
0.5, 1, or 2 mile spacing, and 1–12 phrases.

Vercel Cron runs once a day at 15:00 UTC. On Mondays it queues the weekly
Standard scan; every day it checks for completed tasks and saves results. This
single daily job also fits Vercel Hobby's once-a-day cron limit. Manual scans
use the Live endpoint and finish in the staff request.

## Setup

1. Apply `prisma/migrations/20261117170000_local_seo_geo_grid/migration.sql`
   through the project's reviewed `prisma db execute` process. Do not use
   `prisma migrate deploy`, `prisma migrate dev`, or `prisma db push`.
2. Store DataForSEO's login and password in `pass` as `dataforseo/api`, then
   configure the production Vercel secrets `DATAFORSEO_LOGIN` and
   `DATAFORSEO_PASSWORD` from those values. Never commit either value.
3. Configure `CRON_SECRET` in Vercel so the scheduled route accepts its call.
4. Open `/local-seo`, save the phrases and grid settings, then check the first
   run's estimated cost before starting it.

Until the account credentials are set, API calls stay off. Recorded response
fixture `src/lib/localSeo/__fixtures__/maps-serp.json` covers result parsing.
