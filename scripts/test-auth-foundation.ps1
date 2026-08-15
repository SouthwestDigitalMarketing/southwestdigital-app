$ErrorActionPreference = "Stop"

$taskContainer = "southwestdigital-app-auth-test"
$taskContainerStarted = $false
$taskServer = $null
$taskAppPort = 3471
$taskLogOut = Join-Path $env:TEMP "southwestdigital-app-auth-test.out.log"
$taskLogErr = Join-Path $env:TEMP "southwestdigital-app-auth-test.err.log"

try {
  $taskExisting = & docker.exe ps -a --filter "name=^$taskContainer$" --format "{{.Names}}"
  if ($taskExisting) {
    throw "Refusing to replace existing container $taskContainer"
  }
  if (Get-NetTCPConnection -LocalPort $taskAppPort -State Listen -ErrorAction SilentlyContinue) {
    throw "Local port $taskAppPort is already in use"
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
  $env:AUTH_SECRET = "disposable-auth-test-secret"
  $env:PLATFORM_BASE_URL = "http://localhost:$taskAppPort"
  Remove-Item Env:DEV_BRAND_HOST -ErrorAction SilentlyContinue
  Remove-Item Env:AUTH_GOOGLE_ID -ErrorAction SilentlyContinue
  Remove-Item Env:AUTH_GOOGLE_SECRET -ErrorAction SilentlyContinue
  Remove-Item Env:AUTH_RESEND_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:AUTH_EMAIL_FROM -ErrorAction SilentlyContinue

  & npx.cmd prisma migrate deploy *> $null
  if ($LASTEXITCODE -ne 0) { throw "Migration deploy failed" }

  @'
\set ON_ERROR_STOP on
INSERT INTO "User" (id, name, email, status, "platformRole", "createdAt", "updatedAt")
VALUES
  ('dagny', 'Dagny', 'dagny@example.test', 'ACTIVE', 'NONE', now(), now()),
  ('viewer', 'Read Only Viewer', 'viewer@example.test', 'ACTIVE', 'NONE', now(), now()),
  ('platform-owner', 'Southwest Owner', 'owner@southwestdigital.test', 'ACTIVE', 'OWNER', now(), now()),
  ('bookkeeping-owner', 'Bookkeeping Owner', 'owner@bookkeeping.test', 'ACTIVE', 'NONE', now(), now());

INSERT INTO "Brand" (id, slug, name, status, "createdAt", "updatedAt") VALUES
  ('contigo', 'contigo-accounting', 'Contigo Accounting', 'ACTIVE', now(), now()),
  ('melbourne', 'melbourne-cfo', 'Melbourne CFO', 'ACTIVE', now(), now()),
  ('bookkeeping', 'bookkeeping-conroe', 'Bookkeeping Conroe', 'ACTIVE', now(), now());

INSERT INTO "BrandTheme" (id, "brandId", "primaryColor", "accentColor", "backgroundColor", "foregroundColor", "createdAt", "updatedAt") VALUES
  ('theme-contigo', 'contigo', '#123456', '#abcdef', '#f7f8fa', '#17202a', now(), now()),
  ('theme-melbourne', 'melbourne', '#243b5a', '#d59a35', '#f7f8fa', '#17202a', now(), now());

INSERT INTO "BrandDomain" (id, "brandId", hostname, purpose, status, "isPrimary", "verifiedAt", "createdAt", "updatedAt") VALUES
  ('domain-contigo', 'contigo', 'app.contigoaccounting.com', 'APP', 'VERIFIED', true, now(), now(), now()),
  ('domain-melbourne', 'melbourne', 'app.melbournecfo.com.au', 'APP', 'VERIFIED', true, now(), now(), now()),
  ('domain-bookkeeping', 'bookkeeping', 'app.bookkeepingconroe.com', 'APP', 'VERIFIED', true, now(), now(), now()),
  ('domain-disabled', 'contigo', 'disabled.contigo.example', 'APP', 'DISABLED', false, null, now(), now());

INSERT INTO "BrandMembership" (id, "brandId", "userId", role, status, "createdAt", "updatedAt") VALUES
  ('member-contigo', 'contigo', 'dagny', 'OWNER', 'ACTIVE', now(), now()),
  ('member-melbourne', 'melbourne', 'dagny', 'OWNER', 'ACTIVE', now(), now()),
  ('viewer-contigo', 'contigo', 'viewer', 'VIEWER', 'ACTIVE', now(), now()),
  ('member-bookkeeping', 'bookkeeping', 'bookkeeping-owner', 'OWNER', 'ACTIVE', now(), now());

INSERT INTO "Session" (id, "sessionToken", "userId", expires)
VALUES
  ('session-1', 'test-session-token', 'dagny', now() + interval '1 day'),
  ('session-viewer', 'test-viewer-session-token', 'viewer', now() + interval '1 day'),
  ('session-platform', 'test-platform-session-token', 'platform-owner', now() + interval '1 day');

INSERT INTO "Contact" (id, "brandId", "displayName", status, "marketingConsent", "createdAt", "updatedAt") VALUES
  ('contigo-contact', 'contigo', 'Contigo Only Contact', 'ACTIVE', 'UNKNOWN', now(), now()),
  ('melbourne-contact', 'melbourne', 'Melbourne Only Contact', 'ACTIVE', 'UNKNOWN', now(), now());

INSERT INTO "Lead" (id, "brandId", name, status, "createdAt", "updatedAt") VALUES
  ('contigo-lead', 'contigo', 'Contigo Only Lead', 'NEW', now(), now()),
  ('melbourne-lead', 'melbourne', 'Melbourne Only Lead', 'NEW', now(), now());

INSERT INTO "CustomerAccount" (id, "brandId", code, name, status, "createdAt", "updatedAt") VALUES
  ('contigo-customer', 'contigo', 'CON-001', 'Contigo Only Customer', 'ACTIVE', now(), now()),
  ('melbourne-customer', 'melbourne', 'MEL-001', 'Melbourne Only Customer', 'ACTIVE', now(), now());
'@ | & docker.exe exec -i $taskContainer psql -U postgres -d southwestdigital *> $null
  if ($LASTEXITCODE -ne 0) { throw "Seed failed" }

  & npm.cmd run build *> $null
  if ($LASTEXITCODE -ne 0) { throw "Application build failed" }

  Remove-Item -LiteralPath $taskLogOut, $taskLogErr -ErrorAction SilentlyContinue
  $taskServer = Start-Process -FilePath node.exe `
    -ArgumentList @("node_modules/next/dist/bin/next", "start", "-p", $taskAppPort) `
    -WorkingDirectory (Get-Location).Path `
    -RedirectStandardOutput $taskLogOut `
    -RedirectStandardError $taskLogErr `
    -WindowStyle Hidden `
    -PassThru

  $taskAppReady = $false
  for ($taskAttempt = 0; $taskAttempt -lt 60; $taskAttempt++) {
    $taskStatus = & curl.exe -s -o NUL -w "%{http_code}" `
      -H "Host: app.contigoaccounting.com" `
      "http://127.0.0.1:$taskAppPort/login"
    if ($taskStatus -eq "200") {
      $taskAppReady = $true
      break
    }
    Start-Sleep -Seconds 1
  }
  if (-not $taskAppReady) {
    throw "Next.js did not become ready: $(Get-Content $taskLogErr -Raw -ErrorAction SilentlyContinue)"
  }

  $taskMelbourneLogin = (& curl.exe -s -H "Host: app.melbournecfo.com.au" `
    "http://127.0.0.1:$taskAppPort/login") -join "`n"
  if ($taskMelbourneLogin -notmatch "Melbourne CFO") {
    throw "Melbourne-branded login did not resolve"
  }

  $taskUnknown = (& curl.exe -s -H "Host: unknown.example" `
    "http://127.0.0.1:$taskAppPort/login") -join "`n"
  if ($taskUnknown -notmatch "Portal not configured") {
    throw "Unknown hostname was not rejected"
  }

  $taskUnknownAuthStatus = & curl.exe -s -o NUL -w "%{http_code}" `
    -H "Host: unknown.example" `
    "http://127.0.0.1:$taskAppPort/api/auth/providers"
  if ($taskUnknownAuthStatus -ne "404") {
    throw "Unknown hostname reached Auth.js with HTTP $taskUnknownAuthStatus"
  }

  $taskUnknownAuthPostStatus = & curl.exe -s -o NUL -w "%{http_code}" -X POST `
    -H "Host: unknown.example" `
    "http://127.0.0.1:$taskAppPort/api/auth/signout"
  if ($taskUnknownAuthPostStatus -ne "404") {
    throw "Unknown hostname reached Auth.js POST with HTTP $taskUnknownAuthPostStatus"
  }

  foreach ($taskPath in @("/portal", "/portal/contacts", "/select-brand")) {
    $taskUntrustedPortalStatus = & curl.exe -s -o NUL -w "%{http_code}" `
      -H "Host: disabled.contigo.example" `
      -H "Cookie: swd-authjs.session-token=test-session-token; swd-active-brand=contigo" `
      "http://127.0.0.1:$taskAppPort$taskPath"
    if ($taskUntrustedPortalStatus -ne "404") {
      throw "Disabled hostname served $taskPath with HTTP $taskUntrustedPortalStatus"
    }
  }

  $taskDisabledAuthStatus = & curl.exe -s -o NUL -w "%{http_code}" `
    -H "Host: disabled.contigo.example" `
    "http://127.0.0.1:$taskAppPort/api/auth/providers"
  if ($taskDisabledAuthStatus -ne "404") {
    throw "Disabled hostname reached Auth.js with HTTP $taskDisabledAuthStatus"
  }

  $taskBrandAuthStatus = & curl.exe -s -o NUL -w "%{http_code}" `
    -H "Host: app.contigoaccounting.com" `
    "http://127.0.0.1:$taskAppPort/api/auth/providers"
  if ($taskBrandAuthStatus -ne "200") {
    throw "Verified brand hostname could not reach Auth.js"
  }

  $taskComplete = (& curl.exe -s -i `
    -H "Host: app.contigoaccounting.com" `
    -H "Cookie: swd-authjs.session-token=test-session-token" `
    "http://127.0.0.1:$taskAppPort/auth/complete") -join "`n"
  if ($taskComplete -notmatch "swd-active-brand=contigo") {
    throw "Entry hostname did not establish Contigo as active"
  }
  if ($taskComplete -notmatch "location: http://app\.contigoaccounting\.com/portal") {
    throw "Auth completion did not retain the verified entry hostname"
  }

  @'
UPDATE "BrandDomain"
SET status = 'DISABLED', "verifiedAt" = null, "updatedAt" = now()
WHERE id = 'domain-contigo';
'@ | & docker.exe exec -i $taskContainer psql -U postgres -d southwestdigital *> $null
  $taskRevokedPortalStatus = & curl.exe -s -o NUL -w "%{http_code}" `
    -H "Host: app.contigoaccounting.com" `
    -H "Cookie: swd-authjs.session-token=test-session-token; swd-active-brand=contigo" `
    "http://127.0.0.1:$taskAppPort/portal/contacts"
  if ($taskRevokedPortalStatus -ne "404") {
    throw "A dynamically disabled hostname retained portal access with HTTP $taskRevokedPortalStatus"
  }
  @'
UPDATE "BrandDomain"
SET status = 'VERIFIED', "verifiedAt" = now(), "updatedAt" = now()
WHERE id = 'domain-contigo';
'@ | & docker.exe exec -i $taskContainer psql -U postgres -d southwestdigital *> $null

  $taskPlatformComplete = (& curl.exe -s -i `
    -H "Host: localhost:$taskAppPort" `
    -H "Cookie: swd-authjs.session-token=test-platform-session-token" `
    "http://127.0.0.1:$taskAppPort/auth/complete") -join "`n"
  if ($taskPlatformComplete -notmatch "location: http://localhost:$taskAppPort/platform/brands") {
    throw "Platform owner did not land in platform administration"
  }

  $taskBrandUserPlatformComplete = (& curl.exe -s -i `
    -H "Host: localhost:$taskAppPort" `
    -H "Cookie: swd-authjs.session-token=test-session-token" `
    "http://127.0.0.1:$taskAppPort/auth/complete") -join "`n"
  if ($taskBrandUserPlatformComplete -notmatch "location: http://localhost:$taskAppPort/access-denied") {
    throw "A brand-only user was allowed to enter through the platform hostname"
  }

  $taskAccessDenied = (& curl.exe -s -i `
    -H "Host: localhost:$taskAppPort" `
    -H "Cookie: swd-authjs.session-token=test-session-token" `
    "http://127.0.0.1:$taskAppPort/access-denied") -join "`n"
  if ($taskAccessDenied -notmatch "HTTP/1.1 200" -or $taskAccessDenied -notmatch "Access denied") {
    throw "Platform denial page did not terminate the brand-only user journey"
  }

  $taskPlatformBrands = (& curl.exe -s `
    -H "Host: localhost:$taskAppPort" `
    -H "Cookie: swd-authjs.session-token=test-platform-session-token" `
    "http://127.0.0.1:$taskAppPort/platform/brands") -join "`n"
  if ($taskPlatformBrands -notmatch "Platform administration" -or $taskPlatformBrands -notmatch "Melbourne CFO") {
    throw "Platform brand administration did not render for the platform owner"
  }

  $taskPlatformOnBrandStatus = & curl.exe -s -o NUL -w "%{http_code}" `
    -H "Host: app.contigoaccounting.com" `
    -H "Cookie: swd-authjs.session-token=test-platform-session-token" `
    "http://127.0.0.1:$taskAppPort/platform/brands"
  if ($taskPlatformOnBrandStatus -ne "404") {
    throw "Platform administration rendered on a brand hostname with HTTP $taskPlatformOnBrandStatus"
  }

  $taskNonAdminPlatform = (& curl.exe -s -i `
    -H "Host: localhost:$taskAppPort" `
    -H "Cookie: swd-authjs.session-token=test-session-token" `
    "http://127.0.0.1:$taskAppPort/platform/brands") -join "`n"
  if ($taskNonAdminPlatform -notmatch "location: /access-denied") {
    throw "A brand-only user was not rejected from platform administration"
  }

  $taskUnauthenticatedRsc = (& curl.exe -s -i `
    -H "Host: localhost:$taskAppPort" `
    -H "RSC: 1" `
    "http://127.0.0.1:$taskAppPort/platform/brands") -join "`n"
  if ($taskUnauthenticatedRsc -match "Melbourne CFO" -or $taskUnauthenticatedRsc -match "Contigo Accounting") {
    throw "Unauthenticated RSC request exposed platform brand inventory"
  }

  $taskNewBrandPage = (& curl.exe -s `
    -H "Host: localhost:$taskAppPort" `
    -H "Cookie: swd-authjs.session-token=test-platform-session-token" `
    "http://127.0.0.1:$taskAppPort/platform/brands/new") -join "`n"
  $taskActionMatch = [regex]::Match(
    $taskNewBrandPage,
    '<form class="mt-8 space-y-8"[^>]*><input type="hidden" name="(\$ACTION_ID_[^"]+)"',
    [System.Text.RegularExpressions.RegexOptions]::Singleline
  )
  if (-not $taskActionMatch.Success) {
    throw "Could not find the progressively enhanced onboarding action"
  }
  $taskActionField = $taskActionMatch.Groups[1].Value
  $taskOperatorHostnameStatus = & curl.exe -s -o NUL -w "%{http_code}" -X POST `
    -H "Host: localhost:$taskAppPort" `
    -H "Origin: http://localhost:$taskAppPort" `
    -H "Cookie: swd-authjs.session-token=test-platform-session-token" `
    -F "$taskActionField=" `
    -F "name=Forbidden Operator Host Brand" `
    -F "legalName=" `
    -F "slug=forbidden-operator-host" `
    -F "appHostname=localhost" `
    -F "ownerName=Forbidden Owner" `
    -F "ownerEmail=forbidden@example.test" `
    -F "logoUrl=" `
    -F "supportEmail=" `
    -F "primaryColor=#17324d" `
    -F "accentColor=#d79b3b" `
    -F "backgroundColor=#f7f8fa" `
    -F "foregroundColor=#17202a" `
    "http://127.0.0.1:$taskAppPort/platform/brands/new"
  if ([int]$taskOperatorHostnameStatus -lt 400) {
    throw "Platform hostname was accepted during brand onboarding"
  }
  $taskOperatorBrandCount = (("SELECT count(*) FROM `"Brand`" WHERE slug = 'forbidden-operator-host';" | & docker.exe exec -i $taskContainer psql -U postgres -d southwestdigital -tA) -join "").Trim()
  if ($taskOperatorBrandCount -ne "0") {
    throw "Rejected platform-host onboarding still created a brand"
  }

  $taskOnboardingResponse = (& curl.exe -s -i -X POST `
    -H "Host: localhost:$taskAppPort" `
    -H "Origin: http://localhost:$taskAppPort" `
    -H "Cookie: swd-authjs.session-token=test-platform-session-token" `
    -F "$taskActionField=" `
    -F "name=Harness Test Brand" `
    -F "legalName=Harness Test Brand LLC" `
    -F "slug=harness-test-brand" `
    -F "appHostname=app.harness-test.example" `
    -F "ownerName=Harness Owner" `
    -F "ownerEmail=owner@harness-test.example" `
    -F "logoUrl=" `
    -F "supportEmail=support@harness-test.example" `
    -F "primaryColor=#17324d" `
    -F "accentColor=#d79b3b" `
    -F "backgroundColor=#f7f8fa" `
    -F "foregroundColor=#17202a" `
    "http://127.0.0.1:$taskAppPort/platform/brands/new") -join "`n"
  if ($taskOnboardingResponse -notmatch "location: /platform/brands/") {
    throw "Platform onboarding action did not redirect to the created brand: $taskOnboardingResponse"
  }
  $taskCreatedBrandPathMatch = [regex]::Match(
    $taskOnboardingResponse,
    '(?:location|x-action-redirect):\s*(/platform/brands/[^;\r\n]+)',
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
  )
  if (-not $taskCreatedBrandPathMatch.Success) {
    throw "Could not determine the created brand administration path"
  }
  $taskCreatedBrandPath = $taskCreatedBrandPathMatch.Groups[1].Value.Trim()
  $taskCreatedBrandId = ($taskCreatedBrandPath -split '/')[-1]

  $taskCreatedBrandPage = (& curl.exe -s `
    -H "Host: localhost:$taskAppPort" `
    -H "Cookie: swd-authjs.session-token=test-platform-session-token" `
    "http://127.0.0.1:$taskAppPort$taskCreatedBrandPath") -join "`n"
  $taskDomainActionMatch = [regex]::Match(
    $taskCreatedBrandPage,
    '<form[^>]*data-harness="domain-form"[^>]*><input type="hidden" name="(\$ACTION_ID_[^"]+)"',
    [System.Text.RegularExpressions.RegexOptions]::Singleline
  )
  if (-not $taskDomainActionMatch.Success) {
    throw "Could not find the pending-domain action"
  }
  $taskDomainActionField = $taskDomainActionMatch.Groups[1].Value
  $taskOperatorDomainStatus = & curl.exe -s -o NUL -w "%{http_code}" -X POST `
    -H "Host: localhost:$taskAppPort" `
    -H "Origin: http://localhost:$taskAppPort" `
    -H "Cookie: swd-authjs.session-token=test-platform-session-token" `
    -F "$taskDomainActionField=" `
    -F "brandId=$taskCreatedBrandId" `
    -F "hostname=localhost" `
    -F "purpose=APP" `
    "http://127.0.0.1:$taskAppPort$taskCreatedBrandPath"
  if ([int]$taskOperatorDomainStatus -lt 400) {
    throw "Platform hostname was accepted as an added brand domain"
  }
  $taskIntegrationActionMatch = [regex]::Match(
    $taskCreatedBrandPage,
    '<form[^>]*data-harness="integration-form"[^>]*><input type="hidden" name="(\$ACTION_ID_[^"]+)"',
    [System.Text.RegularExpressions.RegexOptions]::Singleline
  )
  if (-not $taskIntegrationActionMatch.Success) {
    throw "Could not find the progressively enhanced integration action"
  }
  $taskIntegrationActionField = $taskIntegrationActionMatch.Groups[1].Value
  $taskIntegrationStatus = & curl.exe -s -o NUL -w "%{http_code}" -X POST `
    -H "Host: localhost:$taskAppPort" `
    -H "Origin: http://localhost:$taskAppPort" `
    -H "Cookie: swd-authjs.session-token=test-platform-session-token" `
    -F "$taskIntegrationActionField=" `
    -F "brandId=$taskCreatedBrandId" `
    -F "key=meta-pixel" `
    -F "provider=META_ADS" `
    -F "assetOwner=BRAND" `
    -F "displayName=Harness Meta Pixel" `
    -F "externalAccountId=meta-business-harness" `
    -F "externalPropertyId=meta-dataset-harness" `
    -F "publicIdentifier=123456789012345" `
    -F "notes=Brand owns asset; Southwest has delegated access" `
    "http://127.0.0.1:$taskAppPort$taskCreatedBrandPath"
  if ([int]$taskIntegrationStatus -ge 400) {
    throw "Platform integration action failed with HTTP $taskIntegrationStatus"
  }

  $taskOnboardingQuery = @'
SELECT count(*)
FROM "Brand" b
JOIN "BrandTheme" t ON t."brandId" = b.id
JOIN "BrandDomain" d ON d."brandId" = b.id
JOIN "BrandMembership" m ON m."brandId" = b.id
JOIN "User" u ON u.id = m."userId"
JOIN "AuditEvent" a ON a."brandId" = b.id
WHERE b.slug = 'harness-test-brand'
  AND b.status = 'DRAFT'
  AND d.hostname = 'app.harness-test.example'
  AND d.status = 'PENDING'
  AND m.role = 'OWNER'
  AND m.status = 'INVITED'
  AND u.email = 'owner@harness-test.example'
  AND a.action = 'brand.onboarding.created';
'@
  $taskOnboardingRowCount = (($taskOnboardingQuery | & docker.exe exec -i $taskContainer psql -U postgres -d southwestdigital -tA) -join "").Trim()
  if ($taskOnboardingRowCount -ne "1") {
    throw "Brand onboarding transaction did not create the expected isolated records"
  }

  $taskIntegrationQuery = @'
SELECT count(*)
FROM "Brand" b
JOIN "BrandIntegration" i ON i."brandId" = b.id
JOIN "AuditEvent" a ON a."brandId" = b.id AND a."resourceId" = i.id
WHERE b.slug = 'harness-test-brand'
  AND i.key = 'meta-pixel'
  AND i.provider = 'META_ADS'
  AND i."assetOwner" = 'BRAND'
  AND i.status = 'PENDING'
  AND i."publicIdentifier" = '123456789012345'
  AND i."secretCiphertext" IS NULL
  AND a.action = 'brand.integration.created';
'@
  $taskIntegrationRowCount = (($taskIntegrationQuery | & docker.exe exec -i $taskContainer psql -U postgres -d southwestdigital -tA) -join "").Trim()
  if ($taskIntegrationRowCount -ne "1") {
    throw "Integration governance action did not persist pending public metadata without secrets"
  }

  $taskMelbourneAdminPage = (& curl.exe -s `
    -H "Host: localhost:$taskAppPort" `
    -H "Cookie: swd-authjs.session-token=test-platform-session-token" `
    "http://127.0.0.1:$taskAppPort/platform/brands/melbourne") -join "`n"
  $taskExportActionMatch = [regex]::Match(
    $taskMelbourneAdminPage,
    '<form[^>]*data-harness="data-export-form"[^>]*><input type="hidden" name="(\$ACTION_ID_[^"]+)"',
    [System.Text.RegularExpressions.RegexOptions]::Singleline
  )
  $taskOffboardingActionMatch = [regex]::Match(
    $taskMelbourneAdminPage,
    '<form[^>]*data-harness="offboarding-plan-form"[^>]*><input type="hidden" name="(\$ACTION_ID_[^"]+)"',
    [System.Text.RegularExpressions.RegexOptions]::Singleline
  )
  if (-not $taskExportActionMatch.Success -or -not $taskOffboardingActionMatch.Success) {
    throw "Could not find export and offboarding actions"
  }

  $taskExportActionField = $taskExportActionMatch.Groups[1].Value
  for ($taskExportAttempt = 0; $taskExportAttempt -lt 2; $taskExportAttempt++) {
    $taskExportStatus = & curl.exe -s -o NUL -w "%{http_code}" -X POST `
      -H "Host: localhost:$taskAppPort" `
      -H "Origin: http://localhost:$taskAppPort" `
      -H "Cookie: swd-authjs.session-token=test-platform-session-token" `
      -F "$taskExportActionField=" `
      -F "brandId=melbourne" `
      -F "scopes=BRAND_CONFIGURATION" `
      -F "scopes=CRM" `
      -F "scopes=INTEGRATION_METADATA" `
      -F "scopes=AUDIT_HISTORY" `
      "http://127.0.0.1:$taskAppPort/platform/brands/melbourne"
    if ([int]$taskExportStatus -ge 400) {
      throw "Brand export request failed with HTTP $taskExportStatus"
    }
  }

  $taskOffboardingActionField = $taskOffboardingActionMatch.Groups[1].Value
  $taskOffboardingStatus = & curl.exe -s -o NUL -w "%{http_code}" -X POST `
    -H "Host: localhost:$taskAppPort" `
    -H "Origin: http://localhost:$taskAppPort" `
    -H "Cookie: swd-authjs.session-token=test-platform-session-token" `
    -F "$taskOffboardingActionField=" `
    -F "brandId=melbourne" `
    -F "serviceEndsAt=2030-09-01T17:00:00+10:00" `
    -F "accessEndsAt=2030-09-02T17:00:00+10:00" `
    -F "retentionEndsAt=2030-12-01T17:00:00+11:00" `
    -F "reason=Disposable future-dated plan" `
    -F "confirmSlug=melbourne-cfo" `
    "http://127.0.0.1:$taskAppPort/platform/brands/melbourne"
  if ([int]$taskOffboardingStatus -ge 400) {
    throw "Brand offboarding scheduling failed with HTTP $taskOffboardingStatus"
  }

  $taskOffboardingQuery = @'
SELECT count(*)
FROM "Brand" b
JOIN "BrandOffboardingPlan" p ON p."brandId" = b.id
JOIN "BrandMembership" m ON m."brandId" = b.id AND m."userId" = 'dagny'
JOIN "BrandDataExport" e ON e."brandId" = b.id
WHERE b.id = 'melbourne'
  AND b.status = 'ACTIVE'
  AND m.status = 'ACTIVE'
  AND p.status = 'PLANNED'
  AND p."accessEndsAt" > now()
  AND e.status = 'REQUESTED'
  AND array_length(e."requestedScopes", 1) = 4
  AND (SELECT count(*) FROM "BrandDataExport" WHERE "brandId" = b.id AND status IN ('REQUESTED', 'PROCESSING')) = 1
  AND EXISTS (SELECT 1 FROM "AuditEvent" WHERE "brandId" = b.id AND action = 'brand.data_export.requested')
  AND EXISTS (SELECT 1 FROM "AuditEvent" WHERE "brandId" = b.id AND action = 'brand.offboarding.scheduled');
'@
  $taskOffboardingRowCount = (($taskOffboardingQuery | & docker.exe exec -i $taskContainer psql -U postgres -d southwestdigital -tA) -join "").Trim()
  if ($taskOffboardingRowCount -ne "1") {
    throw "Future offboarding schedule or deduplicated export job did not preserve current access"
  }

  $taskPastOffboardingStatus = & curl.exe -s -o NUL -w "%{http_code}" -X POST `
    -H "Host: localhost:$taskAppPort" `
    -H "Origin: http://localhost:$taskAppPort" `
    -H "Cookie: swd-authjs.session-token=test-platform-session-token" `
    -F "$taskOffboardingActionField=" `
    -F "brandId=bookkeeping" `
    -F "serviceEndsAt=2025-01-01T17:00:00-06:00" `
    -F "accessEndsAt=2025-01-02T17:00:00-06:00" `
    -F "retentionEndsAt=2025-04-01T17:00:00-05:00" `
    -F "reason=Disposable due offboarding plan" `
    -F "confirmSlug=bookkeeping-conroe" `
    "http://127.0.0.1:$taskAppPort/platform/brands/bookkeeping"
  if ([int]$taskPastOffboardingStatus -ge 400) {
    throw "Due offboarding scheduling failed with HTTP $taskPastOffboardingStatus"
  }

  $taskBookkeepingAdminPage = (& curl.exe -s `
    -H "Host: localhost:$taskAppPort" `
    -H "Cookie: swd-authjs.session-token=test-platform-session-token" `
    "http://127.0.0.1:$taskAppPort/platform/brands/bookkeeping") -join "`n"
  $taskBeginOffboardingMatch = [regex]::Match(
    $taskBookkeepingAdminPage,
    '<form[^>]*data-harness="begin-offboarding-form"[^>]*>.*?<input type="hidden" name="(\$ACTION_ID_[^"]+)".*?<input type="hidden" name="planId" value="([^"]+)"',
    [System.Text.RegularExpressions.RegexOptions]::Singleline
  )
  if (-not $taskBeginOffboardingMatch.Success) {
    throw "Could not find due offboarding transition action"
  }
  $taskBeginOffboardingActionField = $taskBeginOffboardingMatch.Groups[1].Value
  $taskBookkeepingPlanId = $taskBeginOffboardingMatch.Groups[2].Value
  $taskBeginOffboardingStatus = & curl.exe -s -o NUL -w "%{http_code}" -X POST `
    -H "Host: localhost:$taskAppPort" `
    -H "Origin: http://localhost:$taskAppPort" `
    -H "Cookie: swd-authjs.session-token=test-platform-session-token" `
    -F "$taskBeginOffboardingActionField=" `
    -F "brandId=bookkeeping" `
    -F "planId=$taskBookkeepingPlanId" `
    -F "confirmSlug=bookkeeping-conroe" `
    "http://127.0.0.1:$taskAppPort/platform/brands/bookkeeping"
  if ([int]$taskBeginOffboardingStatus -ge 400) {
    throw "Due offboarding transition failed with HTTP $taskBeginOffboardingStatus"
  }

  $taskBeganOffboardingQuery = @'
SELECT count(*)
FROM "Brand" b
JOIN "BrandOffboardingPlan" p ON p."brandId" = b.id
JOIN "BrandMembership" m ON m."brandId" = b.id
JOIN "BrandDataExport" e ON e."brandId" = b.id AND e."offboardingPlanId" = p.id
WHERE b.id = 'bookkeeping'
  AND b.status = 'OFFBOARDING'
  AND p.status = 'IN_PROGRESS'
  AND p."startedAt" IS NOT NULL
  AND m."userId" = 'bookkeeping-owner'
  AND m.status = 'SUSPENDED'
  AND EXISTS (
    SELECT 1 FROM "BrandDomain" d
    WHERE d."brandId" = b.id AND d.purpose = 'APP' AND d.status = 'DISABLED' AND d."verifiedAt" IS NULL
  )
  AND e.status = 'REQUESTED'
  AND EXISTS (SELECT 1 FROM "AuditEvent" WHERE "brandId" = b.id AND action = 'brand.offboarding.started')
  AND EXISTS (SELECT 1 FROM "BrandMembership" WHERE "brandId" = 'contigo' AND "userId" = 'dagny' AND status = 'ACTIVE')
  AND EXISTS (SELECT 1 FROM "BrandMembership" WHERE "brandId" = 'melbourne' AND "userId" = 'dagny' AND status = 'ACTIVE');
'@
  $taskBeganOffboardingRowCount = (($taskBeganOffboardingQuery | & docker.exe exec -i $taskContainer psql -U postgres -d southwestdigital -tA) -join "").Trim()
  if ($taskBeganOffboardingRowCount -ne "1") {
    throw "Due offboarding transition did not isolate access revocation and create its export"
  }

  $taskSwitchedPortal = (& curl.exe -s `
    -H "Host: app.contigoaccounting.com" `
    -H "Cookie: swd-authjs.session-token=test-session-token; swd-active-brand=melbourne" `
    "http://127.0.0.1:$taskAppPort/portal") -join "`n"
  if ($taskSwitchedPortal -notmatch "Melbourne CFO") {
    throw "Authorized brand switch was not retained"
  }

  $taskTamperedPortal = (& curl.exe -s `
    -H "Host: app.contigoaccounting.com" `
    -H "Cookie: swd-authjs.session-token=test-session-token; swd-active-brand=bookkeeping" `
    "http://127.0.0.1:$taskAppPort/portal") -join "`n"
  if ($taskTamperedPortal -notmatch "Contigo Accounting") {
    throw "Unauthorized active-brand cookie was not rejected"
  }

  $taskContigoContacts = (& curl.exe -s `
    -H "Host: app.contigoaccounting.com" `
    -H "Cookie: swd-authjs.session-token=test-session-token; swd-active-brand=contigo" `
    "http://127.0.0.1:$taskAppPort/portal/contacts") -join "`n"
  if ($taskContigoContacts -notmatch "Contigo Only Contact" -or $taskContigoContacts -match "Melbourne Only Contact") {
    throw "Contact page did not preserve brand isolation"
  }

  $taskMelbourneLeads = (& curl.exe -s `
    -H "Host: app.contigoaccounting.com" `
    -H "Cookie: swd-authjs.session-token=test-session-token; swd-active-brand=melbourne" `
    "http://127.0.0.1:$taskAppPort/portal/leads") -join "`n"
  if ($taskMelbourneLeads -notmatch "Melbourne Only Lead" -or $taskMelbourneLeads -match "Contigo Only Lead") {
    throw "Lead page did not preserve brand isolation"
  }

  $taskContigoCustomers = (& curl.exe -s `
    -H "Host: app.contigoaccounting.com" `
    -H "Cookie: swd-authjs.session-token=test-session-token; swd-active-brand=contigo" `
    "http://127.0.0.1:$taskAppPort/portal/customers") -join "`n"
  if ($taskContigoCustomers -notmatch "Contigo Only Customer" -or $taskContigoCustomers -match "Melbourne Only Customer") {
    throw "Customer page did not preserve brand isolation"
  }

  $taskContigoLeads = (& curl.exe -s `
    -H "Host: app.contigoaccounting.com" `
    -H "Cookie: swd-authjs.session-token=test-session-token; swd-active-brand=contigo" `
    "http://127.0.0.1:$taskAppPort/portal/leads") -join "`n"

  $taskViewerContacts = (& curl.exe -s `
    -H "Host: app.contigoaccounting.com" `
    -H "Cookie: swd-authjs.session-token=test-viewer-session-token; swd-active-brand=contigo" `
    "http://127.0.0.1:$taskAppPort/portal/contacts") -join "`n"
  if ($taskViewerContacts -notmatch "Contigo Only Contact" -or $taskViewerContacts -notmatch "viewer access is read-only" -or $taskViewerContacts -match 'data-harness="create-contact-form"') {
    throw "VIEWER did not receive read-only contact access"
  }

  $taskContactActionMatch = [regex]::Match(
    $taskContigoContacts,
    '<form[^>]*data-harness="create-contact-form"[^>]*><input type="hidden" name="(\$ACTION_ID_[^"]+)"',
    [System.Text.RegularExpressions.RegexOptions]::Singleline
  )
  $taskCustomerActionMatch = [regex]::Match(
    $taskContigoCustomers,
    '<form[^>]*data-harness="create-customer-form"[^>]*><input type="hidden" name="(\$ACTION_ID_[^"]+)"',
    [System.Text.RegularExpressions.RegexOptions]::Singleline
  )
  $taskLeadActionMatch = [regex]::Match(
    $taskContigoLeads,
    '<form[^>]*data-harness="create-lead-form"[^>]*><input type="hidden" name="(\$ACTION_ID_[^"]+)"',
    [System.Text.RegularExpressions.RegexOptions]::Singleline
  )
  if (-not $taskContactActionMatch.Success -or -not $taskCustomerActionMatch.Success -or -not $taskLeadActionMatch.Success) {
    throw "Could not capture the CRM Server Action identifiers"
  }
  $taskContactActionField = $taskContactActionMatch.Groups[1].Value
  $taskCustomerActionField = $taskCustomerActionMatch.Groups[1].Value
  $taskLeadActionField = $taskLeadActionMatch.Groups[1].Value

  foreach ($taskSessionToken in @("test-viewer-session-token", "test-session-token")) {
    $taskContactWriteStatus = & curl.exe -s -o NUL -w "%{http_code}" -X POST `
      -H "Host: app.contigoaccounting.com" `
      -H "Origin: http://app.contigoaccounting.com" `
      -H "Cookie: swd-authjs.session-token=$taskSessionToken; swd-active-brand=contigo" `
      -F "$taskContactActionField=" `
      -F "displayName=CRM role boundary contact" `
      -F "firstName=" `
      -F "lastName=" `
      -F "email=" `
      -F "phoneNumber=" `
      -F "roleTitle=" `
      -F "marketingConsent=UNKNOWN" `
      "http://127.0.0.1:$taskAppPort/portal/contacts"
    if ($taskSessionToken -eq "test-session-token" -and [int]$taskContactWriteStatus -ge 400) {
      throw "OWNER contact creation control failed with HTTP $taskContactWriteStatus"
    }

    $taskCustomerWriteStatus = & curl.exe -s -o NUL -w "%{http_code}" -X POST `
      -H "Host: app.contigoaccounting.com" `
      -H "Origin: http://app.contigoaccounting.com" `
      -H "Cookie: swd-authjs.session-token=$taskSessionToken; swd-active-brand=contigo" `
      -F "$taskCustomerActionField=" `
      -F "name=CRM role boundary customer" `
      -F "code=" `
      -F "legalName=" `
      -F "status=PROSPECT" `
      -F "websiteUrl=" `
      -F "entityType=" `
      -F "principalAddressLine1=" `
      -F "principalAddressLine2=" `
      -F "principalAddressCity=" `
      -F "principalAddressRegion=" `
      -F "principalAddressPostalCode=" `
      -F "principalAddressCountryCode=" `
      -F "primaryPhone=" `
      -F "communicationEmail=" `
      -F "noticesEmail=" `
      -F "invoicingEmail=" `
      "http://127.0.0.1:$taskAppPort/portal/customers"
    if ($taskSessionToken -eq "test-session-token" -and [int]$taskCustomerWriteStatus -ge 400) {
      throw "OWNER customer creation control failed with HTTP $taskCustomerWriteStatus"
    }

    $taskLeadWriteStatus = & curl.exe -s -o NUL -w "%{http_code}" -X POST `
      -H "Host: app.contigoaccounting.com" `
      -H "Origin: http://app.contigoaccounting.com" `
      -H "Cookie: swd-authjs.session-token=$taskSessionToken; swd-active-brand=contigo" `
      -F "$taskLeadActionField=" `
      -F "name=CRM role boundary lead" `
      -F "company=" `
      -F "email=" `
      -F "phoneE164=" `
      -F "source=" `
      -F "sourceDetail=" `
      -F "expectedServices=" `
      -F "notes=" `
      -F "estimatedValue=" `
      -F "valueCurrency=USD" `
      "http://127.0.0.1:$taskAppPort/portal/leads"
    if ($taskSessionToken -eq "test-session-token" -and [int]$taskLeadWriteStatus -ge 400) {
      throw "OWNER lead creation control failed with HTTP $taskLeadWriteStatus"
    }
  }

  $taskCrmRoleBoundaryQuery = @'
SELECT
  (SELECT count(*) FROM "Contact" WHERE "brandId" = 'contigo' AND "displayName" = 'CRM role boundary contact')::text || ',' ||
  (SELECT count(*) FROM "CustomerAccount" WHERE "brandId" = 'contigo' AND name = 'CRM role boundary customer')::text || ',' ||
  (SELECT count(*) FROM "Lead" WHERE "brandId" = 'contigo' AND name = 'CRM role boundary lead')::text;
'@
  $taskCrmRoleBoundaryCounts = (($taskCrmRoleBoundaryQuery | & docker.exe exec -i $taskContainer psql -U postgres -d southwestdigital -tA) -join "").Trim()
  if ($taskCrmRoleBoundaryCounts -ne "1,1,1") {
    throw "VIEWER mutation boundary failed or OWNER controls failed: $taskCrmRoleBoundaryCounts"
  }

  Write-Output "Verified branded login, trusted-host revocation, hostname-safe auth completion, operator-host isolation, platform DAL authorization, transactional brand onboarding, integration asset governance, deduplicated export jobs, future offboarding scheduling without early lockout, due offboarding with app-domain and brand-only access revocation, entry-brand selection, authorized switching, tampered-cookie fallback, CRM tenant isolation, and VIEWER read-only enforcement."
}
finally {
  if ($taskServer -and -not $taskServer.HasExited) {
    Stop-Process -Id $taskServer.Id -Force -ErrorAction SilentlyContinue
    $taskServer.WaitForExit(5000) | Out-Null
  }
  if ($taskContainerStarted) {
    & docker.exe stop $taskContainer *> $null
  }
}
