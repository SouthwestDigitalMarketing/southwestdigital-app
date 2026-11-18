# Database and migration state

**Superseded on 2026-11-18.** The migration history was baselined and SWapp
now uses `prisma migrate dev` locally and `prisma migrate deploy` on
production deploys. Read [database-migrations.md](database-migrations.md).

The old rule here ("never run `prisma migrate deploy` or `prisma migrate
dev`; apply reviewed SQL with `prisma db execute`") no longer applies, and
hand-applying SQL to production is now forbidden instead: the deploy would
apply the same change a second time.
