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
VALUES ('dagny', 'Dagny', 'dagny@example.test', 'ACTIVE', 'NONE', now(), now());

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
VALUES ('session-1', 'test-session-token', 'dagny', now() + interval '1 day');
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

  Write-Output "Verified branded login, unknown-host rejection, hostname-safe auth completion, entry-brand selection, authorized switching, and tampered-cookie fallback."
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
