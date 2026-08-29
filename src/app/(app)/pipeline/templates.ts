import { PipelineType } from "@prisma/client";

export type StageTemplate = {
  key: string;
  name: string;
  description: string;
  valueMultiplier: number;
  isTerminal?: boolean;
};

export type PipelineTemplate = {
  key: string;
  name: string;
  type: PipelineType;
  description: string;
  stages: StageTemplate[];
};

export type TemplateKey = "PROSPECTS" | "LEADS" | "CLIENT_PHASE_1" | "CLIENT_PHASE_2";

export const PIPELINE_TEMPLATES: Record<TemplateKey, PipelineTemplate> = {
  PROSPECTS: {
    key: "prospects",
    name: "Prospects Pipeline",
    type: PipelineType.PROSPECTS,
    description:
      "Qualify and educate prospects, validate scope, and convert to client after Phase 1 payment and signed agreement.",
    stages: [
      { key: "education-interest", name: "Education + Interest Confirmation", description: "Prospect is learning our services and confirming they want to move forward.", valueMultiplier: 0.01 },
      { key: "qbo-invite-requested", name: "QBO Invite Requested", description: "Prospect has been asked to invite us into QuickBooks Online.", valueMultiplier: 0.08 },
      { key: "qbo-access-received", name: "QBO Access Received", description: "QBO access is verified and assessment can begin.", valueMultiplier: 0.18 },
      { key: "scope-assessment", name: "Scope Assessment + Verification", description: "We assess the books and verify service scope for Phase 1 and completion estimate.", valueMultiplier: 0.35 },
      { key: "phase1-quote-sent", name: "Phase 1 Quote Sent", description: "Phase 1 (Onboarding & Discovery) quote and completion estimate are sent.", valueMultiplier: 0.55 },
      { key: "phase1-paid", name: "Phase 1 Paid", description: "Prospect has paid for Phase 1 work.", valueMultiplier: 0.72 },
      { key: "agreement-signed", name: "Agreement Signed", description: "Phase 1 agreement is signed and ready for handoff.", valueMultiplier: 0.86 },
      { key: "client-converted", name: "Converted To Client", description: "Prospect is now a client and moves into post-sale workflows.", valueMultiplier: 1, isTerminal: true },
    ],
  },
  LEADS: {
    key: "leads",
    name: "Leads Pipeline",
    type: PipelineType.LEADS,
    description:
      "Track top-of-funnel leads from first contact through qualification and transition into the prospects pipeline.",
    stages: [
      { key: "new-lead", name: "New Lead", description: "Lead created and awaiting first outreach.", valueMultiplier: 0.01 },
      { key: "contacted", name: "Contacted", description: "Initial outreach sent or call completed.", valueMultiplier: 0.15 },
      { key: "discovery-booked", name: "Discovery Booked", description: "Discovery call is scheduled.", valueMultiplier: 0.4 },
      { key: "qualified", name: "Qualified", description: "Lead is qualified and ready to move into prospects pipeline.", valueMultiplier: 0.9 },
      { key: "nurture", name: "Nurture", description: "Still a fit, but not ready to proceed now.", valueMultiplier: 0.2 },
      { key: "closed-lost", name: "Closed Lost", description: "Lead is no longer active.", valueMultiplier: 0, isTerminal: true },
      { key: "convert-to-client", name: "Convert To Client", description: "Convert this lead into a client and move into Client Phase 1 pipeline.", valueMultiplier: 1, isTerminal: true },
    ],
  },
  CLIENT_PHASE_1: {
    key: "client-phase-1",
    name: "Client Phase 1 Pipeline",
    type: PipelineType.CUSTOM,
    description:
      "Phase 1 onboarding and discovery workflow: collect docs/info, verify scope against agreement, and finalize onboarding handoff.",
    stages: [
      { key: "kickoff-intake", name: "Kickoff + Intake", description: "Kickoff complete and intake initiated.", valueMultiplier: 0.2 },
      { key: "docs-and-access", name: "Docs + Access Collection", description: "Collect required docs, systems, and account access.", valueMultiplier: 0.4 },
      { key: "scope-verification", name: "Scope Verification", description: "Verify scope aligns with agreement and propose updates if needed.", valueMultiplier: 0.65 },
      { key: "phase1-work-complete", name: "Phase 1 Complete", description: "Onboarding/discovery complete and ready for service pipeline handoff.", valueMultiplier: 1, isTerminal: true },
    ],
  },
  CLIENT_PHASE_2: {
    key: "client-phase-2",
    name: "Client Phase 2 Pipeline",
    type: PipelineType.CUSTOM,
    description:
      "Post-onboarding client service workflow for recurring bookkeeping execution, review, and stabilization.",
    stages: [
      { key: "service-kickoff", name: "Service Kickoff", description: "Transition from onboarding into recurring service cadence.", valueMultiplier: 0.2 },
      { key: "books-cleanup-and-baseline", name: "Books Cleanup + Baseline", description: "Catch-up, reconcile, and establish baseline operating cadence.", valueMultiplier: 0.5 },
      { key: "steady-state-delivery", name: "Steady-State Delivery", description: "Recurring bookkeeping delivery is stable and on schedule.", valueMultiplier: 0.8 },
      { key: "phase2-stable", name: "Phase 2 Stable", description: "Client fully stabilized in long-term service operations.", valueMultiplier: 1, isTerminal: true },
    ],
  },
};
