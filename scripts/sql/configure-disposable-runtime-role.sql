\set ON_ERROR_STOP on

-- Disposable test environments only. Production roles are provisioned with
-- separate generated credentials and the explicit grant matrix in the runbook.

CREATE ROLE southwest_app_runtime
  LOGIN
  PASSWORD 'test-runtime-password'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION
  NOBYPASSRLS;

GRANT CONNECT ON DATABASE southwestdigital TO southwest_app_runtime;
GRANT USAGE ON SCHEMA public TO southwest_app_runtime;
REVOKE CREATE ON SCHEMA public FROM southwest_app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "User",
  "Account",
  "Session",
  "VerificationToken",
  "Brand",
  "BrandDomain",
  "BrandMembership",
  "BrandTheme",
  "BrandFeature",
  "BrandIntegration",
  "AuditEvent",
  "BrandOffboardingPlan",
  "BrandDataExport",
  "CustomerAccount",
  "Contact",
  "CustomerContact",
  "Lead",
  "LeadContact",
  "LeadAttributionTouch"
TO southwest_app_runtime;
