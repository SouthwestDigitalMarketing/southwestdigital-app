# Texts (Quo)

Follow [Quo intake, recordings and provisional spam](quo-intake-policy.md)
for cross-channel recording/transcript filing, lead folders, live Quo contact
updates and the 14-day Potential spam hold.

1. Discover every phone line with quo status. Inspect the native Quo backlog and
   the local sms unread, needs-reply, incoming and starred views across all time.
   Inspect CLI help before using unfamiliar commands. Compare native and cached
   coverage. A single configured line or the latest 25 messages is incomplete.
   The SMS CLI accepts --limit. After reading its total count, increase --limit
   to cover that total and verify that the returned count matches. Use the
   explicit needs-reply category (sms ls needs-reply all). Read task lists
   through pipe task ls. These checks still establish only local-cache coverage.
2. Read entire conversations, including outgoing replies, before deciding what
   is still pending. Apply confirmed sender rules first. Separate genuine
   enquiries, existing-client work, spam, verification codes and uncertainty.
3. For genuine work reuse the contact and lead, prepare the needed reply as a
   draft/task, assign owner and due date. Deduplicate tasks by message/thread ID.
   Do not turn every unknown number into a lead.
4. For confirmed spam apply only supported reversible native spam/archive
   actions, preserve an undo reference and read the native thread back. If the
   current tool cannot do this, keep that thread pending; a local ignore marker
   does not remove native Quo spam. Ambiguous spam becomes a decision.
5. Re-query native Quo and all pending views. Report unresolved thread IDs,
   reasons, owner and next action. A waiting reply or callback stays pending.

Related All Thing SOPs: sop-sales-tag-actions, sop-lead-file, scan-rulebook.
