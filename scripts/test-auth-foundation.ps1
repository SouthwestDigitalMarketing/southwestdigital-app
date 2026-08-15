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
  ('platform-owner', 'Southwest Owner', 'owner@southwestdigital.test', 'ACTIVE', 'OWNER', now(), now());

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
  ('domain-bookkeeping', 'bookkeeping', 'app.bookkeepingconroe.com', 'APP', 'VERIFIED', true, now(), now(), now());

INSERT INTO "BrandMembership" (id, "brandId", "userId", role, status, "createdAt", "updatedAt") VALUES
  ('member-contigo', 'contigo', 'dagny', 'OWNER', 'ACTIVE', now(), now()),
  ('member-melbourne', 'melbourne', 'dagny', 'OWNER', 'ACTIVE', now(), now());

INSERT INTO "Session" (id, "sessionToken", "userId", expires)
VALUES
  ('session-1', 'test-session-token', 'dagny', now() + interval '1 day'),
  ('session-platform', 'test-platform-session-token', 'platform-owner', now() + interval '1 day');

INSERT INTO "Contact" (id, "brandId", "displayName", status, "marketingConsent", "createdAt", "updatedAt") VALUES
  ('contigo-contact', 'contigo', 'Contigo Only Contact', 'ACTIVE', 'UNKNOWN', now(), now()),
  ('melbourne-contact', 'melbourne', 'Melbourne Only Contact', 'ACTIVE', 'UNKNOWN', now(), now());

INSERT INTO "Lead" (id, "brandId", name, status, "createdAt", "updatedAt") VALUES
  ('contigo-lead', 'contigo', 'Contigo Only Lead', 'NEW', now(), now()),
  ('melbourne-lead', 'melbourne', 'Melbourne Only Lead', 'NEW', now(), now());
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

  $taskComplete = (& curl.exe -s -i `
    -H "Host: app.contigoaccounting.com" `
    -H "Cookie: authjs.session-token=test-session-token" `
    "http://127.0.0.1:$taskAppPort/auth/complete") -join "`n"
  if ($taskComplete -notmatch "swd-active-brand=contigo") {
    throw "Entry hostname did not establish Contigo as active"
  }
  if ($taskComplete -notmatch "location: http://app\.contigoaccounting\.com/portal") {
    throw "Auth completion did not retain the verified entry hostname"
  }

  $taskPlatformComplete = (& curl.exe -s -i `
    -H "Host: localhost:$taskAppPort" `
    -H "Cookie: authjs.session-token=test-platform-session-token" `
    "http://127.0.0.1:$taskAppPort/auth/complete") -join "`n"
  if ($taskPlatformComplete -notmatch "location: http://localhost:$taskAppPort/platform/brands") {
    throw "Platform owner did not land in platform administration"
  }

  $taskPlatformBrands = (& curl.exe -s `
    -H "Host: localhost:$taskAppPort" `
    -H "Cookie: authjs.session-token=test-platform-session-token" `
    "http://127.0.0.1:$taskAppPort/platform/brands") -join "`n"
  if ($taskPlatformBrands -notmatch "Platform administration" -or $taskPlatformBrands -notmatch "Melbourne CFO") {
    throw "Platform brand administration did not render for the platform owner"
  }

  $taskNonAdminPlatform = (& curl.exe -s -i `
    -H "Host: localhost:$taskAppPort" `
    -H "Cookie: authjs.session-token=test-session-token" `
    "http://127.0.0.1:$taskAppPort/platform/brands") -join "`n"
  if ($taskNonAdminPlatform -notmatch "location: /portal") {
    throw "A brand-only user was not rejected from platform administration"
  }

  $taskNewBrandPage = (& curl.exe -s `
    -H "Host: localhost:$taskAppPort" `
    -H "Cookie: authjs.session-token=test-platform-session-token" `
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
  $taskOnboardingResponse = (& curl.exe -s -i -X POST `
    -H "Host: localhost:$taskAppPort" `
    -H "Origin: http://localhost:$taskAppPort" `
    -H "Cookie: authjs.session-token=test-platform-session-token" `
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

  $taskSwitchedPortal = (& curl.exe -s `
    -H "Host: app.contigoaccounting.com" `
    -H "Cookie: authjs.session-token=test-session-token; swd-active-brand=melbourne" `
    "http://127.0.0.1:$taskAppPort/portal") -join "`n"
  if ($taskSwitchedPortal -notmatch "Melbourne CFO") {
    throw "Authorized brand switch was not retained"
  }

  $taskTamperedPortal = (& curl.exe -s `
    -H "Host: app.contigoaccounting.com" `
    -H "Cookie: authjs.session-token=test-session-token; swd-active-brand=bookkeeping" `
    "http://127.0.0.1:$taskAppPort/portal") -join "`n"
  if ($taskTamperedPortal -notmatch "Contigo Accounting") {
    throw "Unauthorized active-brand cookie was not rejected"
  }

  $taskContigoContacts = (& curl.exe -s `
    -H "Host: app.contigoaccounting.com" `
    -H "Cookie: authjs.session-token=test-session-token; swd-active-brand=contigo" `
    "http://127.0.0.1:$taskAppPort/portal/contacts") -join "`n"
  if ($taskContigoContacts -notmatch "Contigo Only Contact" -or $taskContigoContacts -match "Melbourne Only Contact") {
    throw "Contact page did not preserve brand isolation"
  }

  $taskMelbourneLeads = (& curl.exe -s `
    -H "Host: app.contigoaccounting.com" `
    -H "Cookie: authjs.session-token=test-session-token; swd-active-brand=melbourne" `
    "http://127.0.0.1:$taskAppPort/portal/leads") -join "`n"
  if ($taskMelbourneLeads -notmatch "Melbourne Only Lead" -or $taskMelbourneLeads -match "Contigo Only Lead") {
    throw "Lead page did not preserve brand isolation"
  }

  Write-Output "Verified branded login, unknown-host rejection, hostname-safe auth completion, platform-admin routing and authorization, transactional brand onboarding, entry-brand selection, authorized switching, tampered-cookie fallback, and CRM page isolation."
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
