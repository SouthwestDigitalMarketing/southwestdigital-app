# Data ownership and portability boundary

Status: Product and engineering policy; final contract language requires legal review.

## Southwest-owned system

- application and website source code
- designs, templates, workflows, and reusable configuration
- platform infrastructure and operational tooling
- non-client-specific product improvements

## Brand-controlled data

- contacts, leads, customers, and business records
- client-supplied documents and content
- client-provided brand assets, subject to their underlying rights
- GA4 properties and analytics history
- advertising accounts, datasets/pixels, audiences, leads, and campaign history
- other client-owned platform data named in the service agreement

Southwest may manage brand-controlled external systems through delegated or partner access. Management access does not change ownership.

## Analytics and advertising assets

- GA4 properties and their analytics history should be created as brand-owned assets. Southwest receives only the delegated access needed to configure and support them.
- Meta Business assets, datasets/pixels, ad accounts, audiences, leads, and campaign history should likewise remain brand-owned, with Southwest using partner access when management is requested.
- A GTM container may be Southwest-owned when it is part of the rented website implementation. The integration registry records that ownership explicitly instead of treating all tracking assets alike.
- Public identifiers such as a GA4 measurement ID, GTM container ID, or Meta Pixel ID are stored separately from credentials. Tokens, API secrets, and delegated credentials must never be placed in public integration configuration.
- An app export includes integration ownership and public asset metadata. Analytics and advertising history remains in the brand-owned external property/account and is not duplicated into the application database by default.

## Offboarding

1. Suspend new activity and integrations.
2. Revoke interactive access at the contractually defined time.
3. Produce a documented export of brand-controlled data.
4. Preserve the export for the agreed download window.
5. Retain live data only for the agreed legal/operational period.
6. Delete or anonymize tenant-owned live records.
7. Allow encrypted backups containing old records to expire on schedule.
8. Preserve only legally required billing, security, and deletion evidence.

Website code and a functioning website deployment are not included in the data export unless a separate transfer or buyout agreement says otherwise.

The engineering workflow and scalability constraints are defined in [Offboarding and portable data exports](./offboarding-and-exports.md).
