-- A clean Tom cancels ends as 'cancelled' and is never claimed again.
ALTER TABLE "DonnaJob" DROP CONSTRAINT donna_job_state;
ALTER TABLE "DonnaJob" ADD CONSTRAINT donna_job_state CHECK (status IN ('pending','leased','done','cancelled'));
