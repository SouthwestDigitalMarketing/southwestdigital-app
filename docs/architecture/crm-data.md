# Brand-owned CRM and attribution data

## Ownership boundary

Customer accounts, contacts, leads, consent records, attribution touches, and related uploaded business data belong to a single brand. They are client-controlled data for export and offboarding purposes.

The same person may appear as separate contacts in multiple brands. The platform does not merge or reveal those records across brands merely because their email addresses match.

## Database isolation

Every CRM record has a required `brandId`. Relationships that could otherwise cross brands use composite foreign keys:

```text
(brandId, customerAccountId) -> CustomerAccount(brandId, id)
(brandId, contactId)         -> Contact(brandId, id)
(brandId, leadId)            -> Lead(brandId, id)
```

This means an application defect cannot associate a Contigo contact with a Melbourne CFO lead without PostgreSQL rejecting the write.

Hard deletion is restricted. Records are archived during normal use and explicitly deleted only through the offboarding workflow.

## Attribution

A lead can retain multiple attribution touches, including:

- source, medium, campaign, term, and content
- landing page and referrer
- Google click identifiers
- Meta `fbclid`, campaign, ad-set, and ad identifiers
- other provider metadata

These fields capture inbound attribution. They do not authorize the portal to transmit contact, financial, authenticated-session, or other sensitive data to Meta or another advertising network.

## Consent

Contact marketing consent is explicit: `UNKNOWN`, `GRANTED`, or `DENIED`, plus timestamp and source. A lead source or advertising click is not itself proof of marketing consent.

