# Cutover: restricted roles and row-level security in production

**Status: NOT READY. Production cutover is prohibited until every gate below
is closed and Tom makes the cutover decision.** No production database or env
was accessed while preparing this runbook. The scratch evidence is recorded at
[`jobs/rls/worker-m3-r1.md`](../../jobs/rls/worker-m3-r1.md).

This is an operator checklist, not authorization to run it. Never put a
production password or connection URL in this file, a shell history, a repo,
or a local `.env`. Use the approved secret manager and a reviewed, disposable
operator session. Do not run `prisma migrate deploy`, `prisma migrate dev`, or
`prisma db push`; the project migration rules prohibit those commands.

References: [database-hosting.md](database-hosting.md),
[database-role-provisioning.md](database-role-provisioning.md), and
[database tenant isolation](../architecture/database-tenant-isolation.md).

## M4 gate register — all remain open

| Gate | Required evidence to close it | Owner | Current state |
| --- | --- | --- | --- |
| Repeatable migration chain | The full 40-file ordered migration replay currently stops after 13 files at `20260827200000_add_catalog_service_real_estate_specific` because the chain lacks the `catalog_services` baseline. Provide or verify the consolidated baseline, then show a repeatable full replay from an empty scratch database. | Ummon / app owner | **OPEN — blocks cutover** |
| Migration DDL ownership | In scratch rehearsal, `swd_migrator` had `CREATE` on `public` but could not `ALTER` existing `Contact` because it owned no tables. Define and rehearse a least-privilege migration ownership/DDL strategy for both existing and new objects. `CREATE` alone is not sufficient. | Ummon / app owner | **OPEN — blocks cutover** |
| Restricted-role app suite | The restricted-role full suite was 880/881: one pre-existing pipe contacts contract/test mismatch. Reconcile it as a separate task and rerun the suite. Do not change the pipe contacts API in this branch. | Ummon / app owner | **OPEN — blocks cutover** |
| Production readiness and decision | Verify target fingerprint, production roles/grants, tested backup and restore path, secret configuration, and all preflight and rollback steps. After all other gates close, make the explicit cutover decision. | Tom | **OPEN — no decision / production checks unverified** |
| Owner credential cleanup | After an approved cutover, rotate owner credentials and remove obsolete copies from deployment settings and machine env files; verify cleanup without recording secret values. | Albedo | **OPEN — post-cutover only** |

An open gate is a stop. Do not start a production change to “test” an open
gate. Record closure evidence and date with the gate owner before scheduling a
cutover window. M3 is ACCEPTed; that acceptance does not close these gates.

## Preflight checklist — complete and record before any change

Every item is required. The operator records pass/fail, timestamp, evidence
location, and owner initials in the approved change record. A blank, failed,
or unverifiable item means **STOP**. Do not place secrets or client data in
that record.

### Owner gates and change approval

- [ ] Ummon/app owner attaches the repeatable 40-file migration replay after
  supplying or verifying the missing consolidated `catalog_services` baseline.
- [ ] Ummon/app owner attaches the tested migration ownership/DDL strategy,
  including an `ALTER TABLE` of an existing table and creation of a new table
  using the intended production migration identity.
- [ ] Ummon/app owner attaches a clean restricted-role full-suite result and
  documents separate resolution of the pre-existing pipe contacts
  contract/test mismatch. No pipe contacts API change is included in this
  branch.
- [ ] Tom reviews the closed gates, change plan, downtime/impact window,
  operator, rollback authority, and explicitly approves the cutover in the
  same change window.
- [ ] Albedo is assigned the post-cutover credential rotation and secret
  cleanup, to occur only after Tom approves cutover.

### Target, access, and code

- [ ] Record the intended provider project identifier, database/cluster
  identifier, region, host fingerprint, database name, port, and schema. Verify
  each value in the provider console through a known account path; compare it
  with the approved target record. Do not infer the target from an env file.
- [ ] Confirm the deploy artifact is the reviewed commit and that the six
  RLS tables and policies match the reviewed migrations:
  `CustomerAccount`, `Contact`, `CustomerContact`, `Lead`, `LeadContact`, and
  `LeadAttributionTouch`.
- [ ] Confirm the exact migration SQL files, checksums, order, transaction
  behavior, and the approved migration identity. Resolve the DDL ownership
  gate before any migration is attempted.
- [ ] Confirm an operator account can connect only to the verified target and
  that the deployment can be rolled back without deleting or overwriting
  application data.
