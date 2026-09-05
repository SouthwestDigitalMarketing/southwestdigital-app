/**
 * Recovery migration: reads from local Docker DB, writes to Supabase.
 * Schema is already applied in Supabase — this only handles data.
 *
 * Run with:
 *   npx dotenv-cli -e .env.local -- node scripts/migrate-local-to-supabase.cjs
 */

"use strict";

const { PrismaClient } = require("@prisma/client");

const DOCKER_DB_URL = "postgresql://bcnext:bcnext@localhost:5432/bcnext_dev";

const BC_BRAND_SLUG = "bc";
const BC_BRAND_NAME = "Bookkeeping Conroe";
const BC_APP_HOSTNAME = "app.bookkeepingconroe.com";

function log(msg) { console.log(`[migrate] ${msg}`); }
function warn(msg) { console.warn(`[migrate:warn] ${msg}`); }

async function readTable(prisma, table) {
  try {
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "${table}"`);
    log(`  ${table}: ${rows.length} rows`);
    return rows;
  } catch (e) {
    warn(`  ${table} skipped: ${e.message.split("\n")[0]}`);
    return [];
  }
}

function mapUserStatus(old) {
  if (old === "ACTIVE") return "ACTIVE";
  if (old === "FORMER") return "FORMER";
  return "SUSPENDED";
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

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set.");
    process.exit(1);
  }

  // Source: local Docker (old BC schema, raw SQL)
  const source = new PrismaClient({ datasources: { db: { url: DOCKER_DB_URL } } });

  log("Phase 1: Reading from local Docker DB...");
  const old = {
    users:                     await readTable(source, "User"),
    accounts:                  await readTable(source, "Account"),
    internProfiles:            await readTable(source, "InternProfile"),
    memberOnboardingProfiles:  await readTable(source, "member_onboarding_profiles"),
    memberDocuments:           await readTable(source, "member_documents"),
    memberAuditEvents:         await readTable(source, "member_audit_events"),
    onboardingInvites:         await readTable(source, "OnboardingInvite"),
    onboardingSubmissions:     await readTable(source, "OnboardingSubmission"),
    agreementAcceptances:      await readTable(source, "AgreementAcceptance"),
    userOnboardingSteps:       await readTable(source, "UserOnboardingStep"),
    onboardingStepConfigs:     await readTable(source, "OnboardingStepConfig"),
    onboardingFlows:           await readTable(source, "OnboardingFlow"),
    onboardingFlowStepConfigs: await readTable(source, "OnboardingFlowStepConfig"),
    onboardingFlowCustomSteps: await readTable(source, "OnboardingFlowCustomStep"),
    onboardingFlowAssignments: await readTable(source, "OnboardingFlowAssignment"),
    onboardingStepQuestions:   await readTable(source, "OnboardingStepQuestion"),
    onboardingStepUploads:     await readTable(source, "OnboardingStepUpload"),
    onboardingFlowStepOrders:  await readTable(source, "OnboardingFlowStepOrder"),
    timecardEntries:           await readTable(source, "TimecardEntry"),
    timecardSessions:          await readTable(source, "TimecardSession"),
    contractorInvoices:        await readTable(source, "ContractorInvoice"),
    careerPathSteps:           await readTable(source, "CareerPathStep"),
    credentialBadges:          await readTable(source, "CredentialBadge"),
    userCredentialBadges:      await readTable(source, "UserCredentialBadge"),
    ticketClients:             await readTable(source, "TicketClient"),
    clientIntakeInvites:       await readTable(source, "ClientIntakeInvite"),
    reviewRequests:            await readTable(source, "ReviewRequest"),
    contacts:                  await readTable(source, "Contact"),
    clientContacts:            await readTable(source, "ClientContact"),
    meetingLeads:              await readTable(source, "MeetingLead"),
    leadContacts:              await readTable(source, "LeadContact"),
    meetingTags:               await readTable(source, "MeetingTag"),
    teamMeetings:              await readTable(source, "TeamMeeting"),
    teamMeetingAccesses:       await readTable(source, "TeamMeetingAccess"),
    teamMeetingClients:        await readTable(source, "TeamMeetingClient"),
    teamMeetingLeads:          await readTable(source, "TeamMeetingLead"),
    teamMeetingTags:           await readTable(source, "TeamMeetingTag"),
    teamMeetingContacts:       await readTable(source, "TeamMeetingContact"),
    pipelines:                 await readTable(source, "Pipeline"),
    pipelineStages:            await readTable(source, "PipelineStage"),
    pipelineItems:             await readTable(source, "PipelineItem"),
    campaigns:                 await readTable(source, "Campaign"),
    campaignContacts:          await readTable(source, "CampaignContact"),
    contentCalendarItems:      await readTable(source, "ContentCalendarItem"),
    sourceTagClickDailys:      await readTable(source, "SourceTagClickDaily"),
    archivedYouTubeVideos:     await readTable(source, "ArchivedYouTubeVideo"),
    strategyNotes:             await readTable(source, "StrategyNote"),
    brandSettings:             await readTable(source, "BrandSetting"),
    portalNotices:             await readTable(source, "PortalNotice"),
    tickets:                   await readTable(source, "Ticket"),
    ticketComments:            await readTable(source, "TicketComment"),
    dailyLogs:                 await readTable(source, "DailyLog"),
    logItems:                  await readTable(source, "log_items"),
    focusQuotes:               await readTable(source, "focus_quotes"),
    focusQuoteSettings:        await readTable(source, "focus_quote_settings"),
    legends:                   await readTable(source, "legends"),
    motivationalQuotes:        await readTable(source, "motivational_quotes"),
    standardsChecks:           await readTable(source, "standards_checks"),
    attendanceRecords:         await readTable(source, "scorecard_attendance_records"),
    taskRecords:               await readTable(source, "scorecard_task_records"),
    engagements:               await readTable(source, "Engagement"),
    discoveryItems:            await readTable(source, "DiscoveryItem"),
    proposalDocuments:         await readTable(source, "proposal_documents"),
    proposalPhases:            await readTable(source, "proposal_phases"),
    proposalPhaseItems:        await readTable(source, "proposal_phase_items"),
    proposalSections:          await readTable(source, "proposal_sections"),
    proposalSectionItems:      await readTable(source, "proposal_section_items"),
    proposalPackages:          await readTable(source, "ProposalPackage"),
    proposalPackageFeatures:   await readTable(source, "ProposalPackageFeature"),
    catalogServices:           await readTable(source, "catalog_services"),
    packageServices:           await readTable(source, "package_services"),
    pricingRules:              await readTable(source, "pricing_rules"),
    proposalSelections:        await readTable(source, "proposal_selections"),
    firmProfiles:              await readTable(source, "firm_profile"),
    companyRevenueMonths:      await readTable(source, "CompanyRevenueMonth"),
    quoteClients:              await readTable(source, "quote_clients"),
    quotes:                    await readTable(source, "quotes"),
    quoteLineItems:            await readTable(source, "quote_line_items"),
    quoteTemplates:            await readTable(source, "quote_templates"),
  };
  await source.$disconnect();

  // Destination: Supabase (new platform schema)
  const dest = new PrismaClient();

  log("\nPhase 2: Writing to Supabase (new schema)...");

  const internProfileByUserId = Object.fromEntries(old.internProfiles.map((p) => [p.userId, p]));
  const membershipIdByUserId = {};
  const flowIdByKey = Object.fromEntries(old.onboardingFlows.map((f) => [f.key, f.id]));

  // Brand
  log("  Creating Brand...");
  const brand = await dest.brand.create({
    data: { slug: BC_BRAND_SLUG, name: BC_BRAND_NAME, legalName: "Bookkeeping Conroe LLC", status: "ACTIVE" },
  });
  const brandId = brand.id;

  await dest.brandDomain.create({
    data: { brandId, hostname: BC_APP_HOSTNAME, purpose: "APP", status: "VERIFIED", isPrimary: true, verifiedAt: new Date() },
  });

  const bcSetting = old.brandSettings[0];
  await dest.brandTheme.create({
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
  log("  Brand + theme created.");

  // Users
  if (old.users.length > 0) {
    await dest.user.createMany({
      data: old.users.map((u) => ({
        id: u.id, name: u.name, email: u.email, emailVerified: u.emailVerified,
        image: u.image, status: mapUserStatus(u.status), platformRole: mapPlatformRole(u.role),
        createdAt: u.createdAt, updatedAt: u.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  Users: ${old.users.length}`);
  }

  // Accounts
  if (old.accounts.length > 0) {
    await dest.account.createMany({
      data: old.accounts.map((a) => ({
        id: a.id, userId: a.userId, type: a.type, provider: a.provider,
        providerAccountId: a.providerAccountId, refresh_token: a.refresh_token,
        access_token: a.access_token, expires_at: a.expires_at, token_type: a.token_type,
        scope: a.scope, id_token: a.id_token, session_state: a.session_state,
      })),
      skipDuplicates: true,
    });
    log(`  Accounts: ${old.accounts.length}`);
  }

  // BrandMemberships
  for (const u of old.users) {
    const ip = internProfileByUserId[u.id];
    const m = await dest.brandMembership.create({
      data: {
        brandId, userId: u.id, brandRole: mapBrandRole(u), membershipStatus: mapMembershipStatus(u.status),
        accountType: ip?.accountType ?? null,
        employeeNumber: u.employeeNumber ?? null,
        isPayrollManager: u.isPayrollManager ?? false,
        canAccessTickets: u.canAccessTickets ?? false,
        canUseFocus: u.canUseFocus ?? true,
        hasSeenFocusOnboarding: u.hasSeenFocusOnboarding ?? false,
        createdAt: u.createdAt, updatedAt: u.updatedAt,
      },
    });
    membershipIdByUserId[u.id] = m.id;
  }
  log(`  BrandMemberships: ${old.users.length}`);

  function mid(userId) { return membershipIdByUserId[userId] ?? null; }
  function fid(flowKey) { return flowIdByKey[flowKey] ?? null; }

  // InternProfile
  if (old.internProfiles.length > 0) {
    await dest.internProfile.createMany({
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

  // OnboardingFlow
  const audienceMap = { SUPER_ADMIN: "OWNER", EMPLOYEE: "MEMBER", INTERN: "MEMBER", CONTRACTOR: "MEMBER", CLIENT: "VIEWER" };
  if (old.onboardingFlows.length > 0) {
    await dest.onboardingFlow.createMany({
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

  if (old.onboardingFlowStepConfigs.length > 0) {
    await dest.onboardingFlowStepConfig.createMany({
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

  if (old.onboardingFlowStepOrders.length > 0) {
    await dest.onboardingFlowStepOrder.createMany({
      data: old.onboardingFlowStepOrders.filter((o) => fid(o.flowKey)).map((o) => ({
        id: o.id, flowId: fid(o.flowKey), stepKey: o.stepKey,
        sortOrder: o.sortOrder, createdAt: o.createdAt, updatedAt: o.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  OnboardingFlowStepOrders: ${old.onboardingFlowStepOrders.length}`);
  }

  if (old.onboardingInvites.length > 0) {
    await dest.onboardingInvite.createMany({
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

  if (old.userOnboardingSteps.length > 0) {
    await dest.memberOnboardingStep.createMany({
      data: old.userOnboardingSteps.filter((s) => mid(s.userId)).map((s) => ({
        id: s.id, membershipId: mid(s.userId), stepKey: s.stepKey, completedAt: s.completedAt,
      })),
      skipDuplicates: true,
    });
    log(`  MemberOnboardingSteps: ${old.userOnboardingSteps.length}`);
  }

  if (old.timecardSessions.length > 0) {
    await dest.timecardSession.createMany({
      data: old.timecardSessions.filter((s) => mid(s.userId)).map((s) => ({
        id: s.id, membershipId: mid(s.userId), clockInAt: s.clockInAt,
        clockOutAt: s.clockOutAt, notes: s.notes, createdAt: s.createdAt, updatedAt: s.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  TimecardSessions: ${old.timecardSessions.length}`);
  }

  if (old.credentialBadges.length > 0) {
    await dest.credentialBadge.createMany({
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

  if (old.ticketClients.length > 0) {
    await dest.ticketClient.createMany({
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

  if (old.contacts.length > 0) {
    await dest.contact.createMany({
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

  if (old.clientContacts.length > 0) {
    await dest.clientContact.createMany({
      data: old.clientContacts.map((c) => ({ id: c.id, clientId: c.clientId, contactId: c.contactId, createdAt: c.createdAt })),
      skipDuplicates: true,
    });
  }

  if (old.meetingLeads.length > 0) {
    await dest.meetingLead.createMany({
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

  if (old.meetingTags.length > 0) {
    await dest.meetingTag.createMany({
      data: old.meetingTags.map((t) => ({
        id: t.id, brandId, key: t.key, label: t.label,
        isActive: t.isActive ?? true, sortOrder: t.sortOrder ?? 0,
        createdAt: t.createdAt, updatedAt: t.updatedAt,
      })),
      skipDuplicates: true,
    });
  }

  if (old.tickets.length > 0) {
    await dest.ticket.createMany({
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

  if (old.reviewRequests.length > 0) {
    await dest.reviewRequest.createMany({
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

  if (old.teamMeetings.length > 0) {
    await dest.teamMeeting.createMany({
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

  if (old.teamMeetingAccesses.length > 0) {
    await dest.teamMeetingAccess.createMany({
      data: old.teamMeetingAccesses.filter((a) => mid(a.userId)).map((a) => ({
        id: a.id, meetingId: a.meetingId, membershipId: mid(a.userId), createdAt: a.createdAt,
      })),
      skipDuplicates: true,
    });
  }

  if (old.teamMeetingClients.length > 0) {
    await dest.teamMeetingClient.createMany({
      data: old.teamMeetingClients.map((r) => ({ id: r.id, meetingId: r.meetingId, clientId: r.clientId, createdAt: r.createdAt })),
      skipDuplicates: true,
    });
  }

  if (old.pipelines.length > 0) {
    await dest.pipeline.createMany({
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
    await dest.pipelineStage.createMany({
      data: old.pipelineStages.map((s) => ({
        id: s.id, pipelineId: s.pipelineId, key: s.key, name: s.name,
        description: s.description, sortOrder: s.sortOrder ?? 100,
        valueMultiplier: s.valueMultiplier ?? 0.01, isActive: s.isActive ?? true,
        isTerminal: s.isTerminal ?? false, createdAt: s.createdAt, updatedAt: s.updatedAt,
      })),
      skipDuplicates: true,
    });
  }

  if (old.pipelineItems.length > 0) {
    await dest.pipelineItem.createMany({
      data: old.pipelineItems.map((i) => ({
        id: i.id, pipelineId: i.pipelineId, stageId: i.stageId, leadId: i.leadId,
        baseValueUsd: i.baseValueUsd ?? 0, isActive: i.isActive ?? true,
        createdAt: i.createdAt, updatedAt: i.updatedAt,
      })),
      skipDuplicates: true,
    });
  }

  if (old.campaigns.length > 0) {
    await dest.campaign.createMany({
      data: old.campaigns.map((c) => ({
        id: c.id, brandId, name: c.name, description: c.description,
        createdAt: c.createdAt, updatedAt: c.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  Campaigns: ${old.campaigns.length}`);
  }

  if (old.campaignContacts.length > 0) {
    await dest.campaignContact.createMany({
      data: old.campaignContacts.map((c) => ({ id: c.id, campaignId: c.campaignId, contactId: c.contactId, addedAt: c.addedAt })),
      skipDuplicates: true,
    });
  }

  if (old.contentCalendarItems.length > 0) {
    await dest.contentCalendarItem.createMany({
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

  if (old.sourceTagClickDailys.length > 0) {
    // Insert in batches to avoid pgbouncer limits
    const batch = 100;
    for (let i = 0; i < old.sourceTagClickDailys.length; i += batch) {
      await dest.sourceTagClickDaily.createMany({
        data: old.sourceTagClickDailys.slice(i, i + batch).map((s) => ({
          id: s.id, date: s.date, tag: s.tag, brandId,
          clicks: s.clicks, createdAt: s.createdAt, updatedAt: s.updatedAt,
        })),
        skipDuplicates: true,
      });
    }
    log(`  SourceTagClickDailys: ${old.sourceTagClickDailys.length}`);
  }

  if (old.archivedYouTubeVideos.length > 0) {
    await dest.archivedYouTubeVideo.createMany({
      data: old.archivedYouTubeVideos.map((v) => ({ videoId: v.videoId, brandId, title: v.title, archivedAt: v.archivedAt })),
      skipDuplicates: true,
    });
    log(`  ArchivedYouTubeVideos: ${old.archivedYouTubeVideos.length}`);
  }

  if (old.strategyNotes.length > 0) {
    await dest.strategyNote.createMany({
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

  if (old.dailyLogs.length > 0) {
    await dest.dailyLog.createMany({
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
    await dest.logItem.createMany({
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
    await dest.focusQuote.createMany({
      data: old.focusQuotes.filter((q) => mid(q.userId)).map((q) => ({
        id: q.id, membershipId: mid(q.userId), text: q.text,
        author: q.author ?? "", sortOrder: q.sortOrder ?? 0, createdAt: q.createdAt,
      })),
      skipDuplicates: true,
    });
    log(`  FocusQuotes: ${old.focusQuotes.length}`);
  }

  if (old.focusQuoteSettings.length > 0) {
    await dest.focusQuoteSetting.createMany({
      data: old.focusQuoteSettings.filter((s) => mid(s.userId)).map((s) => ({
        id: s.id, membershipId: mid(s.userId),
        rotationMode: s.rotationMode ?? "random",
        intervalMinutes: s.intervalMinutes ?? 10,
        pinnedQuoteId: s.pinnedQuoteId, updatedAt: s.updatedAt,
      })),
      skipDuplicates: true,
    });
  }

  if (old.attendanceRecords.length > 0) {
    await dest.attendanceRecord.createMany({
      data: old.attendanceRecords.filter((r) => mid(r.userId)).map((r) => ({
        id: r.id, membershipId: mid(r.userId), date: r.date, status: r.status,
        recordedByMembershipId: mid(r.recordedById) ?? r.recordedById,
        recordedAt: r.recordedAt,
      })),
      skipDuplicates: true,
    });
    log(`  AttendanceRecords: ${old.attendanceRecords.length}`);
  }

  if (old.engagements.length > 0) {
    await dest.engagement.createMany({
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
        agreementText: e.agreementText, agreementSentAt: e.agreementSentAt,
        agreementTokenHash: e.agreementTokenHash, signerName: e.signerName,
        signerTitle: e.signerTitle, signedAt: e.signedAt, signerIpAddress: e.signerIpAddress,
        signerUserAgent: e.signerUserAgent, agreementTextHash: e.agreementTextHash,
        consentToElectronicSignature: e.consentToElectronicSignature ?? false,
        agreementReadAndAgreed: e.agreementReadAndAgreed ?? false,
        isTestProposal: e.isTestProposal ?? false, discoveryTokenHash: e.discoveryTokenHash,
        createdByMembershipId: mid(e.createdById),
        createdAt: e.createdAt, updatedAt: e.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  Engagements: ${old.engagements.length}`);
  }

  if (old.proposalDocuments.length > 0) {
    await dest.proposalDocument.createMany({
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
  }

  if (old.proposalPhases.length > 0) {
    await dest.proposalPhase.createMany({
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
    await dest.proposalPhaseItem.createMany({
      data: old.proposalPhaseItems.map((i) => ({
        id: i.id, phaseId: i.phaseId, text: i.text,
        displayOrder: i.displayOrder ?? 100, createdAt: i.createdAt, updatedAt: i.updatedAt,
      })),
      skipDuplicates: true,
    });
  }

  if (old.proposalSections.length > 0) {
    await dest.proposalSection.createMany({
      data: old.proposalSections.map((s) => ({
        id: s.id, proposalId: s.proposalId, sectionKey: s.sectionKey,
        title: s.title, body: s.body, displayOrder: s.displayOrder ?? 100,
        createdAt: s.createdAt, updatedAt: s.updatedAt,
      })),
      skipDuplicates: true,
    });
  }

  if (old.proposalSectionItems.length > 0) {
    await dest.proposalSectionItem.createMany({
      data: old.proposalSectionItems.map((i) => ({
        id: i.id, sectionId: i.sectionId, text: i.text,
        displayOrder: i.displayOrder ?? 100, createdAt: i.createdAt, updatedAt: i.updatedAt,
      })),
      skipDuplicates: true,
    });
  }
  log(`  Proposal documents/phases/sections: done`);

  if (old.proposalPackages.length > 0) {
    await dest.proposalPackage.createMany({
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
    await dest.proposalPackageFeature.createMany({
      data: old.proposalPackageFeatures.map((f) => ({
        id: f.id, packageId: f.packageId, kind: f.kind ?? "INCLUDED",
        shortLabel: f.shortLabel, longDescription: f.longDescription,
        displayOrder: f.displayOrder ?? 100, createdAt: f.createdAt, updatedAt: f.updatedAt,
      })),
      skipDuplicates: true,
    });
  }

  if (old.catalogServices.length > 0) {
    await dest.catalogService.createMany({
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
    await dest.packageService.createMany({
      data: old.packageServices.map((s) => ({
        id: s.id, packageId: s.packageId, serviceId: s.serviceId,
        inclusionType: s.inclusionType ?? "included", notes: s.notes, createdAt: s.createdAt,
      })),
      skipDuplicates: true,
    });
  }

  if (old.pricingRules.length > 0) {
    await dest.pricingRule.createMany({
      data: old.pricingRules.map((r) => ({
        id: r.id, packageId: r.packageId, name: r.name ?? "",
        description: r.description, ruleType: r.ruleType, configJson: r.configJson,
        billingType: r.billingType ?? "recurring", minPrice: r.minPrice, maxPrice: r.maxPrice,
        sortOrder: r.sortOrder ?? 100, createdAt: r.createdAt, updatedAt: r.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  PricingRules: ${old.pricingRules.length}`);
  }

  if (old.firmProfiles.length > 0) {
    await dest.firmProfile.createMany({
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

  if (old.companyRevenueMonths.length > 0) {
    await dest.companyRevenueMonth.createMany({
      data: old.companyRevenueMonths.map((m) => ({
        id: m.id, brandId, monthStart: m.monthStart,
        grossRevenueUsd: m.grossRevenueUsd, notes: m.notes,
        createdAt: m.createdAt, updatedAt: m.updatedAt,
      })),
      skipDuplicates: true,
    });
    log(`  CompanyRevenueMonths: ${old.companyRevenueMonths.length}`);
  }

  await dest.$disconnect();

  console.log("\n✓ Migration complete.");
  console.log("\nNext: node scripts/activateSuperAdmin.cjs");
}

main().catch((e) => {
  console.error("\n✗ Migration failed:", e.message);
  console.error(e.stack);
  process.exit(1);
});
