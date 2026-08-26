export type ProposalThemeId = "brand" | "classic" | "executive" | "modern" | "prestige";

export type ProposalTheme = {
  id: ProposalThemeId;
  label: string;
  description: string;
  primary: string | null; // null = use brand CSS var
  accent: string | null;  // null = use brand CSS var
  pageBg: string;
};

export const PROPOSAL_THEMES: ProposalTheme[] = [
  {
    id: "brand",
    label: "Brand",
    description: "Your configured brand colors from Settings",
    primary: null,
    accent: null,
    pageBg: "linear-gradient(180deg,#f7f8fb 0%,#ffffff 100%)",
  },
  {
    id: "classic",
    label: "Classic",
    description: "Deep navy with warm gold — traditional professional services",
    primary: "#1b3a5c",
    accent: "#c9922a",
    pageBg: "linear-gradient(180deg,#eef2f7 0%,#ffffff 100%)",
  },
  {
    id: "executive",
    label: "Executive",
    description: "Near-black with amber — refined and premium",
    primary: "#1c1c1e",
    accent: "#d97706",
    pageBg: "linear-gradient(180deg,#f5f5f5 0%,#ffffff 100%)",
  },
  {
    id: "modern",
    label: "Modern",
    description: "Midnight slate with sapphire — contemporary and sharp",
    primary: "#1e293b",
    accent: "#2563eb",
    pageBg: "linear-gradient(180deg,#f8fafc 0%,#ffffff 100%)",
  },
  {
    id: "prestige",
    label: "Prestige",
    description: "Bottle green with champagne gold — wealth management aesthetic",
    primary: "#0f2d1a",
    accent: "#c9a84c",
    pageBg: "linear-gradient(180deg,#f0f7f2 0%,#ffffff 100%)",
  },
];

export function getProposalTheme(id: string): ProposalTheme {
  return PROPOSAL_THEMES.find((t) => t.id === id) ?? PROPOSAL_THEMES[0];
}
