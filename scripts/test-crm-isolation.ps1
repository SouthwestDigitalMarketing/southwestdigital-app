$ErrorActionPreference = "Stop"

$taskContainer = "southwestdigital-app-crm-test"
$taskContainerStarted = $false

try {
  $taskExisting = & docker.exe ps -a --filter "name=^$taskContainer$" --format "{{.Names}}"
  if ($taskExisting) {
    throw "Refusing to replace existing container $taskContainer"
  }

  & docker.exe run --rm -d --name $taskContainer `
    -e POSTGRES_PASSWORD=test-platform-password `
    -e POSTGRES_DB=southwestdigital `
    -p 127.0.0.1::5432 postgres:16-alpine *> $null
  if ($LASTEXITCODE -ne 0) { throw "Failed to start disposable PostgreSQL" }
  $taskContainerStarted = $true

  $taskReady = $false
  for ($taskAttempt = 0; $taskAttempt -lt 30; $taskAttempt++) {
    & docker.exe exec $taskContainer pg_isready -U postgres -d southwestdigital *> $null
    if ($LASTEXITCODE -eq 0) {
      $taskReady = $true
      break
    }
    Start-Sleep -Seconds 1
  }
  if (-not $taskReady) { throw "Disposable PostgreSQL did not become ready" }

  $taskDbPort = ((& docker.exe port $taskContainer 5432/tcp) -split ":")[-1]
  $env:DATABASE_URL = "postgresql://postgres:test-platform-password@127.0.0.1:$taskDbPort/southwestdigital"
  $env:DIRECT_DATABASE_URL = $env:DATABASE_URL
  & npx.cmd prisma migrate deploy *> $null
  if ($LASTEXITCODE -ne 0) { throw "Migration deploy failed" }

  @'
\set ON_ERROR_STOP on
INSERT INTO "Brand" (id, slug, name, status, "createdAt", "updatedAt") VALUES
  ('brand-a', 'brand-a', 'Brand A', 'ACTIVE', now(), now()),
  ('brand-b', 'brand-b', 'Brand B', 'ACTIVE', now(), now());

INSERT INTO "CustomerAccount" (id, "brandId", code, name, status, "createdAt", "updatedAt") VALUES
  ('customer-a', 'brand-a', 'CLIENT-1', 'Customer A', 'ACTIVE', now(), now()),
  ('customer-b', 'brand-b', 'CLIENT-1', 'Customer B', 'ACTIVE', now(), now());

INSERT INTO "Contact" (id, "brandId", "displayName", email, "normalizedEmail", status, "marketingConsent", "createdAt", "updatedAt") VALUES
  ('contact-a', 'brand-a', 'Shared Person A', 'shared@example.test', 'shared@example.test', 'ACTIVE', 'UNKNOWN', now(), now()),
  ('contact-a2', 'brand-a', 'Second Person A', 'second@example.test', 'second@example.test', 'ACTIVE', 'UNKNOWN', now(), now()),
  ('contact-b', 'brand-b', 'Shared Person B', 'shared@example.test', 'shared@example.test', 'ACTIVE', 'UNKNOWN', now(), now());

INSERT INTO "Lead" (id, "brandId", name, status, "createdAt", "updatedAt") VALUES
  ('lead-a', 'brand-a', 'Lead A', 'NEW', now(), now()),
  ('lead-b', 'brand-b', 'Lead B', 'NEW', now(), now());

INSERT INTO "CustomerContact" (id, "brandId", "customerAccountId", "contactId", "isPrimary", "createdAt", "updatedAt")
VALUES ('customer-contact-a', 'brand-a', 'customer-a', 'contact-a', true, now(), now());

DO $$
BEGIN
  BEGIN
    INSERT INTO "CustomerContact" (id, "brandId", "customerAccountId", "contactId", "isPrimary", "createdAt", "updatedAt")
    VALUES ('cross-brand-contact', 'brand-a', 'customer-a', 'contact-b', false, now(), now());
    RAISE EXCEPTION 'cross-brand customer/contact association was not rejected';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    INSERT INTO "LeadAttributionTouch" (id, "brandId", "leadId", "touchType", "capturedAt")
    VALUES ('cross-brand-touch', 'brand-a', 'lead-b', 'FIRST_TOUCH', now());
    RAISE EXCEPTION 'cross-brand lead attribution was not rejected';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    UPDATE "Lead" SET "convertedCustomerId" = 'customer-b' WHERE id = 'lead-a';
    RAISE EXCEPTION 'cross-brand lead conversion was not rejected';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    INSERT INTO "CustomerContact" (id, "brandId", "customerAccountId", "contactId", "isPrimary", "createdAt", "updatedAt")
    VALUES ('second-primary', 'brand-a', 'customer-a', 'contact-a2', true, now(), now());
    RAISE EXCEPTION 'duplicate primary contact was not rejected';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    DELETE FROM "Brand" WHERE id = 'brand-a';
    RAISE EXCEPTION 'hard deletion of a brand with CRM data was not rejected';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END $$;

SELECT 'CRM isolation constraints verified' AS result;
'@ | & docker.exe exec -i $taskContainer psql -U postgres -d southwestdigital
  if ($LASTEXITCODE -ne 0) { throw "CRM isolation verification failed" }
}
finally {
  if ($taskContainerStarted) {
    & docker.exe stop $taskContainer *> $null
  }
}
