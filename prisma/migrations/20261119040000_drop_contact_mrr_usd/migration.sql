-- service-records-design step 5: MRR comes from service records.
-- Code stopped reading this column in the previous deploy (PR #169).
-- Values before the drop: ripley ~/backups/swapp-db/contact-mrrUsd-before-drop-20261118.csv
ALTER TABLE "Contact" DROP COLUMN "mrrUsd";
