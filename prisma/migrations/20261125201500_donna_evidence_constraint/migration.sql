-- PostgreSQL CHECK treats NULL as passing: require an explicit, nonempty note.
ALTER TABLE "DonnaRequest" DROP CONSTRAINT donna_completed_evidence;
ALTER TABLE "DonnaRequest" ADD CONSTRAINT donna_completed_evidence CHECK
  (state <> 'handled' OR ("completedAt" IS NOT NULL AND "completionNote" IS NOT NULL
    AND length(trim("completionNote")) > 0));
