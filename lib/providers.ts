export const PROVIDERS = {
  lootlabs: {
    id: "lootlabs",
    name: "LootLabs",
    description: "Rewarded monetization links and task completions.",
    fields: [
      { key: "apiKey", label: "API key", secret: true },
      { key: "linkTemplate", label: "Monetized link / template", secret: false }
    ]
  },
  linkvertise: {
    id: "linkvertise",
    name: "Linkvertise",
    description: "Monetized links for key checkpoints.",
    fields: [
      { key: "publisherId", label: "Publisher / account ID", secret: false },
      { key: "apiKey", label: "API key / secret", secret: true },
      { key: "linkTemplate", label: "Link template", secret: false }
    ]
  },
  boostellar: {
    id: "boostellar",
    name: "Boostellar",
    description: "External monetization provider for key checkpoints.",
    fields: [
      { key: "apiKey", label: "API key / secret", secret: true },
      { key: "linkTemplate", label: "Link / template", secret: false }
    ]
  }
} as const;

export type ProviderId = keyof typeof PROVIDERS;
