# Offboarding and portable data exports

Status: Foundation implemented; export worker, storage provider, and scheduled transition runner remain deployment work.

## Why exports are jobs

Brand data may become much larger than a web request can safely hold in memory or transmit before a serverless timeout. `BrandDataExport` is therefore an auditable job record. A worker will claim a requested job, stream brand-scoped records into versioned JSON Lines files, create a ZIP archive, calculate a SHA-256 checksum, and write the archive to private object storage.

The database stores only the private storage key and artifact metadata. A future download route must authorize the requesting user and mint a short-lived signed URL; permanent public export URLs are prohibited.

Only one requested or processing export may exist for a brand at a time. Historical ready, failed, expired, or cancelled jobs remain visible for audit purposes.

## Export contents

The initial available scopes are:

- brand configuration and theme
- contacts, leads, customers, consent, and attribution
- public integration identifiers, ownership, and non-secret metadata
- the brand's audit history, subject to security redaction policy

Credentials, secret references, encrypted secret material, Southwest-owned source code, and the rented website deployment are excluded. GA4 and advertising history remains in the brand-owned external accounts; the export records how those assets are identified and who owns them.

Documents and website content have reserved scope values so those modules can join the same versioned export contract later. They are not selectable until their storage models and exporters exist.

## Offboarding sequence

Scheduling and revocation are deliberately separate:

1. A Southwest platform administrator schedules service-end, access-end, and retention-end instants using offset-aware ISO 8601 values.
2. The brand remains in its current state until the access-end instant. Scheduling alone cannot lock users out.
3. At or after the access-end instant, an authorized transition changes the brand to `OFFBOARDING`, suspends only that brand's memberships and integrations, and ensures an export job exists.
4. A worker produces and verifies the export, then records its storage key, checksum, size, completion time, and download expiry.
5. After the retention instant and confirmed delivery, a separately reviewed deletion workflow removes or anonymizes brand-controlled live data in dependency order.
6. Encrypted backups expire on their documented schedule. Deletion evidence and legally required operational records remain.

The current UI supports steps 1 and 3. Step 3 refuses to run before the scheduled access-end instant and requires the brand slug to be re-entered. Production deployment still needs a scheduled runner so due plans do not depend on a human button click.

## Database protections

- one live (`PLANNED` or `IN_PROGRESS`) offboarding plan per brand
- one active (`REQUESTED` or `PROCESSING`) export per brand
- restrictive brand and plan foreign keys so deletion cannot erase workflow evidence accidentally
- nullable actor relationships so deletion of a user does not erase who initiated an action from the audit trail
- no cascading brand deletion