- [ ] Confirm the current deployment remains healthy and capture baseline
  sign-in, CRM read/write, proposal, ticket, error-rate, and latency checks.

### Backup and recovery

- [ ] Take a fresh provider backup/PITR checkpoint and an independent
  `pg_dump` using the approved owner path. Store both in approved protected
  storage; record identifiers, timestamps, and retention only.
- [ ] Verify the backup is readable and that a restore rehearsal has completed
  on a separate disposable target. A successful backup command alone does not
  close this check.
- [ ] Write down the restore decision owner, recovery target, expected restore
  time, and data-loss window. Tom confirms the recovery plan is acceptable.
- [ ] Confirm the prior application connection secret remains available in the
  secret manager for rollback through the agreed observation window. Never
  copy it into a file or this checklist.

### Roles, grants, and secrets

- [ ] Create passwords independently for `swd_migrator` and
  `swd_web_runtime`; place them only in the approved secret manager and
  deployment secret fields. Never print them or store them in repo files.
- [ ] Apply the grant matrix below from a reviewed allowlist. Verify actual
  grants and inherited grants as each role. Do not use `GRANT ... ON ALL
  TABLES` without excluding system/migration objects and reconciling the
  allowlist.
- [ ] Verify `swd_web_runtime` is `LOGIN`, `NOSUPERUSER`, `NOCREATEDB`,
  `NOCREATEROLE`, `NOINHERIT`, `NOREPLICATION`, `NOBYPASSRLS`; owns no
  application objects, is not a member of a privileged role, and cannot
  `SET ROLE` to one.
- [ ] Verify `swd_migrator` flags and memberships against the approved DDL
  strategy. The M3 scratch grant `CREATE ON SCHEMA public` by itself failed to
  authorize ALTER on existing `Contact`; do not treat that grant as a working
  migration strategy.
- [ ] Verify no app access remains through `PUBLIC`, `anon`, `authenticated`,
  or `service_role` that bypasses the intended runtime boundary. Confirm
  runtime cannot read `_prisma_migrations`, create objects, disable/alter RLS,
  or access another schema.
- [ ] Verify only the intended runtime uses the pooled `DATABASE_URL`
  (provider pooler, port `6543`, `pgbouncer=true`) and ordinary application
  runtime has no `DIRECT_DATABASE_URL`. Migration credentials must be scoped
  to the migration job and absent from normal app runtime.

### Final go/no-go

- [ ] All gate rows above have dated evidence and owner signoff.
- [ ] Run the read-only role, privilege, RLS flag, policy, and target
  fingerprint queries from a reviewed script; save redacted results.
- [ ] Confirm all six protected tables have both `relrowsecurity` and
  `relforcerowsecurity` enabled and the expected policies are installed.
- [ ] Confirm runtime returns zero rows from each protected table with no
  brand context, returns only the authorized brand with context, and rejects
  a cross-brand write. Confirm `_prisma_migrations` is unreadable.
- [ ] Confirm the deployment smoke-test owner and stop condition for each
  check. Tom records **GO** or **NO-GO**. Only an explicit **GO** permits the
  production stages below.

## Grant matrix to implement and verify

This is the observed minimum matrix from M3's 107-table schema-derived
scratch baseline. It is not a claim that production already has these grants.
The 107 table names below are the exact current application table inventory
used in that rehearsal. `_prisma_migrations` is excluded. Reconcile inventory
changes against the reviewed Prisma schema and target before granting.

| Object | `swd_web_runtime` | `swd_migrator` | Notes |
| --- | --- | --- | --- |
| Database | `CONNECT` | `CONNECT` | No database ownership or create-database right. |
| `public` schema | `USAGE` | `USAGE`, plus `CREATE` only under the owner-approved DDL strategy | M3 proved CREATE is not enough to alter an existing table. |
| Each of the 107 allowlisted application tables below | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Only the ownership/DDL rights proven by the still-open migration strategy | Runtime table grants provide access; RLS policies enforce row isolation on the six protected tables. |
| `_prisma_migrations` | none | Only the minimum access required by the approved migration process, verified separately | Runtime must not read or write it. M3 used a scratch-only dummy table because the generated baseline omits it. |
| Sequences | none in M3; grant only exact sequence rights shown necessary by schema and tests | Only exact rights shown necessary by approved strategy | M3 baseline had no sequences. Do not blanket grant. |
| Other schemas, functions, extensions, and objects | none unless separately reviewed and documented | only exact approved migration needs | No blanket schema/function grants. |
| Role membership / ownership | no memberships; owns no objects | no superuser or elevated-role membership; ownership only as approved by the resolved DDL strategy | Do not infer ownership from `CREATE`. |

