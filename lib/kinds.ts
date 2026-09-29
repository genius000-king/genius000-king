export type ProjectKind = "site" | "bot" | "tool";

export const KINDS: Record<ProjectKind, { label: string; blurb: string }> = {
  site: {
    label: "Sites",
    blurb: "Pages served from this app and routed by domain or subdomain.",
  },
  bot: {
    label: "Bots",
    blurb: "Webhook-driven bots for Telegram, Discord and similar platforms.",
  },
  tool: {
    label: "Tools",
    blurb: "Any library or service, run on the cheapest runner that fits.",
  },
};
