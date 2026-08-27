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

  Get-Content -Raw (Join-Path (Get-Location).Path "scripts/sql/configure-disposable-runtime-role.sql") | `
    & docker.exe exec -i $taskContainer psql -U postgres -d southwestdigital *> $null
  if ($LASTEXITCODE -ne 0) { throw "Disposable runtime role setup failed" }

  @'
\set ON_ERROR_STOP on

DO $$
DECLARE
  table_name text;
  visible_rows bigint;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'CustomerAccount', 'Contact', 'CustomerContact', 'Lead', 'LeadContact', 'LeadAttributionTouch'
  ]
  LOOP
    EXECUTE format('SELECT count(*) FROM %I', table_name) INTO visible_rows;
    IF visible_rows <> 0 THEN
      RAISE EXCEPTION 'unscoped runtime query exposed % rows from %', visible_rows, table_name;
    END IF;
  END LOOP;
END $$;

BEGIN;
SELECT set_config('app.current_brand_id', 'brand-a', true);

DO $$
DECLARE
  visible_rows bigint;
  affected_rows bigint;
BEGIN
  SELECT count(*) INTO visible_rows FROM "Contact";
  IF visible_rows <> 2 THEN
    RAISE EXCEPTION 'brand-a context saw % contacts instead of 2', visible_rows;
  END IF;

  INSERT INTO "Contact" (id, "brandId", "displayName", status, "marketingConsent", "createdAt", "updatedAt")
  VALUES ('rls-positive-a', 'brand-a', 'RLS Positive A', 'ACTIVE', 'UNKNOWN', now(), now());

  BEGIN
    INSERT INTO "Contact" (id, "brandId", "displayName", status, "marketingConsent", "createdAt", "updatedAt")
    VALUES ('rls-cross-brand', 'brand-b', 'RLS Cross Brand', 'ACTIVE', 'UNKNOWN', now(), now());
    RAISE EXCEPTION 'cross-brand insert was not rejected by RLS';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  UPDATE "Contact" SET "displayName" = 'RLS Cross Update' WHERE id = 'contact-b';
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 0 THEN
    RAISE EXCEPTION 'cross-brand update affected % rows', affected_rows;
  END IF;

  BEGIN
    UPDATE "Contact" SET "brandId" = 'brand-b' WHERE id = 'contact-a';
    RAISE EXCEPTION 'brand-changing update was not rejected by RLS';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  DELETE FROM "Contact" WHERE id = 'contact-b';
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 0 THEN
    RAISE EXCEPTION 'cross-brand delete affected % rows', affected_rows;
  END IF;
END $$;

COMMIT;

DO $$
DECLARE
  visible_rows bigint;
BEGIN
  SELECT count(*) INTO visible_rows FROM "Contact";
  IF visible_rows <> 0 THEN
    RAISE EXCEPTION 'brand context leaked beyond its transaction';
  END IF;
END $$;

BEGIN;
SELECT set_config('app.current_brand_id', 'brand-b', true);
ROLLBACK;

DO $$
DECLARE
  visible_rows bigint;
BEGIN
  SELECT count(*) INTO visible_rows FROM "Lead";
  IF visible_rows <> 0 THEN
    RAISE EXCEPTION 'rolled-back brand context leaked to a reused connection';
  END IF;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER TABLE "Contact" DISABLE ROW LEVEL SECURITY';
    RAISE EXCEPTION 'runtime role disabled row-level security';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    EXECUTE 'SET ROLE postgres';
    RAISE EXCEPTION 'runtime role assumed the migration role';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    PERFORM 1 FROM public._prisma_migrations LIMIT 1;
    RAISE EXCEPTION 'runtime role read Prisma migration history';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

SELECT 'CRM row-level security verified' AS result;
'@ | & docker.exe exec -i -e PGPASSWORD=test-runtime-password $taskContainer `
    psql -h 127.0.0.1 -U southwest_app_runtime -d southwestdigital
  if ($LASTEXITCODE -ne 0) { throw "CRM row-level security verification failed" }

  $taskRlsCatalogQuery = @'
SELECT count(*)
FROM pg_class
WHERE relname IN ('CustomerAccount', 'Contact', 'CustomerContact', 'Lead', 'LeadContact', 'LeadAttributionTouch')
  AND relrowsecurity
  AND relforcerowsecurity;
'@
  $taskRlsTableCount = (($taskRlsCatalogQuery | & docker.exe exec -i $taskContainer psql -U postgres -d southwestdigital -tA) -join "").Trim()
  if ($taskRlsTableCount -ne "6") { throw "Not every CRM table has forced RLS" }

  $taskRuntimeRoleQuery = "SELECT (NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls) FROM pg_roles WHERE rolname = 'southwest_app_runtime';"
  $taskRuntimeRoleSafe = (($taskRuntimeRoleQuery | & docker.exe exec -i $taskContainer psql -U postgres -d southwestdigital -tA) -join "").Trim()
  if ($taskRuntimeRoleSafe -ne "t") { throw "Disposable runtime role can bypass isolation" }

  $taskRuntimeOwnershipQuery = "SELECT count(*) FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner WHERE r.rolname = 'southwest_app_runtime' AND c.relkind IN ('r', 'p');"
  $taskRuntimeOwnedTables = (($taskRuntimeOwnershipQuery | & docker.exe exec -i $taskContainer psql -U postgres -d southwestdigital -tA) -join "").Trim()
  if ($taskRuntimeOwnedTables -ne "0") { throw "Disposable runtime role owns application tables" }
}
finally {
  if ($taskContainerStarted) {
    & docker.exe stop $taskContainer *> $null
  }
}
