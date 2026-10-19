# Read-only operator role

Created in the shared production project on 2026-10-19 by Kassad, with Thomas's
approval, so that reading data never needs the `postgres` owner credential.

## What it is

- Role `swd_readonly`: `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT
  NOREPLICATION NOBYPASSRLS`, `CONNECTION LIMIT 5`, `default_transaction_read_only
  = on`, `statement_timeout = 30s`.
- `SELECT` only, on an allowlist of sales and CRM tables, by column. Columns whose
  names match `token|secret|password|passwd|credential|hash|ciphertext|encrypted|signature`
  are left out, so OAuth tokens, session tokens, public quote tokens and agreement
  token hashes cannot be read. `Account`, `Session`, `VerificationToken`,
  `EmailConnection`, `BrandIntegration`, member onboarding and tax tables, and the
  `uncleinvoice` schema are not granted at all.
- Because column grants omit the secret columns, `select *` on `Engagement`,
  `quotes` and `ReviewRequest` is refused: name the columns.

## Verified

Connected as the new role: reads allowed tables; refused on `Account`, `Session`,
`quotes."publicToken"` and the `uncleinvoice` schema; `UPDATE`, `INSERT` and
`CREATE TABLE` refused even after `SET default_transaction_read_only = off`
(privilege-level denial, not only the session default).

## Credential

The password is generated once and kept only in `~/.config/swapp/readonly.env`
(mode 600, directory mode 700) on Ripley as `SWAPP_RO_URL`. It is not in any
repository. The pooled username is `swd_readonly.<project-ref>`, port 5432.

## SQL (password omitted)

```sql
CREATE ROLE swd_readonly LOGIN PASSWORD '<generated>' NOSUPERUSER NOCREATEDB
  NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5;
ALTER ROLE swd_readonly SET default_transaction_read_only = on;
ALTER ROLE swd_readonly SET statement_timeout = '30s';
GRANT CONNECT ON DATABASE postgres TO swd_readonly;
GRANT USAGE ON SCHEMA public TO swd_readonly;
-- For each allowlisted table, grant SELECT on every column whose name does not
-- match the secret pattern above (generated with a DO block over
-- information_schema.columns).
```

Allowlist: `Brand BrandDomain Contact contact_brand_links contact_tags
contact_tag_links contact_tag_automations Campaign CampaignContact CustomerAccount
CustomerContact Lead LeadContact LeadAttributionTouch MeetingLead Pipeline
PipelineStage PipelineItem TicketClient ClientContact quote_clients quotes
quote_line_items quote_revisions Engagement ReviewRequest Ticket log_items
StrategyNote catalog_services pricing_rules`.

## Revoking

`REASSIGN OWNED BY swd_readonly TO postgres; DROP OWNED BY swd_readonly;
DROP ROLE swd_readonly;` as the owner, then delete the local credential file.