Current application table allowlist (107):

```text
User, Account, Session, VerificationToken, Brand, BrandDomain,
BrandMembership, BrandTheme, BrandToolLink, BrandMediaFolder, BrandMedia,
BrandDiscount, brand_discount_quotes, InternProfile,
member_onboarding_profiles, member_documents, member_audit_events,
OnboardingInvite, OnboardingSubmission, AgreementAcceptance,
MemberOnboardingStep, OnboardingStepConfig, OnboardingFlow,
OnboardingFlowStepConfig, OnboardingFlowCustomStep,
OnboardingFlowAssignment, OnboardingStepQuestion, OnboardingStepUpload,
OnboardingFlowStepOrder, TimecardEntry, TimecardSession, ContractorInvoice,
CareerPathStep, CredentialBadge, MemberCredentialBadge, AppNotice,
TicketClient, ClientIntakeInvite, ReviewRequest, Campaign, CampaignContact,
Contact, contact_brand_links, contact_tags, contact_tag_links,
contact_tag_automations, ClientContact, LeadContact, Ticket, TicketComment,
TeamMeeting, TeamMeetingAccess, TeamMeetingClient, MeetingLead,
TeamMeetingLead, MeetingTag, TeamMeetingTag, TeamMeetingContact, Pipeline,
PipelineStage, PipelineItem, ContentCalendarItem, SourceTagClickDaily,
ArchivedYouTubeVideo, StrategyNote, DailyLog, log_items, focus_quotes,
focus_quote_settings, standards_checks, scorecard_attendance_records,
scorecard_task_records, legends, motivational_quotes, Engagement,
DiscoveryItem, proposal_documents, proposal_phases, proposal_phase_items,
proposal_sections, proposal_section_items, ProposalPackage,
ProposalPackageFeature, catalog_services, catalog_service_tags,
package_services, pricing_rules, proposal_selections, quote_clients, quotes,
quote_revisions, quote_line_items, quote_templates, firm_profile,
CompanyRevenueMonth, BrandFeature, BrandIntegration, AgreementTemplate,
ProposalOptionsTemplate, AuditEvent, CustomerAccount, CustomerContact, Lead,
LeadAttributionTouch, BrandOffboardingPlan, BrandDataExport, EmailConnection
```

All names are case-sensitive PostgreSQL identifiers as generated from the
current schema. The six RLS tables are `CustomerAccount`, `Contact`,
`CustomerContact`, `Lead`, `LeadContact`, and `LeadAttributionTouch`. Other
tables in the inventory do not gain row-level isolation from this migration;
their existing application/query boundaries remain relevant.

## Production stages and rollback by stage

Proceed in order, only after every preflight item is checked and Tom records
**GO**. Keep a timestamped operator log with redacted results. Stop on the
first unexpected result; do not improvise grants or DDL.

### Stage 0 — freeze and capture current state

1. Announce the approved window to the internal operators; pause unrelated
   schema and role changes.
2. Capture the target fingerprint, current role attributes/memberships, grants,
   table ownership, six-table RLS flags and policies, deployment secret
   version identifiers, and baseline smoke checks.

**Rollback:** no database mutation has occurred. Cancel the window and remove
the freeze after confirming the baseline is intact.

### Stage 1 — schema and RLS migrations

Only after the full migration-chain and DDL-ownership gates close, apply the
reviewed SQL migrations in their verified order using the approved migration
identity. Use an explicit transaction only if the exact SQL files and provider
confirm transactional DDL is supported; otherwise use the approved recovery
plan and record each file's completion. Do not run the entire incomplete
40-file chain until its missing baseline is fixed and repeatably rehearsed.

Verify each migration's resulting schema, constraints, indexes, RLS flags,
policies, and data counts before committing a transaction or proceeding.

**Rollback:** before transaction commit, issue `ROLLBACK`. If any migration
committed, stop and use the pre-approved reverse SQL or restore plan for that
exact migration state. The simple RLS reversal (`NO FORCE`, `DISABLE ROW LEVEL
SECURITY`, then drop the named policies) only removes row enforcement; it does
not reverse structural changes such as columns, constraints, indexes, or
data updates. Do not run that partial reversal as if it restored the prior
schema. If exact reverse SQL was not rehearsed, restore the verified backup to
the approved recovery target and have Tom decide whether to point the app back.

### Stage 2 — roles and grants

