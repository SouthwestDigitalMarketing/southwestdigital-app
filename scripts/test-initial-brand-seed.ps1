$ErrorActionPreference = "Stop"

$taskContainer = "southwestdigital-app-initial-seed-test"
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
  $env:ALLOW_INITIAL_BRAND_SEED = "true"
  $env:INITIAL_BOOKKEEPING_OWNER_EMAIL = "thomas@bookkeepingconroe.test"
  $env:INITIAL_PLATFORM_OWNER_EMAIL = "platform-owner@southwestdigital.test"
  $env:INITIAL_DAGNY_EMAIL = "dagnymotor@gmail.com"

  & npx.cmd prisma migrate deploy *> $null
  if ($LASTEXITCODE -ne 0) { throw "Migration deploy failed" }

  & node.exe scripts/seed-initial-brands.mjs *> $null
  if ($LASTEXITCODE -ne 0) { throw "Initial brand seed attempt failed" }

  $taskLifecycleQuery = @'
UPDATE "Brand" SET status = 'ACTIVE' WHERE slug = 'contigo-accounting';
UPDATE "BrandDomain" SET status = 'VERIFIED', "verifiedAt" = now() WHERE hostname = 'app.contigoaccounting.com';
UPDATE "BrandMembership" SET status = 'ACTIVE'
WHERE "brandId" = (SELECT id FROM "Brand" WHERE slug = 'contigo-accounting')
  AND "userId" = (SELECT id FROM "User" WHERE email = 'dagnymotor@gmail.com');
UPDATE "BrandIntegration" SET status = 'ACTIVE', "lastVerifiedAt" = now()
WHERE "brandId" = (SELECT id FROM "Brand" WHERE slug = 'contigo-accounting')
  AND key = 'website-gtm';
'@
  $taskLifecycleQuery | & docker.exe exec -i $taskContainer psql -U postgres -d southwestdigital *> $null
  if ($LASTEXITCODE -ne 0) { throw "Lifecycle preservation setup failed" }

  & node.exe scripts/seed-initial-brands.mjs *> $null
  if ($LASTEXITCODE -ne 0) { throw "Idempotent seed rerun failed" }

  $taskSeedQuery = @'
SELECT count(*)
FROM "Brand" b
WHERE b.slug IN ('southwest-digital-marketing', 'bookkeeping-conroe', 'contigo-accounting', 'melbourne-cfo')
  AND (SELECT count(*) FROM "Brand" WHERE slug IN ('southwest-digital-marketing', 'bookkeeping-conroe', 'contigo-accounting', 'melbourne-cfo')) = 4
  AND (SELECT count(*) FROM "Brand" WHERE slug IN ('southwest-digital-marketing', 'bookkeeping-conroe', 'melbourne-cfo') AND status = 'DRAFT') = 3
  AND (SELECT count(*) FROM "Brand" WHERE slug = 'contigo-accounting' AND status = 'ACTIVE') = 1
  AND (SELECT count(*) FROM "BrandTheme" t JOIN "Brand" tb ON tb.id = t."brandId" WHERE tb.slug IN ('southwest-digital-marketing', 'bookkeeping-conroe', 'contigo-accounting', 'melbourne-cfo')) = 4
  AND (SELECT count(*) FROM "BrandDomain" d JOIN "Brand" db ON db.id = d."brandId" WHERE db.slug IN ('southwest-digital-marketing', 'bookkeeping-conroe', 'melbourne-cfo') AND d.status = 'PENDING' AND d.purpose = 'APP') = 3
  AND (SELECT count(*) FROM "BrandDomain" WHERE hostname = 'app.contigoaccounting.com' AND status = 'VERIFIED' AND "verifiedAt" IS NOT NULL) = 1
  AND (SELECT count(*) FROM "BrandMembership" m JOIN "User" u ON u.id = m."userId" JOIN "Brand" mb ON mb.id = m."brandId" WHERE u.email = 'dagnymotor@gmail.com' AND mb.slug = 'contigo-accounting' AND m.role = 'OWNER' AND m.status = 'ACTIVE') = 1
  AND (SELECT count(*) FROM "BrandMembership" m JOIN "User" u ON u.id = m."userId" JOIN "Brand" mb ON mb.id = m."brandId" WHERE u.email = 'dagnymotor@gmail.com' AND mb.slug = 'melbourne-cfo' AND m.role = 'OWNER' AND m.status = 'INVITED') = 1
  AND (SELECT count(*) FROM "BrandMembership" m JOIN "User" u ON u.id = m."userId" JOIN "Brand" mb ON mb.id = m."brandId" WHERE u.email = 'thomas@bookkeepingconroe.test' AND mb.slug = 'bookkeeping-conroe' AND m.role = 'OWNER' AND m.status = 'INVITED') = 1
  AND (SELECT count(*) FROM "User" WHERE email = 'platform-owner@southwestdigital.test' AND "platformRole" = 'OWNER' AND status = 'INVITED') = 1
  AND (SELECT count(*) FROM "BrandMembership" m JOIN "User" u ON u.id = m."userId" JOIN "Brand" mb ON mb.id = m."brandId" WHERE u.email = 'platform-owner@southwestdigital.test' AND mb.slug = 'southwest-digital-marketing' AND m.role = 'OWNER' AND m.status = 'INVITED') = 1
  AND (SELECT count(*) FROM "BrandIntegration" i JOIN "Brand" ib ON ib.id = i."brandId" WHERE ib.slug IN ('southwest-digital-marketing', 'melbourne-cfo') AND i.provider = 'GTM' AND i."assetOwner" = 'SOUTHWEST_DIGITAL' AND i.status = 'PENDING' AND i."secretCiphertext" IS NULL) = 2
  AND (SELECT count(*) FROM "BrandIntegration" i JOIN "Brand" ib ON ib.id = i."brandId" WHERE ib.slug = 'contigo-accounting' AND i.provider = 'GTM' AND i."assetOwner" = 'SOUTHWEST_DIGITAL' AND i.status = 'ACTIVE' AND i."lastVerifiedAt" IS NOT NULL AND i."secretCiphertext" IS NULL) = 1;
'@
  $taskSeedRowCount = (($taskSeedQuery | & docker.exe exec -i $taskContainer psql -U postgres -d southwestdigital -tA) -join "").Trim()
  if ($taskSeedRowCount -ne "4") {
    throw "Initial brand seed did not produce the expected idempotent draft state"
  }

  $env:ALLOW_INITIAL_BRAND_SEED = "false"
  $taskPreviousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  & node.exe scripts/seed-initial-brands.mjs *> $null
  $taskSafetyExitCode = $LASTEXITCODE
  $ErrorActionPreference = $taskPreviousErrorActionPreference
  $env:ALLOW_INITIAL_BRAND_SEED = "true"
  if ($taskSafetyExitCode -eq 0) {
    throw "Initial brand seed safety interlock did not refuse an unapproved run"
  }

  Write-Output "Verified four idempotent brands, preservation of active lifecycle state, pending unverified hostnames, initial owners, themes, Southwest-owned GTM inventory, and the seed safety interlock."
}
finally {
  if ($taskContainerStarted) {
    & docker.exe stop $taskContainer *> $null
  }
}
