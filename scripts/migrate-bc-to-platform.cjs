/**
 * BC → Platform migration script
 *
 * Run with:
 *   npx dotenv-cli -e .env.local -- node scripts/migrate-bc-to-platform.cjs
 *
 * What it does:
 *   Phase 1 — Reads all old BC data via raw SQL (before schema change)
 *   Phase 2 — Pushes the new platform schema (drops old tables)
 *   Phase 3 — Writes all transformed data into the new schema
 */

"use strict";

const { PrismaClient } = require("@prisma/client");
const { execSync } = require("child_process");

// ─── Constants ────────────────────────────────────────────────────────────────

const BC_BRAND_SLUG = "bc";
const BC_BRAND_NAME = "Bookkeeping Conroe";
const BC_APP_HOSTNAME = "app.bookkeepingconroe.com";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg) { console.log(`[migrate] ${msg}`); }
function warn(msg) { console.warn(`[migrate:warn] ${msg}`); }

async function readTable(prisma, table) {
  try {
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "${table}"`);
    log(`  ${table}: ${rows.length} rows`);
    return rows;
  } catch (e) {
    warn(`  ${table} not found or error: ${e.message.split("\n")[0]}`);
    return [];
  }
}

function mapUserStatus(old) {
  if (old === "ACTIVE") return "ACTIVE";
  if (old === "FORMER") return "FORMER";
  return "SUSPENDED"; // DISABLED → SUSPENDED
}

function mapMembershipStatus(old) {
  if (old === "ACTIVE") return "ACTIVE";
  return "SUSPENDED";
}

function mapBrandRole(user) {
  if (user.isExternalClient) return "VIEWER";
  if (user.role === "SUPER_ADMIN") return "OWNER";
  if (user.role === "EMPLOYEE" && user.isPayrollManager) return "ADMIN";
  return "MEMBER";
}

function mapPlatformRole(role) {
  if (role === "SUPER_ADMIN") return "OWNER";
  return "NONE";
}

function mapPortalNoticeRole(role) {
  if (role === "SUPER_ADMIN") return "OWNER";
  if (role === "EMPLOYEE") return "MEMBER";
  if (role === "INTERN") return "MEMBER";
  return null;
}

// ─── Phase 1: Read ────────────────────────────────────────────────────────────

async function readAllOldData(prisma) {
  log("Phase 1: Reading old BC data...");
  return {
    users:                     await readTable(prisma, "User"),
    accounts:                  await readTable(prisma, "Account"),
    internProfiles:            await readTable(prisma, "InternProfile"),
    memberOnboardingProfiles:  await readTable(prisma, "member_onboarding_profiles"),
    memberDocuments:           await readTable(prisma, "member_documents"),
    memberAuditEvents:         await readTable(prisma, "member_audit_events"),
    onboardingInvites:         await readTable(prisma, "OnboardingInvite"),
    onboardingSubmissions:     await readTable(prisma, "OnboardingSubmission"),
    agreementAcceptances:      await readTable(prisma, "AgreementAcceptance"),
    userOnboardingSteps:       await readTable(prisma, "UserOnboardingStep"),
    onboardingStepConfigs:     await readTable(prisma, "OnboardingStepConfig"),
    onboardingFlows:           await readTable(prisma, "OnboardingFlow"),
    onboardingFlowStepConfigs: await readTable(prisma, "OnboardingFlowStepConfig"),
    onboardingFlowCustomSteps: await readTable(prisma, "OnboardingFlowCustomStep"),
    onboardingFlowAssignments: await readTable(prisma, "OnboardingFlowAssignment"),
    onboardingStepQuestions:   await readTable(prisma, "OnboardingStepQuestion"),
    onboardingStepUploads:     await readTable(prisma, "OnboardingStepUpload"),
    onboardingFlowStepOrders:  await readTable(prisma, "OnboardingFlowStepOrder"),
    timecardEntries:           await readTable(prisma, "TimecardEntry"),
    timecardSessions:          await readTable(prisma, "TimecardSession"),
    contractorInvoices:        await readTable(prisma, "ContractorInvoice"),
    careerPathSteps:           await readTable(prisma, "CareerPathStep"),
    credentialBadges:          await readTable(prisma, "CredentialBadge"),
    userCredentialBadges:      await readTable(prisma, "UserCredentialBadge"),
    ticketClients:             await readTable(prisma, "TicketClient"),
    clientIntakeInvites:       await readTable(prisma, "ClientIntakeInvite"),
    reviewRequests:            await readTable(prisma, "ReviewRequest"),
    contacts:                  await readTable(prisma, "Contact"),
    clientContacts:            await readTable(prisma, "ClientContact"),
    meetingLeads:              await readTable(prisma, "MeetingLead"),
    leadContacts:              await readTable(prisma, "LeadContact"),
    meetingTags:               await readTable(prisma, "MeetingTag"),
    teamMeetings:              await readTable(prisma, "TeamMeeting"),
    teamMeetingAccesses:       await readTable(prisma, "TeamMeetingAccess"),
    teamMeetingClients:        await readTable(prisma, "TeamMeetingClient"),
    teamMeetingLeads:          await readTable(prisma, "TeamMeetingLead"),
    teamMeetingTags:           await readTable(prisma, "TeamMeetingTag"),
    teamMeetingContacts:       await readTable(prisma, "TeamMeetingContact"),
    pipelines:                 await readTable(prisma, "Pipeline"),
    pipelineStages:            await readTable(prisma, "PipelineStage"),
    pipelineItems:             await readTable(prisma, "PipelineItem"),
    campaigns:                 await readTable(prisma, "Campaign"),
    campaignContacts:          await readTable(prisma, "CampaignContact"),
    contentCalendarItems:      await readTable(prisma, "ContentCalendarItem"),
    sourceTagClickDailys:      await readTable(prisma, "SourceTagClickDaily"),
    archivedYouTubeVideos:     await readTable(prisma, "ArchivedYouTubeVideo"),
    strategyNotes:             await readTable(prisma, "StrategyNote"),
    brandSettings:             await readTable(prisma, "BrandSetting"),
    portalNotices:             await readTable(prisma, "PortalNotice"),
    tickets:                   await readTable(prisma, "Ticket"),
    ticketComments:            await readTable(prisma, "TicketComment"),
    dailyLogs:                 await readTable(prisma, "DailyLog"),
    logItems:                  await readTable(prisma, "log_items"),
    focusQuotes:               await readTable(prisma, "focus_quotes"),
    focusQuoteSettings:        await readTable(prisma, "focus_quote_settings"),
    legends:                   await readTable(prisma, "legends"),
    motivationalQuotes:        await readTable(prisma, "motivational_quotes"),
    standardsChecks:           await readTable(prisma, "standards_checks"),
    attendanceRecords:         await readTable(prisma, "scorecard_attendance_records"),
    taskRecords:               await readTable(prisma, "scorecard_task_records"),
    engagements:               await readTable(prisma, "Engagement"),
    discoveryItems:            await readTable(prisma, "DiscoveryItem"),
    proposalDocuments:         await readTable(prisma, "proposal_documents"),
    proposalPhases:            await readTable(prisma, "proposal_phases"),
    proposalPhaseItems:        await readTable(prisma, "proposal_phase_items"),
    proposalSections:          await readTable(prisma, "proposal_sections"),
    proposalSectionItems:      await readTable(prisma, "proposal_section_items"),
    proposalPackages:          await readTable(prisma, "ProposalPackage"),
    proposalPackageFeatures:   await readTable(prisma, "ProposalPackageFeature"),
    catalogServices:           await readTable(prisma, "catalog_services"),
    packageServices:           await readTable(prisma, "package_services"),
    pricingRules:              await readTable(prisma, "pricing_rules"),
    proposalSelections:        await readTable(prisma, "proposal_selections"),
    firmProfiles:              await readTable(prisma, "firm_profile"),
    companyRevenueMonths:      await readTable(prisma, "CompanyRevenueMonth"),
    quoteClients:              await readTable(prisma, "quote_clients"),
    quotes:                    await readTable(prisma, "quotes"),
    quoteLineItems:            await readTable(prisma, "quote_line_items"),
    quoteTemplates:            await readTable(prisma, "quote_templates"),
  };
}

// ─── Phase 2: Push new schema ─────────────────────────────────────────────────

function pushNewSchema() {
  log("Phase 2: Applying new platform schema (this drops all old tables)...");
  execSync("npx prisma db push --force-reset --accept-data-loss", {
    stdio: "inherit",
    env: process.env,
  });
  log("Schema applied.");
}

// ─── Phase 3: Write ───────────────────────────────────────────────────────────

async function writeAllNewData(prisma, old) {
  log("Phase 3: Writing migrated data...");

  // Build lookup maps from old data
  // Map old userId → new membershipId (pre-assigned below)
  const membershipIdByUserId = {};
  // Map old flowKey → flow.id (flows keep their IDs)
  const flowIdByKey = Object.fromEntries(old.onboardingFlows.map((f) => [f.key, f.id]));
  // Map old focusQuote id → (needed for FocusQuoteSetting)
  // Quotes keep their IDs so no remapping needed

  // 1. Brand
  log("  Creating Brand...");
  const brand = await prisma.brand.create({
    data: {
      slug: BC_BRAND_SLUG,
      name: BC_BRAND_NAME,
      legalName: "Bookkeeping Conroe LLC",
      status: "ACTIVE",
    },
  });
  const brandId = brand.id;
  log(`  Brand created: ${brandId}`);

  // 2. BrandDomain
  await prisma.brandDomain.create({
    data: {
      brandId,
      hostname: BC_APP_HOSTNAME,
      purpose: "APP",
      status: "VERIFIED",
      isPrimary: true,
      verifiedAt: new Date(),
    },
  });
  log("  BrandDomain created.");

  // 3. BrandTheme (from BrandSetting)
  const bcSetting = old.brandSettings.find((s) => s.brand === "treb" || s.brand === "bc") ?? old.brandSettings[0];
  await prisma.brandTheme.create({
    data: {
      brandId,
      primaryColor: bcSetting?.primaryColor || "#17324d",
      accentColor: "#d79b3b",
      backgroundColor: "#f7f8fa",
      foregroundColor: "#17202a",
      monthlyViewsGoal: bcSetting?.monthlyViewsGoal ?? null,
      monthlyClicksGoal: bcSetting?.monthlyClicksGoal ?? null,
    },
  });
  log("  BrandTheme created.");

  // 4. Users (preserve IDs)
  log(`  Creating ${old.users.length} Users...`);
  if (old.users.length > 0) {
    await prisma.user.createMany({
      data: old.users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        emailVerified: u.emailVerified,
        image: u.image,
        status: mapUserStatus(u.status),
        platformRole: mapPlatformRole(u.role),
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
      skipDuplicates: true,
    });
  }

  // 5. Accounts (preserve as-is)
  if (old.accounts.length > 0) {
    await prisma.account.createMany({ data: old.accounts.map((a) => ({
      id: a.id, userId: a.userId, type: a.type, provider: a.provider,
      providerAccountId: a.providerAccountId, refresh_token: a.refresh_token,
      access_token: a.access_token, expires_at: a.expires_at, token_type: a.token_type,
      scope: a.scope, id_token: a.id_token, session_state: a.session_state,
    })), skipDuplicates: true });
    log(`  Accounts: ${old.accounts.length}`);
  }

  // 6. BrandMemberships — one per user for BC brand
  log(`  Creating ${old.users.length} BrandMemberships...`);
  // Get accountType from InternProfile for each user
  const internProfileByUserId = Object.fromEntries(old.internProfiles.map((p) => [p.userId, p]));

  for (const u of old.users) {
    const internProfile = internProfileByUserId[u.id];
    const membership = await prisma.brandMembership.create({
      data: {
        brandId,
        userId: u.id,
        role: mapBrandRole(u),
        status: mapMembershipStatus(u.status),
        accountType: internProfile?.accountType ?? null,
        employeeNumber: u.employeeNumber ?? null,
        isPayrollManager: u.isPayrollManager ?? false,
        canAccessTickets: u.canAccessTickets ?? false,
        canUseFocus: u.canUseFocus ?? true,
        hasSeenFocusOnboarding: u.hasSeenFocusOnboarding ?? false,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      },
    });
    membershipIdByUserId[u.id] = membership.id;
  }

  function mid(userId) { return membershipIdByUserId[userId] ?? null; }
  function fid(flowKey) { return flowIdByKey[flowKey] ?? null; }

  // 7. InternProfile (membershipId, no accountType — moved to BrandMembership)
  if (old.internProfiles.length > 0) {
    await prisma.internProfile.createMany({
      data: old.internProfiles.filter((p) => mid(p.userId)).map((p) => ({
        id: p.id, membershipId: mid(p.userId), displayTitle: p.displayTitle,
        primaryEmail: p.primaryEmail, timezone: p.timezone, startDate: p.startDate,
        payRateUsd: p.payRateUsd, weeklyHoursCap: p.weeklyHoursCap,
        nextRoleTitle: p.nextRoleTitle, nextReviewDate: p.nextReviewDate,
        nextLevelRateUsd: p.nextLevelRateUsd, availability: p.availability,
        workDays: p.workDays, workStartTime: p.workStartTime, workEndTime: p.workEndTime,
        telegramHandle: p.telegramHandle, headshotUrl: p.headshotUrl,
        shortBio: p.shortBio, cohortLabel: p.cohortLabel, deviceInfo: p.deviceInfo,
        experienceNotes: p.experienceNotes, goals: p.goals,
        createdAt: p.createdAt, updatedAt: p.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  InternProfiles: ${old.internProfiles.length}`);
  }

  // 8. MemberOnboardingProfile
  if (old.memberOnboardingProfiles.length > 0) {
    await prisma.memberOnboardingProfile.createMany({
      data: old.memberOnboardingProfiles.filter((p) => mid(p.userId)).map((p) => ({
        id: p.id, membershipId: mid(p.userId),
        legalFirstName: p.legalFirstName, legalLastName: p.legalLastName,
        preferredName: p.preferredName, dateOfBirth: p.dateOfBirth,
        companyEmail: p.companyEmail, personalEmail: p.personalEmail,
        personalPhone: p.personalPhone, emergencyContactName: p.emergencyContactName,
        emergencyContactPhone: p.emergencyContactPhone,
        addressLine1: p.addressLine1, addressLine2: p.addressLine2,
        city: p.city, region: p.region, postalCode: p.postalCode, countryCode: p.countryCode,
        engagementType: p.engagementType, memberRole: p.memberRole, riskLevel: p.riskLevel,
        i9Required: p.i9Required, i9Status: p.i9Status, i9DocumentTypes: p.i9DocumentTypes,
        i9VerifiedAt: p.i9VerifiedAt, w4Status: p.w4Status, w9Status: p.w9Status,
        tinLast4: p.tinLast4, tinType: p.tinType, paymentMethod: p.paymentMethod,
        paymentEmailOrHandle: p.paymentEmailOrHandle, bankAccountToken: p.bankAccountToken,
        payCurrency: p.payCurrency ?? "USD", payRate: p.payRate, payCadence: p.payCadence,
        ndaAccepted: p.ndaAccepted, ndaAcceptedAt: p.ndaAcceptedAt,
        handbookAccepted: p.handbookAccepted, handbookAcceptedAt: p.handbookAcceptedAt,
        dataSecurityAccepted: p.dataSecurityAccepted, dataSecurityAcceptedAt: p.dataSecurityAcceptedAt,
        contractAccepted: p.contractAccepted, contractAcceptedAt: p.contractAcceptedAt,
        relationshipType: p.relationshipType, contractorType: p.contractorType,
        w9QBAck: p.w9QBAck, w9QBStatus: p.w9QBStatus ?? "NOT_SENT", w9QBNotes: p.w9QBNotes,
        availableStartDate: p.availableStartDate, hoursPerWeek: p.hoursPerWeek,
        workingDays: p.workingDays, typicalHoursStart: p.typicalHoursStart,
        typicalHoursEnd: p.typicalHoursEnd, timezone: p.timezone,
        scheduleConflicts: p.scheduleConflicts, canWorkUrgent: p.canWorkUrgent,
        canWorkWeekends: p.canWorkWeekends, scheduleNotes: p.scheduleNotes,
        scheduleAck: p.scheduleAck, paymentAck: p.paymentAck,
        paymentArrangement: p.paymentArrangement, projectNameProposal: p.projectNameProposal,
        projectAmountExpected: p.projectAmountExpected, projectDeadlineExpected: p.projectDeadlineExpected,
        projectNotesContractor: p.projectNotesContractor,
        adminStatus: p.adminStatus ?? "INVITED", sowRequired: p.sowRequired,
        sowSent: p.sowSent, sowSigned: p.sowSigned, approvedForWork: p.approvedForWork,
        adminNotes: p.adminNotes, backgroundCheckRequired: p.backgroundCheckRequired,
        backgroundCheckConsent: p.backgroundCheckConsent,
        backgroundCheckConsentAt: p.backgroundCheckConsentAt,
        backgroundCheckStatus: p.backgroundCheckStatus ?? "NOT_REQUIRED",
        backgroundCheckProviderRef: p.backgroundCheckProviderRef,
        needsQBOAccess: p.needsQBOAccess, needsEmailAccount: p.needsEmailAccount,
        needsTelegramAccess: p.needsTelegramAccess,
        onboardingStatus: p.onboardingStatus ?? "INCOMPLETE",
        createdByMembershipId: mid(p.createdByUserId),
        updatedByMembershipId: mid(p.updatedByUserId),
        createdAt: p.createdAt, updatedAt: p.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  MemberOnboardingProfiles: ${old.memberOnboardingProfiles.length}`);
  }

  // 9. MemberDocument
  if (old.memberDocuments.length > 0) {
    await prisma.memberDocument.createMany({
      data: old.memberDocuments.filter((d) => mid(d.memberId)).map((d) => ({
        id: d.id, membershipId: mid(d.memberId), docType: d.docType,
        storageKey: d.storageKey, url: d.url, checksum: d.checksum,
        uploadedByMembershipId: mid(d.uploadedByUserId),
        uploadedAt: d.uploadedAt,
      })),
      skipDuplicates: true,
    });
    log(`  MemberDocuments: ${old.memberDocuments.length}`);
  }

  // 10. MemberAuditEvent
  if (old.memberAuditEvents.length > 0) {
    await prisma.memberAuditEvent.createMany({
      data: old.memberAuditEvents.filter((e) => mid(e.memberId)).map((e) => ({
        id: e.id, membershipId: mid(e.memberId), eventKey: e.eventKey,
        previousValue: e.previousValue, newValue: e.newValue,
        changedByMembershipId: mid(e.changedByUserId),
        createdAt: e.createdAt,
      })),
      skipDuplicates: true,
    });
    log(`  MemberAuditEvents: ${old.memberAuditEvents.length}`);
  }

  // 11. OnboardingInvite
  if (old.onboardingInvites.length > 0) {
    await prisma.onboardingInvite.createMany({
      data: old.onboardingInvites.map((i) => ({
        id: i.id, brandId, tokenHash: i.tokenHash, email: i.email,
        recipientName: i.recipientName, role: i.role, onboardingTrack: i.onboardingTrack,
        engagementType: i.engagementType, countryCode: i.countryCode,
        riskLevel: i.riskLevel, backgroundCheckRequired: i.backgroundCheckRequired,
        needsQBOAccess: i.needsQBOAccess, needsEmailAccount: i.needsEmailAccount,
        needsTelegramAccess: i.needsTelegramAccess, uiVariant: i.uiVariant,
        lockedFields: i.lockedFields, expiresAt: i.expiresAt,
        openedAt: i.openedAt, usedAt: i.usedAt,
        createdByMembershipId: mid(i.createdByAdminId),
        linkedMembershipId: mid(i.memberId),
        createdAt: i.createdAt, updatedAt: i.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  OnboardingInvites: ${old.onboardingInvites.length}`);
  }

  // 12. OnboardingSubmission
  if (old.onboardingSubmissions.length > 0) {
    await prisma.onboardingSubmission.createMany({
      data: old.onboardingSubmissions.map((s) => ({
        id: s.id, inviteId: s.inviteId, submittedAt: s.submittedAt,
        ipAddress: s.ipAddress, userAgent: s.userAgent,
        payloadSnapshotEncrypted: s.payloadSnapshotEncrypted,
      })),
      skipDuplicates: true,
    });
    log(`  OnboardingSubmissions: ${old.onboardingSubmissions.length}`);
  }

  // 13. AgreementAcceptance
  if (old.agreementAcceptances.length > 0) {
    await prisma.agreementAcceptance.createMany({
      data: old.agreementAcceptances.filter((a) => mid(a.userId)).map((a) => ({
        id: a.id, membershipId: mid(a.userId),
        agreementKey: a.agreementKey, agreementVersion: a.agreementVersion,
        acceptedAt: a.acceptedAt,
      })),
      skipDuplicates: true,
    });
    log(`  AgreementAcceptances: ${old.agreementAcceptances.length}`);
  }

  // 14. MemberOnboardingStep (was UserOnboardingStep)
  if (old.userOnboardingSteps.length > 0) {
    await prisma.memberOnboardingStep.createMany({
      data: old.userOnboardingSteps.filter((s) => mid(s.userId)).map((s) => ({
        id: s.id, membershipId: mid(s.userId),
        stepKey: s.stepKey, completedAt: s.completedAt,
      })),
      skipDuplicates: true,
    });
    log(`  MemberOnboardingSteps: ${old.userOnboardingSteps.length}`);
  }

  // 15. OnboardingStepConfig
  if (old.onboardingStepConfigs.length > 0) {
    await prisma.onboardingStepConfig.createMany({
      data: old.onboardingStepConfigs.map((c) => ({
        id: c.id, stepKey: c.stepKey, titleOverride: c.titleOverride,
        descriptionOverride: c.descriptionOverride, streamIdOverride: c.streamIdOverride,
        linkHrefOverride: c.linkHrefOverride, linkLabelOverride: c.linkLabelOverride,
        agreementVersionOverride: c.agreementVersionOverride,
        createdAt: c.createdAt, updatedAt: c.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  OnboardingStepConfigs: ${old.onboardingStepConfigs.length}`);
  }

  // 16. OnboardingFlow — audience enum values changed to match BrandRole
  const audienceMap = { SUPER_ADMIN: "OWNER", EMPLOYEE: "MEMBER", INTERN: "MEMBER", CONTRACTOR: "MEMBER", CLIENT: "VIEWER" };
  if (old.onboardingFlows.length > 0) {
    await prisma.onboardingFlow.createMany({
      data: old.onboardingFlows.map((f) => ({
        id: f.id, brandId, key: f.key, label: f.label,
        audience: audienceMap[f.audience] ?? "MEMBER",
        sortOrder: f.sortOrder ?? 100, isActive: f.isActive ?? true,
        requireSequential: f.requireSequential ?? false,
        createdAt: f.createdAt, updatedAt: f.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  OnboardingFlows: ${old.onboardingFlows.length}`);
  }

  // 17. OnboardingFlowStepConfig (flowKey → flowId)
  if (old.onboardingFlowStepConfigs.length > 0) {
    await prisma.onboardingFlowStepConfig.createMany({
      data: old.onboardingFlowStepConfigs.filter((c) => fid(c.flowKey)).map((c) => ({
        id: c.id, flowId: fid(c.flowKey), stepKey: c.stepKey,
        titleOverride: c.titleOverride, descriptionOverride: c.descriptionOverride,
        streamIdOverride: c.streamIdOverride, linkHrefOverride: c.linkHrefOverride,
        linkLabelOverride: c.linkLabelOverride, assetHrefOverride: c.assetHrefOverride,
        assetLabelOverride: c.assetLabelOverride, objectivesOverride: c.objectivesOverride,
        agreementVersionOverride: c.agreementVersionOverride,
        requiredOverride: c.requiredOverride, blockingOverride: c.blockingOverride,
        isEnabledOverride: c.isEnabledOverride,
        createdAt: c.createdAt, updatedAt: c.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  OnboardingFlowStepConfigs: ${old.onboardingFlowStepConfigs.length}`);
  }

  // 18. OnboardingFlowCustomStep
  if (old.onboardingFlowCustomSteps.length > 0) {
    await prisma.onboardingFlowCustomStep.createMany({
      data: old.onboardingFlowCustomSteps.filter((s) => fid(s.flowKey)).map((s) => ({
        id: s.id, flowId: fid(s.flowKey), title: s.title, description: s.description,
        type: s.type, required: s.required, blocking: s.blocking,
        sortOrder: s.sortOrder ?? 1000, streamId: s.streamId,
        linkHref: s.linkHref, linkLabel: s.linkLabel, assetHref: s.assetHref,
        assetLabel: s.assetLabel, objectives: s.objectives,
        agreementKey: s.agreementKey, agreementVersion: s.agreementVersion,
        createdAt: s.createdAt, updatedAt: s.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  OnboardingFlowCustomSteps: ${old.onboardingFlowCustomSteps.length}`);
  }

  // 19. OnboardingFlowAssignment
  if (old.onboardingFlowAssignments.length > 0) {
    await prisma.onboardingFlowAssignment.createMany({
      data: old.onboardingFlowAssignments.filter((a) => mid(a.userId) && fid(a.flowKey)).map((a) => ({
        id: a.id, membershipId: mid(a.userId), flowId: fid(a.flowKey),
        isActive: a.isActive ?? true, reviewModeEnabled: a.reviewModeEnabled ?? false,
        assignedByMembershipId: mid(a.assignedByUserId),
        assignedAt: a.assignedAt, updatedAt: a.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  OnboardingFlowAssignments: ${old.onboardingFlowAssignments.length}`);
  }

  // 20. OnboardingStepQuestion
  if (old.onboardingStepQuestions.length > 0) {
    await prisma.onboardingStepQuestion.createMany({
      data: old.onboardingStepQuestions.filter((q) => mid(q.userId) && fid(q.flowKey)).map((q) => ({
        id: q.id, membershipId: mid(q.userId), flowId: fid(q.flowKey),
        stepKey: q.stepKey, questionText: q.questionText, status: q.status ?? "OPEN",
        adminReplyText: q.adminReplyText, askedAt: q.askedAt,
        answeredAt: q.answeredAt, resolvedAt: q.resolvedAt,
        answeredByMembershipId: mid(q.answeredByUserId),
        updatedAt: q.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  OnboardingStepQuestions: ${old.onboardingStepQuestions.length}`);
  }

  // 21. OnboardingStepUpload
  if (old.onboardingStepUploads.length > 0) {
    await prisma.onboardingStepUpload.createMany({
      data: old.onboardingStepUploads.filter((u) => mid(u.userId) && fid(u.flowKey)).map((u) => ({
        id: u.id, membershipId: mid(u.userId), flowId: fid(u.flowKey),
        stepKey: u.stepKey, storageProvider: u.storageProvider ?? "SUPABASE",
        bucket: u.bucket, storagePath: u.storagePath, fileName: u.fileName,
        mimeType: u.mimeType, sizeBytes: u.sizeBytes, publicUrl: u.publicUrl,
        uploadedAt: u.uploadedAt, updatedAt: u.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  OnboardingStepUploads: ${old.onboardingStepUploads.length}`);
  }

  // 22. OnboardingFlowStepOrder
  if (old.onboardingFlowStepOrders.length > 0) {
    await prisma.onboardingFlowStepOrder.createMany({
      data: old.onboardingFlowStepOrders.filter((o) => fid(o.flowKey)).map((o) => ({
        id: o.id, flowId: fid(o.flowKey), stepKey: o.stepKey,
        sortOrder: o.sortOrder, createdAt: o.createdAt, updatedAt: o.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  OnboardingFlowStepOrders: ${old.onboardingFlowStepOrders.length}`);
  }

  // 23-25. Timecard & payroll
  if (old.timecardEntries.length > 0) {
    await prisma.timecardEntry.createMany({
      data: old.timecardEntries.filter((e) => mid(e.userId)).map((e) => ({
        id: e.id, membershipId: mid(e.userId), workDate: e.workDate,
        hours: e.hours, notes: e.notes, createdAt: e.createdAt, updatedAt: e.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  TimecardEntries: ${old.timecardEntries.length}`);
  }

  if (old.timecardSessions.length > 0) {
    await prisma.timecardSession.createMany({
      data: old.timecardSessions.filter((s) => mid(s.userId)).map((s) => ({
        id: s.id, membershipId: mid(s.userId), clockInAt: s.clockInAt,
        clockOutAt: s.clockOutAt, notes: s.notes, createdAt: s.createdAt, updatedAt: s.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  TimecardSessions: ${old.timecardSessions.length}`);
  }

  if (old.contractorInvoices.length > 0) {
    await prisma.contractorInvoice.createMany({
      data: old.contractorInvoices.filter((i) => mid(i.userId)).map((i) => ({
        id: i.id, membershipId: mid(i.userId), invoiceNumber: i.invoiceNumber,
        status: i.status ?? "DRAFT", billingPeriodStart: i.billingPeriodStart,
        billingPeriodEnd: i.billingPeriodEnd, totalHours: i.totalHours,
        billingRateUsd: i.billingRateUsd, billableAmountUsd: i.billableAmountUsd,
        lineItems: i.lineItems, pdfData: i.pdfData,
        submittedAt: i.submittedAt, approvedAt: i.approvedAt, paidAt: i.paidAt,
        createdAt: i.createdAt, updatedAt: i.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  ContractorInvoices: ${old.contractorInvoices.length}`);
  }

  if (old.careerPathSteps.length > 0) {
    await prisma.careerPathStep.createMany({
      data: old.careerPathSteps.filter((s) => mid(s.userId)).map((s) => ({
        id: s.id, membershipId: mid(s.userId), stepOrder: s.stepOrder,
        title: s.title, billingRateUsd: s.billingRateUsd, weeklyHoursCap: s.weeklyHoursCap,
        monthlyBenefitsUsd: s.monthlyBenefitsUsd ?? 0, notes: s.notes,
        isActive: s.isActive ?? false, createdAt: s.createdAt, updatedAt: s.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  CareerPathSteps: ${old.careerPathSteps.length}`);
  }

  // 26. CredentialBadge (platform-level, no brandId)
  if (old.credentialBadges.length > 0) {
    await prisma.credentialBadge.createMany({
      data: old.credentialBadges.map((b) => ({
        id: b.id, key: b.key, label: b.label, icon: b.icon,
        ribbonStyle: b.ribbonStyle ?? "TRI_STRIPE",
        colorA: b.colorA ?? "#0f172a", colorB: b.colorB ?? "#f8d773", colorC: b.colorC,
        sortOrder: b.sortOrder ?? 0, isActive: b.isActive ?? true,
        createdAt: b.createdAt, updatedAt: b.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  CredentialBadges: ${old.credentialBadges.length}`);
  }

  // 27. MemberCredentialBadge (was UserCredentialBadge)
  if (old.userCredentialBadges.length > 0) {
    await prisma.memberCredentialBadge.createMany({
      data: old.userCredentialBadges.filter((b) => mid(b.userId)).map((b) => ({
        id: b.id, membershipId: mid(b.userId), badgeId: b.badgeId,
        awardedAt: b.awardedAt, expiresAt: b.expiresAt, notes: b.notes,
        awardedByMembershipId: mid(b.awardedByUserId),
      })),
      skipDuplicates: true,
    });
    log(`  MemberCredentialBadges: ${old.userCredentialBadges.length}`);
  }

  // 28. AppNotice (was PortalNotice)
  if (old.portalNotices.length > 0) {
    await prisma.appNotice.createMany({
      data: old.portalNotices.map((n) => ({
        id: n.id, brandId, title: n.title, body: n.body,
        targetRole: mapPortalNoticeRole(n.targetRole),
        isActive: n.isActive ?? true, createdAt: n.createdAt, updatedAt: n.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  AppNotices: ${old.portalNotices.length}`);
  }

  // 29. TicketClient (add brandId, @@unique([brandId, code]))
  if (old.ticketClients.length > 0) {
    await prisma.ticketClient.createMany({
      data: old.ticketClients.map((c) => ({
        id: c.id, brandId, code: c.code, name: c.name, isActive: c.isActive ?? true,
        businessLegalName: c.businessLegalName, entityType: c.entityType,
        principalAddressLine1: c.principalAddressLine1, principalAddressLine2: c.principalAddressLine2,
        principalAddressCity: c.principalAddressCity, principalAddressState: c.principalAddressState,
        principalAddressPostalCode: c.principalAddressPostalCode,
        stateOfFormation: c.stateOfFormation, principalAddress: c.principalAddress,
        primaryContactPhone: c.primaryContactPhone,
        authorizedCommunicationEmail: c.authorizedCommunicationEmail,
        noticesEmail: c.noticesEmail, preferredInvoicingEmail: c.preferredInvoicingEmail,
        createdAt: c.createdAt, updatedAt: c.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  TicketClients: ${old.ticketClients.length}`);
  }

  // 30. ClientIntakeInvite
  if (old.clientIntakeInvites.length > 0) {
    await prisma.clientIntakeInvite.createMany({
      data: old.clientIntakeInvites.map((i) => ({
        id: i.id, clientId: i.clientId, tokenHash: i.tokenHash,
        expiresAt: i.expiresAt, usedAt: i.usedAt,
        createdByMembershipId: mid(i.createdByUserId),
        createdAt: i.createdAt, updatedAt: i.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  ClientIntakeInvites: ${old.clientIntakeInvites.length}`);
  }

  // 31. Contact (add brandId)
  if (old.contacts.length > 0) {
    await prisma.contact.createMany({
      data: old.contacts.map((c) => ({
        id: c.id, brandId, name: c.name, firstName: c.firstName, lastName: c.lastName,
        email: c.email, secondaryEmail: c.secondaryEmail, phoneE164: c.phoneE164,
        businessEmail: c.businessEmail, personalEmail: c.personalEmail,
        phoneNumber: c.phoneNumber, roleTitle: c.roleTitle, isActive: c.isActive ?? true,
        createdAt: c.createdAt, updatedAt: c.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  Contacts: ${old.contacts.length}`);
  }

  // 32. ClientContact
  if (old.clientContacts.length > 0) {
    await prisma.clientContact.createMany({
      data: old.clientContacts.map((c) => ({
        id: c.id, clientId: c.clientId, contactId: c.contactId, createdAt: c.createdAt,
      })),
      skipDuplicates: true,
    });
    log(`  ClientContacts: ${old.clientContacts.length}`);
  }

  // 33. MeetingTag (add brandId, @@unique([brandId, key]))
  if (old.meetingTags.length > 0) {
    await prisma.meetingTag.createMany({
      data: old.meetingTags.map((t) => ({
        id: t.id, brandId, key: t.key, label: t.label,
        isActive: t.isActive ?? true, sortOrder: t.sortOrder ?? 0,
        createdAt: t.createdAt, updatedAt: t.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  MeetingTags: ${old.meetingTags.length}`);
  }

  // 34. MeetingLead (add brandId)
  if (old.meetingLeads.length > 0) {
    await prisma.meetingLead.createMany({
      data: old.meetingLeads.map((l) => ({
        id: l.id, brandId, name: l.name, company: l.company, email: l.email,
        clientId: l.clientId, kind: l.kind ?? "LEAD",
        bookkeepingCategory: l.bookkeepingCategory ?? "SMALL_BUSINESS",
        expectedServices: l.expectedServices, notes: l.notes, isActive: l.isActive ?? true,
        createdAt: l.createdAt, updatedAt: l.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  MeetingLeads: ${old.meetingLeads.length}`);
  }

  // 35. LeadContact
  if (old.leadContacts.length > 0) {
    await prisma.leadContact.createMany({
      data: old.leadContacts.map((c) => ({
        id: c.id, leadId: c.leadId, contactId: c.contactId, createdAt: c.createdAt,
      })),
      skipDuplicates: true,
    });
    log(`  LeadContacts: ${old.leadContacts.length}`);
  }

  // 36. Ticket (add brandId, assignedUserId → assignedMembershipId)
  if (old.tickets.length > 0) {
    await prisma.ticket.createMany({
      data: old.tickets.map((t) => ({
        id: t.id, brandId, ticketNumber: t.ticketNumber, clientId: t.clientId,
        urgency: t.urgency ?? "MEDIUM", description: t.description,
        status: t.status ?? "NOT_STARTED", openedOn: t.openedOn, deadline: t.deadline,
        closedOn: t.closedOn, assignedMembershipId: mid(t.assignedUserId),
        assignedNameLegacy: t.assignedNameLegacy, type: t.type, roleNeeded: t.roleNeeded,
        coordinationLevel: t.coordinationLevel ?? "NONE",
        ticketFolderUrl: t.ticketFolderUrl, postBriefUrl: t.postBriefUrl,
        notes: t.notes, importSource: t.importSource, importKey: t.importKey,
        createdAt: t.createdAt, updatedAt: t.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  Tickets: ${old.tickets.length}`);
  }

  // 37. TicketComment (authorUserId → authorMembershipId)
  if (old.ticketComments.length > 0) {
    await prisma.ticketComment.createMany({
      data: old.ticketComments.filter((c) => mid(c.authorUserId)).map((c) => ({
        id: c.id, ticketId: c.ticketId, authorMembershipId: mid(c.authorUserId),
        body: c.body, createdAt: c.createdAt,
      })),
      skipDuplicates: true,
    });
    log(`  TicketComments: ${old.ticketComments.length}`);
  }

  // 38. TeamMeeting (add brandId, createdByUserId → createdByMembershipId)
  if (old.teamMeetings.length > 0) {
    await prisma.teamMeeting.createMany({
      data: old.teamMeetings.filter((m) => mid(m.createdByUserId)).map((m) => ({
        id: m.id, brandId, title: m.title, meetingUrl: m.meetingUrl,
        meetingDate: m.meetingDate, provider: m.provider ?? "FIREFLIES",
        notes: m.notes, externalId: m.externalId, source: m.source ?? "manual",
        createdByMembershipId: mid(m.createdByUserId),
        createdAt: m.createdAt, updatedAt: m.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  TeamMeetings: ${old.teamMeetings.length}`);
  }

  // 39. TeamMeetingAccess (userId → membershipId)
  if (old.teamMeetingAccesses.length > 0) {
    await prisma.teamMeetingAccess.createMany({
      data: old.teamMeetingAccesses.filter((a) => mid(a.userId)).map((a) => ({
        id: a.id, meetingId: a.meetingId, membershipId: mid(a.userId), createdAt: a.createdAt,
      })),
      skipDuplicates: true,
    });
    log(`  TeamMeetingAccesses: ${old.teamMeetingAccesses.length}`);
  }

  // 40-42. TeamMeeting join tables
  if (old.teamMeetingClients.length > 0) {
    await prisma.teamMeetingClient.createMany({
      data: old.teamMeetingClients.map((r) => ({ id: r.id, meetingId: r.meetingId, clientId: r.clientId, createdAt: r.createdAt })),
      skipDuplicates: true,
    });
    log(`  TeamMeetingClients: ${old.teamMeetingClients.length}`);
  }
  if (old.teamMeetingLeads.length > 0) {
    await prisma.teamMeetingLead.createMany({
      data: old.teamMeetingLeads.map((r) => ({ id: r.id, meetingId: r.meetingId, leadId: r.leadId, createdAt: r.createdAt })),
      skipDuplicates: true,
    });
    log(`  TeamMeetingLeads: ${old.teamMeetingLeads.length}`);
  }
  if (old.teamMeetingTags.length > 0) {
    await prisma.teamMeetingTag.createMany({
      data: old.teamMeetingTags.map((r) => ({ id: r.id, meetingId: r.meetingId, tagId: r.tagId, createdAt: r.createdAt })),
      skipDuplicates: true,
    });
    log(`  TeamMeetingTags: ${old.teamMeetingTags.length}`);
  }
  if (old.teamMeetingContacts.length > 0) {
    await prisma.teamMeetingContact.createMany({
      data: old.teamMeetingContacts.map((r) => ({ id: r.id, meetingId: r.meetingId, contactId: r.contactId, createdAt: r.createdAt })),
      skipDuplicates: true,
    });
    log(`  TeamMeetingContacts: ${old.teamMeetingContacts.length}`);
  }

  // 43. Pipeline (add brandId, createdByUserId → createdByMembershipId, @@unique([brandId, key]))
  if (old.pipelines.length > 0) {
    await prisma.pipeline.createMany({
      data: old.pipelines.map((p) => ({
        id: p.id, brandId, key: p.key, name: p.name, type: p.type ?? "CUSTOM",
        description: p.description, isActive: p.isActive ?? true,
        createdByMembershipId: mid(p.createdByUserId),
        createdAt: p.createdAt, updatedAt: p.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  Pipelines: ${old.pipelines.length}`);
  }

  if (old.pipelineStages.length > 0) {
    await prisma.pipelineStage.createMany({
      data: old.pipelineStages.map((s) => ({
        id: s.id, pipelineId: s.pipelineId, key: s.key, name: s.name,
        description: s.description, sortOrder: s.sortOrder ?? 100,
        valueMultiplier: s.valueMultiplier ?? 0.01, isActive: s.isActive ?? true,
        isTerminal: s.isTerminal ?? false, createdAt: s.createdAt, updatedAt: s.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  PipelineStages: ${old.pipelineStages.length}`);
  }

  if (old.pipelineItems.length > 0) {
    await prisma.pipelineItem.createMany({
      data: old.pipelineItems.map((i) => ({
        id: i.id, pipelineId: i.pipelineId, stageId: i.stageId, leadId: i.leadId,
        baseValueUsd: i.baseValueUsd ?? 0, isActive: i.isActive ?? true,
        createdAt: i.createdAt, updatedAt: i.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  PipelineItems: ${old.pipelineItems.length}`);
  }

  // 44. Campaign (add brandId)
  if (old.campaigns.length > 0) {
    await prisma.campaign.createMany({
      data: old.campaigns.map((c) => ({
        id: c.id, brandId, name: c.name, description: c.description,
        createdAt: c.createdAt, updatedAt: c.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  Campaigns: ${old.campaigns.length}`);
  }

  if (old.campaignContacts.length > 0) {
    await prisma.campaignContact.createMany({
      data: old.campaignContacts.map((c) => ({
        id: c.id, campaignId: c.campaignId, contactId: c.contactId, addedAt: c.addedAt,
      })),
      skipDuplicates: true,
    });
    log(`  CampaignContacts: ${old.campaignContacts.length}`);
  }

  // 45. ReviewRequest (add brandId, sentByUserId → sentByMembershipId)
  if (old.reviewRequests.length > 0) {
    await prisma.reviewRequest.createMany({
      data: old.reviewRequests.map((r) => ({
        id: r.id, brandId, clientId: r.clientId, token: r.token, channel: r.channel,
        recipientPhone: r.recipientPhone, recipientEmail: r.recipientEmail,
        recipientName: r.recipientName, sentAt: r.sentAt, openedAt: r.openedAt,
        clickedAt: r.clickedAt, outcome: r.outcome,
        feedbackRating: r.feedbackRating, feedbackText: r.feedbackText,
        sentByMembershipId: mid(r.sentByUserId), contactId: r.contactId,
        campaignId: r.campaignId, createdAt: r.createdAt, updatedAt: r.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  ReviewRequests: ${old.reviewRequests.length}`);
  }

  // 46. ContentCalendarItem (brandSlug → brandId, createdByUserId → createdByMembershipId)
  if (old.contentCalendarItems.length > 0) {
    await prisma.contentCalendarItem.createMany({
      data: old.contentCalendarItems.map((i) => ({
        id: i.id, brandId, title: i.title, notes: i.notes,
        status: i.status ?? "PLANNED", plannedPublishDate: i.plannedPublishDate,
        producedAt: i.producedAt, actualPublishDate: i.actualPublishDate,
        youtubeVideoId: i.youtubeVideoId, sourceTag: i.sourceTag,
        vidiqScore: i.vidiqScore, vidiqVolume: i.vidiqVolume,
        vidiqCompetition: i.vidiqCompetition, vidiqCapturedAt: i.vidiqCapturedAt,
        videoDescription: i.videoDescription, videoTags: i.videoTags,
        pinnedComment: i.pinnedComment, videoScript: i.videoScript,
        localFolderPath: i.localFolderPath, thumbnailPath: i.thumbnailPath,
        thumbnailText: i.thumbnailText,
        createdByMembershipId: mid(i.createdByUserId),
        sortOrder: i.sortOrder ?? 0, createdAt: i.createdAt, updatedAt: i.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  ContentCalendarItems: ${old.contentCalendarItems.length}`);
  }

  // 47. SourceTagClickDaily (channel → brandId)
  if (old.sourceTagClickDailys.length > 0) {
    await prisma.sourceTagClickDaily.createMany({
      data: old.sourceTagClickDailys.map((s) => ({
        id: s.id, date: s.date, tag: s.tag, brandId,
        clicks: s.clicks, createdAt: s.createdAt, updatedAt: s.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  SourceTagClickDailys: ${old.sourceTagClickDailys.length}`);
  }

  // 48. ArchivedYouTubeVideo (add brandId)
  if (old.archivedYouTubeVideos.length > 0) {
    await prisma.archivedYouTubeVideo.createMany({
      data: old.archivedYouTubeVideos.map((v) => ({
        videoId: v.videoId, brandId, title: v.title, archivedAt: v.archivedAt,
      })),
      skipDuplicates: true,
    });
    log(`  ArchivedYouTubeVideos: ${old.archivedYouTubeVideos.length}`);
  }

  // 49. StrategyNote (brand string → brandId)
  if (old.strategyNotes.length > 0) {
    await prisma.strategyNote.createMany({
      data: old.strategyNotes.map((n) => ({
        id: n.id, brandId, goalHeading: n.goalHeading, goalSubtitle: n.goalSubtitle,
        goalDescription: n.goalDescription, bottleneck: n.bottleneck,
        strategy: n.strategy, dailyAction: n.dailyAction, reward: n.reward,
        updatedAt: n.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  StrategyNotes: ${old.strategyNotes.length}`);
  }

  // 50. DailyLog / LogItem / FocusQuote / FocusQuoteSetting
  if (old.dailyLogs.length > 0) {
    await prisma.dailyLog.createMany({
      data: old.dailyLogs.filter((d) => mid(d.userId)).map((d) => ({
        id: d.id, membershipId: mid(d.userId), date: d.date,
        item1: d.item1 ?? "", item2: d.item2 ?? "", item3: d.item3 ?? "",
        item1Done: d.item1Done ?? false, item2Done: d.item2Done ?? false,
        item3Done: d.item3Done ?? false, createdAt: d.createdAt, updatedAt: d.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  DailyLogs: ${old.dailyLogs.length}`);
  }

  if (old.logItems.length > 0) {
    await prisma.logItem.createMany({
      data: old.logItems.filter((i) => mid(i.userId)).map((i) => ({
        id: i.id, membershipId: mid(i.userId), workDate: i.workDate,
        title: i.title ?? "", notes: i.notes, status: i.status ?? "PENDING",
        completedAt: i.completedAt, archivedAt: i.archivedAt,
        dailySlot: i.dailySlot, dailyMarkedDate: i.dailyMarkedDate,
        dailyAssignedDate: i.dailyAssignedDate, shurikenSlot: i.shurikenSlot,
        shurikenMarkedDate: i.shurikenMarkedDate, shurikenAssignedDate: i.shurikenAssignedDate,
        subtasks: i.subtasks ?? [], isToday: i.isToday ?? false,
        sortOrder: i.sortOrder ?? 0, legacyKey: i.legacyKey,
        createdAt: i.createdAt, updatedAt: i.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  LogItems: ${old.logItems.length}`);
  }

  if (old.focusQuotes.length > 0) {
    await prisma.focusQuote.createMany({
      data: old.focusQuotes.filter((q) => mid(q.userId)).map((q) => ({
        id: q.id, membershipId: mid(q.userId), text: q.text,
        author: q.author ?? "", sortOrder: q.sortOrder ?? 0, createdAt: q.createdAt,
      })),
      skipDuplicates: true,
    });
    log(`  FocusQuotes: ${old.focusQuotes.length}`);
  }

  if (old.focusQuoteSettings.length > 0) {
    await prisma.focusQuoteSetting.createMany({
      data: old.focusQuoteSettings.filter((s) => mid(s.userId)).map((s) => ({
        id: s.id, membershipId: mid(s.userId),
        rotationMode: s.rotationMode ?? "random",
        intervalMinutes: s.intervalMinutes ?? 10,
        pinnedQuoteId: s.pinnedQuoteId, updatedAt: s.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  FocusQuoteSettings: ${old.focusQuoteSettings.length}`);
  }

  // 51. Legend / MotivationalQuote (platform-level, no changes)
  if (old.legends.length > 0) {
    await prisma.legend.createMany({
      data: old.legends.map((l) => ({
        id: l.id, name: l.name, slug: l.slug, earlyImageUrl: l.earlyImageUrl,
        legendImageUrl: l.legendImageUrl, active: l.active ?? true,
        sortOrder: l.sortOrder ?? 0, createdAt: l.createdAt, updatedAt: l.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  Legends: ${old.legends.length}`);
  }

  if (old.motivationalQuotes.length > 0) {
    await prisma.motivationalQuote.createMany({
      data: old.motivationalQuotes.map((q) => ({
        id: q.id, legendId: q.legendId, text: q.text, source: q.source,
        active: q.active ?? true, sortOrder: q.sortOrder ?? 0,
        createdAt: q.createdAt, updatedAt: q.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  MotivationalQuotes: ${old.motivationalQuotes.length}`);
  }

  // 52. StandardsCheck / AttendanceRecord / TaskRecord
  if (old.standardsChecks.length > 0) {
    await prisma.standardsCheck.createMany({
      data: old.standardsChecks.filter((s) => mid(s.userId)).map((s) => ({
        id: s.id, membershipId: mid(s.userId), standardKey: s.standardKey,
        status: s.status ?? "NOT_REVIEWED", notes: s.notes,
        reviewedByMembershipId: mid(s.reviewedByUserId),
        reviewedAt: s.reviewedAt, createdAt: s.createdAt, updatedAt: s.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  StandardsChecks: ${old.standardsChecks.length}`);
  }

  if (old.attendanceRecords.length > 0) {
    await prisma.attendanceRecord.createMany({
      data: old.attendanceRecords.filter((r) => mid(r.userId)).map((r) => ({
        id: r.id, membershipId: mid(r.userId), date: r.date, status: r.status,
        recordedByMembershipId: mid(r.recordedById) ?? r.recordedById,
        recordedAt: r.recordedAt,
      })),
      skipDuplicates: true,
    });
    log(`  AttendanceRecords: ${old.attendanceRecords.length}`);
  }

  if (old.taskRecords.length > 0) {
    await prisma.taskRecord.createMany({
      data: old.taskRecords.filter((r) => mid(r.userId)).map((r) => ({
        id: r.id, membershipId: mid(r.userId), weekStart: r.weekStart, status: r.status,
        recordedByMembershipId: mid(r.recordedById) ?? r.recordedById,
        recordedAt: r.recordedAt,
      })),
      skipDuplicates: true,
    });
    log(`  TaskRecords: ${old.taskRecords.length}`);
  }

  // 53. Engagement (add brandId, userId fields → membershipId)
  if (old.engagements.length > 0) {
    await prisma.engagement.createMany({
      data: old.engagements.map((e) => ({
        id: e.id, brandId,
        clientName: e.clientName ?? "", clientLegalName: e.clientLegalName ?? "",
        dba: e.dba, entityType: e.entityType,
        primaryContactName: e.primaryContactName, primaryContactEmail: e.primaryContactEmail,
        primaryContactPhone: e.primaryContactPhone, billingContactName: e.billingContactName,
        billingContactEmail: e.billingContactEmail, billingContactPhone: e.billingContactPhone,
        businessAddress: e.businessAddress, quickBooksCompanyName: e.quickBooksCompanyName,
        relatedEntities: e.relatedEntities, clientNotes: e.clientNotes,
        engagementType: e.engagementType, status: e.status ?? "DRAFT",
        pricingModel: e.pricingModel, feeAmount: e.feeAmount, hourlyRate: e.hourlyRate,
        depositRequired: e.depositRequired ?? false, depositAmount: e.depositAmount,
        billingFrequency: e.billingFrequency, paymentTerms: e.paymentTerms,
        effectiveDate: e.effectiveDate, startDate: e.startDate, endDate: e.endDate,
        assignedOwnerMembershipId: mid(e.assignedOwnerId),
        internalReviewerMembershipId: mid(e.internalReviewerId),
        urgencyNotes: e.urgencyNotes, notes: e.notes,
        realEstateDetails: e.realEstateDetails, monthlyScope: e.monthlyScope,
        cleanupScope: e.cleanupScope, hourlyScope: e.hourlyScope,
        auditSupportScope: e.auditSupportScope, exclusions: e.exclusions,
        customExclusions: e.customExclusions,
        intakeTokenHash: e.intakeTokenHash, intakeData: e.intakeData,
        onboardingData: e.onboardingData, intakeSubmittedAt: e.intakeSubmittedAt,
        intakeExpiresAt: e.intakeExpiresAt,
        salesCallCompleted: e.salesCallCompleted ?? false, salesCallDate: e.salesCallDate,
        salesCallNotes: e.salesCallNotes, initialClientProblem: e.initialClientProblem,
        urgencyOrDeadline: e.urgencyOrDeadline, initialEstimateDiscussed: e.initialEstimateDiscussed,
        scopingMode: e.scopingMode ?? "AGREEMENT", isExpedited: e.isExpedited ?? false,
        onboardingFee: e.onboardingFee, onboardingFeeWaived: e.onboardingFeeWaived ?? false,
        onboardingFeeStatus: e.onboardingFeeStatus ?? "REQUIRED",
        onboardingFeeCreditable: e.onboardingFeeCreditable ?? true,
        onboardingFeeCreditAppliedTo: e.onboardingFeeCreditAppliedTo ?? "DISCOVERY_DEPOSIT",
        onboardingFeeCreditAmount: e.onboardingFeeCreditAmount,
        estimatedTotalFee: e.estimatedTotalFee,
        discoveryDepositPercent: e.discoveryDepositPercent ?? 25,
        discoveryDepositStatus: e.discoveryDepositStatus,
        fullFeeDueUpfront: e.fullFeeDueUpfront ?? false,
        discoveryRequired: e.discoveryRequired ?? true,
        discoveryCompletedAt: e.discoveryCompletedAt,
        finalScopeConfirmedAt: e.finalScopeConfirmedAt,
        revisedFeeAmount: e.revisedFeeAmount, changeOrderRequired: e.changeOrderRequired ?? false,
        periodStart: e.periodStart, periodEnd: e.periodEnd,
        taxYearsInvolved: e.taxYearsInvolved, accountsIncluded: e.accountsIncluded,
        creditCardsIncluded: e.creditCardsIncluded, loansIncluded: e.loansIncluded,
        payrollInvolved: e.payrollInvolved ?? false,
        contractorPaymentsInvolved: e.contractorPaymentsInvolved ?? false,
        missingRecordsKnown: e.missingRecordsKnown, knownProblems: e.knownProblems,
        requiredDocuments: e.requiredDocuments, deliverables: e.deliverables,
        specialReportingPeriodStart: e.specialReportingPeriodStart,
        specialReportingPeriodEnd: e.specialReportingPeriodEnd,
        specialReportDescription: e.specialReportDescription,
        auditPolicyOrLenderSupportRequired: e.auditPolicyOrLenderSupportRequired ?? false,
        agreementText: e.agreementText, agreementSentAt: e.agreementSentAt,
        agreementTokenHash: e.agreementTokenHash, signerName: e.signerName,
        signerTitle: e.signerTitle, signedAt: e.signedAt, signerIpAddress: e.signerIpAddress,
        signerUserAgent: e.signerUserAgent, agreementTextHash: e.agreementTextHash,
        consentToElectronicSignature: e.consentToElectronicSignature ?? false,
        agreementReadAndAgreed: e.agreementReadAndAgreed ?? false,
        agreementScrolledToEnd: e.agreementScrolledToEnd ?? false,
        agreementScrolledAt: e.agreementScrolledAt, agreementNotes: e.agreementNotes,
        isTestProposal: e.isTestProposal ?? false, discoveryTokenHash: e.discoveryTokenHash,
        createdByMembershipId: mid(e.createdById),
        createdAt: e.createdAt, updatedAt: e.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  Engagements: ${old.engagements.length}`);
  }

  if (old.discoveryItems.length > 0) {
    await prisma.discoveryItem.createMany({
      data: old.discoveryItems.map((i) => ({
        id: i.id, engagementId: i.engagementId, category: i.category ?? "General",
        label: i.label, instructions: i.instructions, status: i.status ?? "PENDING",
        clientNote: i.clientNote, fileUrl: i.fileUrl, adminNote: i.adminNote,
        sortOrder: i.sortOrder ?? 0, createdAt: i.createdAt, updatedAt: i.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  DiscoveryItems: ${old.discoveryItems.length}`);
  }

  // 54. ProposalDocuments, Phases, PhaseItems, Sections, SectionItems
  if (old.proposalDocuments.length > 0) {
    await prisma.proposalDocument.createMany({
      data: old.proposalDocuments.map((d) => ({
        id: d.id, brandId, engagementId: d.engagementId, slug: d.slug,
        companyName: d.companyName, preparedFor: d.preparedFor, serviceType: d.serviceType,
        cleanupPeriodStart: d.cleanupPeriodStart, cleanupPeriodEnd: d.cleanupPeriodEnd,
        projectGoal: d.projectGoal, estimatedTotalFee: d.estimatedTotalFee,
        displayMode: d.displayMode ?? "document", status: d.status ?? "draft",
        publicStatus: d.publicStatus ?? "draft", paymentMethod: d.paymentMethod,
        introPaymentSentence: d.introPaymentSentence, acceptedAt: d.acceptedAt,
        acceptedByName: d.acceptedByName, acceptedByEmail: d.acceptedByEmail,
        acceptanceIp: d.acceptanceIp, acceptanceUserAgent: d.acceptanceUserAgent,
        acceptanceNote: d.acceptanceNote, acceptedSnapshot: d.acceptedSnapshot,
        agreementPreparedAt: d.agreementPreparedAt, agreementSentAt: d.agreementSentAt,
        agreementSignedAt: d.agreementSignedAt,
        phase3InvoiceSentAt: d.phase3InvoiceSentAt,
        phase3PaymentReceivedAt: d.phase3PaymentReceivedAt,
        createdAt: d.createdAt, updatedAt: d.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  ProposalDocuments: ${old.proposalDocuments.length}`);
  }

  if (old.proposalPhases.length > 0) {
    await prisma.proposalPhase.createMany({
      data: old.proposalPhases.map((p) => ({
        id: p.id, proposalId: p.proposalId, phaseNumber: p.phaseNumber,
        title: p.title, status: p.status ?? "pending", amount: p.amount,
        amountType: p.amountType ?? "fixed", paymentNote: p.paymentNote,
        introduction: p.introduction, displayOrder: p.displayOrder ?? 100,
        createdAt: p.createdAt, updatedAt: p.updatedAt,
      })),
      skipDuplicates: true,
    });
  }

  if (old.proposalPhaseItems.length > 0) {
    await prisma.proposalPhaseItem.createMany({
      data: old.proposalPhaseItems.map((i) => ({
        id: i.id, phaseId: i.phaseId, text: i.text,
        displayOrder: i.displayOrder ?? 100, createdAt: i.createdAt, updatedAt: i.updatedAt,
      })),
      skipDuplicates: true,
    });
  }

  if (old.proposalSections.length > 0) {
    await prisma.proposalSection.createMany({
      data: old.proposalSections.map((s) => ({
        id: s.id, proposalId: s.proposalId, sectionKey: s.sectionKey,
        title: s.title, body: s.body, displayOrder: s.displayOrder ?? 100,
        createdAt: s.createdAt, updatedAt: s.updatedAt,
      })),
      skipDuplicates: true,
    });
  }

  if (old.proposalSectionItems.length > 0) {
    await prisma.proposalSectionItem.createMany({
      data: old.proposalSectionItems.map((i) => ({
        id: i.id, sectionId: i.sectionId, text: i.text,
        displayOrder: i.displayOrder ?? 100, createdAt: i.createdAt, updatedAt: i.updatedAt,
      })),
      skipDuplicates: true,
    });
  }
  log(`  Proposal documents, phases, sections: done`);

  // 55. ProposalPackage (add brandId, @@unique([brandId, key]))
  if (old.proposalPackages.length > 0) {
    await prisma.proposalPackage.createMany({
      data: old.proposalPackages.map((p) => ({
        id: p.id, brandId, key: p.key, scenario: p.scenario, name: p.name,
        summary: p.summary, descriptionLong: p.descriptionLong,
        supportLabel: p.supportLabel, supportIncludes: p.supportIncludes,
        supportStars: p.supportStars ?? 1, highlightLabel: p.highlightLabel,
        tier: p.tier ?? 1, priceMode: p.priceMode ?? "BASE_MULTIPLIER",
        priceValue: p.priceValue, onboardingFee: p.onboardingFee,
        billingType: p.billingType ?? "recurring", whyItMatters: p.whyItMatters,
        displayOrder: p.displayOrder ?? 100, badge: p.badge, leadIn: p.leadIn,
        positioningStatement: p.positioningStatement, buttonLabel: p.buttonLabel,
        paymentStage1Label: p.paymentStage1Label, paymentStage1Amount: p.paymentStage1Amount,
        paymentStage2Label: p.paymentStage2Label, paymentStage2Amount: p.paymentStage2Amount,
        paymentStage3Label: p.paymentStage3Label, paymentStage3Amount: p.paymentStage3Amount,
        clientResponsibilities: p.clientResponsibilities, exclusions: p.exclusions,
        responseStandard: p.responseStandard, expeditedCommitment: p.expeditedCommitment,
        workingSessionLimit: p.workingSessionLimit, receiptLimit: p.receiptLimit,
        responseCommitmentTitle: p.responseCommitmentTitle,
        responseCommitmentBody: p.responseCommitmentBody,
        onboardingSummary: p.onboardingSummary, onboardingItems: p.onboardingItems,
        executionSummary: p.executionSummary, executionItems: p.executionItems,
        expeditedAddOnPrice: p.expeditedAddOnPrice, expeditedAddOnLabel: p.expeditedAddOnLabel,
        expeditedAddOnDescription: p.expeditedAddOnDescription,
        isActive: p.isActive ?? true, createdAt: p.createdAt, updatedAt: p.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  ProposalPackages: ${old.proposalPackages.length}`);
  }

  if (old.proposalPackageFeatures.length > 0) {
    await prisma.proposalPackageFeature.createMany({
      data: old.proposalPackageFeatures.map((f) => ({
        id: f.id, packageId: f.packageId, kind: f.kind ?? "INCLUDED",
        shortLabel: f.shortLabel, longDescription: f.longDescription,
        displayOrder: f.displayOrder ?? 100, createdAt: f.createdAt, updatedAt: f.updatedAt,
      })),
      skipDuplicates: true,
    });
  }

  // 56. CatalogService (add brandId, @@unique([brandId, code]))
  if (old.catalogServices.length > 0) {
    await prisma.catalogService.createMany({
      data: old.catalogServices.map((s) => ({
        id: s.id, brandId, code: s.code, name: s.name,
        internalDescription: s.description, cardLabel: s.card_label,
        clientBenefit: s.client_benefit, service: s.itemType ?? "cleanup",
        category: s.category, priority: s.priority ?? 500,
        defaultInclusion: s.default_inclusion, estimatedHours: s.estimatedHours,
        internalNotes: s.internal_notes, active: s.active ?? true,
        createdAt: s.createdAt, updatedAt: s.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  CatalogServices: ${old.catalogServices.length}`);
  }

  if (old.packageServices.length > 0) {
    await prisma.packageService.createMany({
      data: old.packageServices.map((s) => ({
        id: s.id, packageId: s.packageId, serviceId: s.serviceId,
        inclusionType: s.inclusionType ?? "included", notes: s.notes, createdAt: s.createdAt,
      })),
      skipDuplicates: true,
    });
  }

  if (old.pricingRules.length > 0) {
    await prisma.pricingRule.createMany({
      data: old.pricingRules.map((r) => ({
        id: r.id, packageId: r.packageId, name: r.name ?? "",
        description: r.description, ruleType: r.ruleType, configJson: r.configJson,
        billingType: r.billingType ?? "recurring", minPrice: r.minPrice, maxPrice: r.maxPrice,
        sortOrder: r.sortOrder ?? 100, createdAt: r.createdAt, updatedAt: r.updatedAt,
      })),
      skipDuplicates: true,
    });
  }

  if (old.proposalSelections.length > 0) {
    await prisma.proposalSelection.createMany({
      data: old.proposalSelections.map((s) => ({
        id: s.id, engagementId: s.engagementId, packageKey: s.packageKey,
        packageName: s.packageName, selectedPrice: s.selectedPrice,
        clientName: s.clientName, status: s.status ?? "pending",
        expeditedSelected: s.expeditedSelected ?? false,
        expeditedAddOnPrice: s.expeditedAddOnPrice, selectedAt: s.selectedAt,
      })),
      skipDuplicates: true,
    });
  }
  log(`  ProposalPackage features, catalog, pricing: done`);

  // 57. FirmProfile (add brandId)
  if (old.firmProfiles.length > 0) {
    await prisma.firmProfile.createMany({
      data: old.firmProfiles.map((f) => ({
        id: f.id, brandId, legalName: f.legalName ?? "", dba: f.dba,
        addressLine1: f.addressLine1, addressLine2: f.addressLine2,
        city: f.city, state: f.state, postalCode: f.postalCode,
        phone: f.phone, email: f.email, ein: f.ein,
        sosFileNumber: f.sos_file_number, stateOfFormation: f.stateOfFormation,
        logoUrl: f.logoUrl, website: f.website, qboFirmId: f.qbo_firm_id,
        updatedAt: f.updatedAt, createdAt: f.createdAt,
      })),
      skipDuplicates: true,
    });
    log(`  FirmProfile: ${old.firmProfiles.length}`);
  }

  // 58. CompanyRevenueMonth (add brandId, @@unique([brandId, monthStart]))
  if (old.companyRevenueMonths.length > 0) {
    await prisma.companyRevenueMonth.createMany({
      data: old.companyRevenueMonths.map((m) => ({
        id: m.id, brandId, monthStart: m.monthStart,
        grossRevenueUsd: m.grossRevenueUsd, notes: m.notes,
        createdAt: m.createdAt, updatedAt: m.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  CompanyRevenueMonths: ${old.companyRevenueMonths.length}`);
  }

  // 59. QuoteClient / Quote / QuoteLineItem / QuoteTemplate (add brandId)
  if (old.quoteClients.length > 0) {
    await prisma.quoteClient.createMany({
      data: old.quoteClients.map((c) => ({
        id: c.id, brandId, name: c.name, email: c.email,
        company: c.company, notes: c.notes, createdAt: c.createdAt, updatedAt: c.updatedAt,
      })),
      skipDuplicates: true,
    });
  }

  if (old.quotes.length > 0) {
    await prisma.quote.createMany({
      data: old.quotes.map((q) => ({
        id: q.id, brandId, slug: q.slug, clientId: q.clientId,
        status: q.status ?? "draft", packageId: q.packageId,
        totalOneTime: q.totalOneTime ?? 0, totalRecurring: q.totalRecurring ?? 0,
        onboardingFee: q.onboardingFee ?? 0, snapshotJson: q.snapshotJson,
        createdAt: q.createdAt, updatedAt: q.updatedAt, expiresAt: q.expiresAt,
      })),
      skipDuplicates: true,
    });
  }

  if (old.quoteLineItems.length > 0) {
    await prisma.quoteLineItem.createMany({
      data: old.quoteLineItems.map((i) => ({
        id: i.id, quoteId: i.quoteId, label: i.label, description: i.description,
        amount: i.amount, billingType: i.billingType, sortOrder: i.sortOrder ?? 100,
        createdAt: i.createdAt,
      })),
      skipDuplicates: true,
    });
  }

  if (old.quoteTemplates.length > 0) {
    await prisma.quoteTemplate.createMany({
      data: old.quoteTemplates.map((t) => ({
        id: t.id, name: t.name, slug: t.slug, layoutType: t.layoutType ?? "3-column",
        sections: t.sections ?? [], highlightMiddle: t.highlightMiddle ?? true,
        showInclusions: t.showInclusions ?? true,
        showPriceBreakdown: t.showPriceBreakdown ?? true,
        active: t.active ?? true, createdAt: t.createdAt, updatedAt: t.updatedAt,
      })),
      skipDuplicates: true,
    });
  }
  log(`  Quotes + templates: done`);

  log("All data written successfully.");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Run with: npx dotenv-cli -e .env.local -- node scripts/migrate-bc-to-platform.cjs");
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    const old = await readAllOldData(prisma);
    await prisma.$disconnect();

    pushNewSchema();

    const prisma2 = new PrismaClient();
    try {
      await writeAllNewData(prisma2, old);
    } finally {
      await prisma2.$disconnect();
    }

    console.log("\n✓ Migration complete.\n");
    console.log("Next steps:");
    console.log("  1. Start the dev server: npm run dev");
    console.log("  2. Visit /login and sign in as thomas@bookkeepingconroe.com");
    console.log("  3. Verify your data looks correct");
    console.log("  4. Deploy to Netlify when ready");
  } catch (e) {
    await prisma.$disconnect().catch(() => {});
    console.error("\n✗ Migration failed:", e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

main();