Create `swd_migrator` and `swd_web_runtime` using the approved secret manager.
Apply only the resolved matrix and DDL ownership strategy. Verify grants and
negative capabilities through fresh connections using each role. Do not
continue while the DDL strategy is unresolved.

**Rollback:** revoke the grants made in this stage and remove memberships.
Drop a role only after confirming it owns no objects, has no dependencies, and
has no active sessions; use reviewed `DROP OWNED BY` / `DROP ROLE` statements
for the exact role. If the resolved strategy assigned object ownership, first
transfer that ownership to the pre-approved owner; never cascade-drop
application objects. The prior application role remains active through the
rollback window.

### Stage 3 — read-only verification as the runtime role

Connect as `swd_web_runtime` through the intended path. Verify flags,
memberships, grants, ownership, six-table `ENABLE` and `FORCE` state, policy
definitions, zero rows without context, correct brand-scoped reads and writes,
denial of cross-brand writes, and denial of migration metadata and DDL.

**Rollback:** no data or schema changes are made in this stage. On any failed
check, stop before changing deployment settings; revoke/fix only through the
reviewed Stage 2 procedure and leave the old app role serving traffic.

### Stage 4 — deployment connection switch

Tom's designated operator updates the deployment secret settings: set
`DATABASE_URL` to the `swd_web_runtime` pooled URL (`6543`,
`pgbouncer=true`) and remove `DIRECT_DATABASE_URL` from ordinary runtime.
Keep the prior credential available in the secret manager through the agreed
rollback window. Deploy the reviewed artifact. Exercise sign-in, CRM
create/list, proposal, ticket, and relevant background paths; monitor errors,
latency, and RLS denials.

**Rollback:** stop rollout and restore the previous `DATABASE_URL` secret
version, then redeploy or restart the known-good artifact as required. Restore
only through the secret manager; never paste the secret into a shell or file.
Keep the owner credential active until traffic and background workers are
confirmed back on the prior path. Record the time and smoke-test outcome.

### Stage 5 — observation and service separation

Observe the agreed health window and confirm no runtime process depends on
owner access. Uncle Invoice is a separate service and schema (`uncleinvoice`);
move it to a separately reviewed role and plan only as its own approved
change, not as an implicit part of this SWapp cutover.

**Rollback:** if health checks fail, execute Stage 4 rollback. Do not alter
Uncle Invoice role settings as part of the SWapp rollback unless its separate
change plan explicitly requires it.

### Stage 6 — owner credential rotation and secret cleanup

After Tom confirms cutover success, Albedo rotates the owner credential and
removes stale owner credentials from deployment settings and machine env
files. Verify the secret locations by name and version metadata only; do not
print or copy values. Record completion evidence without secrets.

**Rollback:** do not restore an exposed or retired owner password. If rotation
or cleanup breaks a needed administrative path, stop and have the authorized
owner issue a new credential through the secret manager, update only approved
admin paths, and repeat the verification. App rollback remains the Stage 4
procedure. Credential rotation does not authorize returning the owner URL to
ordinary runtime.

## Ownership boundaries

- **Ummon / app owner:** close the migration-baseline/replay gate, migration
  ownership/DDL gate, and restricted-role suite gate. Reconcile the pipe
  contacts mismatch as a separate task; do not change its API in this branch.
- **Tom:** verify the production target, backup/restore, secret setup, and
  preflight/rollback evidence; make the explicit cutover go/no-go decision.
- **Albedo:** after approved cutover, rotate owner credentials and clean up
  stale secrets; report evidence without values.
- **Operator:** perform only the approved checklist, preserve redacted
  evidence, and stop at any failed or unknown check. The operator cannot
  waive an owner gate.

## M3 rehearsal evidence and limits

M3 used a disposable local Postgres 17.5 container bound only to
`127.0.0.1:54329`; it was removed after checks. A schema-derived 107-table
baseline and the two RLS migration SQL files were applied manually. The full
40-file replay stopped after 13 at
`20260827200000_add_catalog_service_real_estate_specific` because the
`catalog_services` baseline is missing. The scratch roles were both
`NOBYPASSRLS`; runtime received DML on the 107 application tables, not
`_prisma_migrations`, and could not create objects. The migrator could create
new objects but did not own existing `Contact`, so its CREATE grant did not
authorize ALTER. The restricted-role full suite was 880/881, with one
pre-existing pipe contacts contract/test mismatch. These are open gates above,
not production validation. Full commands and results are in
[`jobs/rls/worker-m3-r1.md`](../../jobs/rls/worker-m3-r1.md).
