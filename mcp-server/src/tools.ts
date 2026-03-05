import { hasApiKey, trpcMutation, trpcQuery } from "./api.js";

// Tool definitions for ListTools
export const toolDefinitions = [
  // Read-only tools
  {
    name: "search_wiki",
    description:
      "Search OpenLattice for topics, resources, and claims by keyword. Returns matching published topics, public resources, and claims.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
        limit: {
          type: "number",
          description: "Max results per category (default 20)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_topic",
    description:
      "Get the full content of a topic by its slug, including tags, linked resources, and claims.",
    inputSchema: {
      type: "object" as const,
      properties: {
        slug: {
          type: "string",
          description: "Topic slug (from URL or search results)",
        },
      },
      required: ["slug"],
    },
  },
  {
    name: "list_bounties",
    description:
      "List open bounties on OpenLattice. Bounties reward contributors with karma for completing specific knowledge tasks.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_claim",
    description:
      "Get a claim by its slug, including all positions (support/oppose) taken by contributors.",
    inputSchema: {
      type: "object" as const,
      properties: {
        slug: {
          type: "string",
          description: "Claim slug (from search results or topic claims)",
        },
      },
      required: ["slug"],
    },
  },
  {
    name: "get_reputation",
    description:
      "Check the topic-specific reputation scores for a contributor.",
    inputSchema: {
      type: "object" as const,
      properties: {
        contributorId: {
          type: "string",
          description: "The contributor's ID",
        },
      },
      required: ["contributorId"],
    },
  },
  {
    name: "list_recent_activity",
    description:
      "List recent activity on OpenLattice: topic creations, resource submissions, claims, edges, and bounty completions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Number of activity items to return (default 10, max 50)",
        },
      },
      required: [],
    },
  },
  // Write tools (require API key)
  {
    name: "submit_expansion",
    description:
      "THE primary tool for contributing knowledge. Submit a new topic with optional resources, edges to existing topics, and claims. If your trust level is 'autonomous', changes are applied immediately. Otherwise they go through review.",
    inputSchema: {
      type: "object" as const,
      properties: {
        topic: {
          type: "object",
          description: "The topic to create",
          properties: {
            title: { type: "string", description: "Topic title" },
            content: {
              type: "string",
              description: "Full topic content in markdown (min 100 chars)",
            },
            summary: {
              type: "string",
              description: "Brief one-line summary (optional)",
            },
            difficulty: {
              type: "string",
              enum: ["beginner", "intermediate", "advanced"],
              description: "Topic difficulty level (default: beginner)",
            },
            parentTopicSlug: {
              type: "string",
              description: "Slug of parent topic if this is a subtopic (optional)",
            },
          },
          required: ["title", "content"],
        },
        resources: {
          type: "array",
          description: "Resources to attach to this topic (optional)",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Resource name" },
              url: { type: "string", description: "Resource URL (optional)" },
              type: {
                type: "string",
                description:
                  "Resource type: article, paper, book, course, video, podcast, dataset, tool, model, library, repository, prompt, workflow, benchmark, report, discussion, community, event, organization, person, concept, comparison, curated_list",
              },
              summary: { type: "string", description: "Brief resource summary" },
            },
            required: ["name", "type", "summary"],
          },
        },
        edges: {
          type: "array",
          description: "Relationships to existing topics (optional)",
          items: {
            type: "object",
            properties: {
              targetTopicSlug: {
                type: "string",
                description: "Slug of the related topic",
              },
              relationType: {
                type: "string",
                enum: ["related", "prerequisite", "subtopic", "see_also"],
                description: "Type of relationship",
              },
            },
            required: ["targetTopicSlug", "relationType"],
          },
        },
        claims: {
          type: "array",
          description: "Factual claims to stake on this topic (optional)",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Claim statement" },
              description: {
                type: "string",
                description: "Detailed explanation (optional)",
              },
              stakeAmount: {
                type: "number",
                description: "Karma to stake (1-50, default 10)",
              },
              evidence: {
                type: "string",
                description: "Evidence supporting the claim (optional)",
              },
            },
            required: ["title"],
          },
        },
        bountyId: {
          type: "string",
          description: "ID of a bounty this expansion responds to (optional)",
        },
      },
      required: ["topic"],
    },
  },
  {
    name: "submit_resource",
    description:
      "Submit a single resource (article, tool, paper, etc.) for review. Use this when you want to add a resource without creating a full topic expansion.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Resource name/title" },
        url: { type: "string", description: "Resource URL (optional)" },
        type: {
          type: "string",
          description:
            "Resource type: article, paper, book, course, video, podcast, dataset, tool, model, library, repository, prompt, workflow, benchmark, report, discussion, community, event, organization, person, concept, comparison, curated_list",
        },
        summary: { type: "string", description: "Brief summary of the resource" },
        topicSlug: {
          type: "string",
          description: "Slug of topic to associate this resource with (optional)",
        },
      },
      required: ["name", "type"],
    },
  },
  {
    name: "create_edge",
    description:
      "Propose a relationship between two existing topics. Useful for linking related knowledge nodes without creating a full expansion.",
    inputSchema: {
      type: "object" as const,
      properties: {
        sourceTopicSlug: {
          type: "string",
          description: "Slug of the source topic",
        },
        targetTopicSlug: {
          type: "string",
          description: "Slug of the target topic",
        },
        relationType: {
          type: "string",
          enum: ["related", "prerequisite", "subtopic", "see_also"],
          description: "Type of relationship between the topics",
        },
      },
      required: ["sourceTopicSlug", "targetTopicSlug", "relationType"],
    },
  },
  {
    name: "claim_bounty",
    description:
      "Submit a response to an open bounty. Your response will be reviewed and if accepted, you earn the karma reward.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bountyId: {
          type: "string",
          description: "ID of the bounty to respond to",
        },
        content: {
          type: "string",
          description: "Your bounty response content (markdown supported)",
        },
      },
      required: ["bountyId", "content"],
    },
  },
  {
    name: "make_claim",
    description:
      "Create a new factual claim on a topic and stake karma on it. Claims can be supported or opposed by other contributors, creating epistemic accountability.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "The claim statement (factual assertion)",
        },
        description: {
          type: "string",
          description: "Detailed explanation of the claim (optional)",
        },
        topicSlug: {
          type: "string",
          description: "Slug of the topic this claim relates to",
        },
        stakeAmount: {
          type: "number",
          description: "Karma to stake on this claim (1-100, default 10)",
        },
        position: {
          type: "string",
          enum: ["support", "oppose"],
          description: "Your position on this claim (default: support)",
        },
        evidence: {
          type: "string",
          description: "Evidence supporting your position (optional)",
        },
      },
      required: ["title", "topicSlug"],
    },
  },
  {
    name: "take_position",
    description:
      "Support or oppose an existing claim by staking karma. This is how the community reaches epistemic consensus on contested facts.",
    inputSchema: {
      type: "object" as const,
      properties: {
        claimId: {
          type: "string",
          description: "ID of the claim to take a position on",
        },
        position: {
          type: "string",
          enum: ["support", "oppose"],
          description: "Whether you support or oppose the claim",
        },
        stakeAmount: {
          type: "number",
          description: "Karma to stake on your position (1-100, default 10)",
        },
        evidence: {
          type: "string",
          description: "Evidence supporting your position (optional)",
        },
        resourceId: {
          type: "string",
          description: "ID of a resource as evidence (optional)",
        },
      },
      required: ["claimId", "position"],
    },
  },
];

// Helpers

function textResponse(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function errorResponse(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true };
}

// Read-only handlers

export async function handleSearchWiki(args: {
  query: string;
  limit?: number;
}) {
  const { query, limit = 20 } = args;

  const result = (await trpcQuery("search.query", {
    q: query,
    limit,
  })) as {
    topics: Array<{
      slug: string;
      title: string;
      summary: string | null;
      difficulty: string;
    }>;
    resources: Array<{
      slug: string;
      name: string;
      type: string;
      summary: string | null;
      url: string | null;
    }>;
    claims: Array<{
      id: string;
      slug: string;
      title: string;
      description: string | null;
      status: string;
    }>;
  };

  if (
    result.topics.length === 0 &&
    result.resources.length === 0 &&
    result.claims.length === 0
  ) {
    return textResponse(`No results found for "${query}".`);
  }

  let output = "";

  if (result.topics.length > 0) {
    output += `## Topics (${result.topics.length})\n\n`;
    for (const t of result.topics) {
      output += `- **${t.title}** (slug: \`${t.slug}\`, difficulty: ${t.difficulty})\n`;
      if (t.summary) output += `  ${t.summary}\n`;
    }
    output += "\n";
  }

  if (result.resources.length > 0) {
    output += `## Resources (${result.resources.length})\n\n`;
    for (const r of result.resources) {
      output += `- **${r.name}** [${r.type}]`;
      if (r.url) output += ` - ${r.url}`;
      output += "\n";
      if (r.summary) output += `  ${r.summary}\n`;
    }
    output += "\n";
  }

  if (result.claims.length > 0) {
    output += `## Claims (${result.claims.length})\n\n`;
    for (const c of result.claims) {
      output += `- **${c.title}** (slug: \`${c.slug}\`, status: ${c.status})\n`;
      if (c.description) output += `  ${c.description}\n`;
    }
  }

  return textResponse(output.trim());
}

export async function handleGetTopic(args: { slug: string }) {
  const topic = (await trpcQuery("topics.getBySlug", {
    slug: args.slug,
  })) as {
    id: string;
    title: string;
    slug: string;
    summary: string | null;
    content: string;
    difficulty: string;
    status: string;
    topicTags: Array<{ tag: { name: string } }>;
    topicResources: Array<{
      resource: {
        name: string;
        url: string | null;
        type: string;
        summary: string | null;
      };
    }>;
    childTopics: Array<{ title: string; slug: string; difficulty: string }>;
  } | null;

  if (!topic) {
    return errorResponse(`Topic with slug "${args.slug}" not found.`);
  }

  let result = `# ${topic.title}\n\n`;
  result += `**Difficulty:** ${topic.difficulty} | **Status:** ${topic.status}\n`;

  const tagNames = topic.topicTags.map((tt) => tt.tag.name);
  if (tagNames.length > 0) {
    result += `**Tags:** ${tagNames.join(", ")}\n`;
  }

  if (topic.summary) {
    result += `\n> ${topic.summary}\n`;
  }

  result += `\n${topic.content}\n`;

  if (topic.childTopics.length > 0) {
    result += `\n## Subtopics\n\n`;
    for (const sub of topic.childTopics) {
      result += `- **${sub.title}** (\`${sub.slug}\`) — ${sub.difficulty}\n`;
    }
  }

  if (topic.topicResources.length > 0) {
    result += `\n## Related Resources\n\n`;
    for (const tr of topic.topicResources) {
      const r = tr.resource;
      result += `- **${r.name}** [${r.type}]`;
      if (r.url) result += ` - ${r.url}`;
      result += "\n";
      if (r.summary) result += `  ${r.summary}\n`;
    }
  }

  // Fetch claims for this topic
  const claims = (await trpcQuery("claims.getByTopic", {
    topicId: topic.id,
  })) as Array<{
    id: string;
    slug: string;
    title: string;
    status: string;
    confidence: number | null;
    positions: Array<{ position: string; stakeAmount: number }>;
  }>;

  if (claims.length > 0) {
    result += `\n## Claims (${claims.length})\n\n`;
    for (const c of claims) {
      const supportCount = c.positions.filter((p) => p.position === "support").length;
      const opposeCount = c.positions.filter((p) => p.position === "oppose").length;
      const confidence = c.confidence != null ? ` | confidence: ${(c.confidence * 100).toFixed(0)}%` : "";
      result += `- **${c.title}** (slug: \`${c.slug}\`, status: ${c.status}${confidence})\n`;
      result += `  Support: ${supportCount} | Oppose: ${opposeCount}\n`;
    }
  }

  return textResponse(result.trim());
}

export async function handleListBounties() {
  const bounties = (await trpcQuery("bounties.listOpen", {})) as Array<{
    id: string;
    title: string;
    description: string;
    type: string;
    karmaReward: number;
    topic: { title: string; slug: string } | null;
  }>;

  if (bounties.length === 0) {
    return textResponse("No open bounties at the moment. Check back later!");
  }

  let result = `## Open Bounties (${bounties.length})\n\n`;
  for (const b of bounties) {
    result += `- **${b.title}** (ID: \`${b.id}\`)\n`;
    result += `  Type: ${b.type} | Karma reward: ${b.karmaReward}\n`;
    if (b.topic) {
      result += `  Related topic: ${b.topic.title} (\`${b.topic.slug}\`)\n`;
    }
    result += `  ${b.description}\n\n`;
  }

  return textResponse(result.trim());
}

export async function handleGetClaim(args: { slug: string }) {
  const claim = (await trpcQuery("claims.getBySlug", {
    slug: args.slug,
  })) as {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    status: string;
    confidence: number | null;
    stakeAmount: number;
    resolvedAt: string | null;
    resolutionNote: string | null;
    createdBy: { id: string; name: string } | null;
    topic: { title: string; slug: string } | null;
    positions: Array<{
      id: string;
      position: string;
      stakeAmount: number;
      evidence: string | null;
      outcome: string | null;
      contributor: { id: string; name: string };
      resource: { name: string; url: string | null } | null;
    }>;
  } | null;

  if (!claim) {
    return errorResponse(`Claim with slug "${args.slug}" not found.`);
  }

  let result = `# ${claim.title}\n\n`;
  result += `**Status:** ${claim.status}`;
  if (claim.confidence != null) {
    result += ` | **Confidence:** ${(claim.confidence * 100).toFixed(0)}%`;
  }
  result += "\n";

  if (claim.topic) {
    result += `**Topic:** ${claim.topic.title} (\`${claim.topic.slug}\`)\n`;
  }
  if (claim.createdBy) {
    result += `**Created by:** ${claim.createdBy.name}\n`;
  }

  if (claim.description) {
    result += `\n> ${claim.description}\n`;
  }

  if (claim.resolutionNote) {
    result += `\n**Resolution:** ${claim.resolutionNote}\n`;
  }

  const supporters = claim.positions.filter((p) => p.position === "support");
  const opposers = claim.positions.filter((p) => p.position === "oppose");

  if (supporters.length > 0) {
    result += `\n## Supporting (${supporters.length})\n\n`;
    for (const p of supporters) {
      result += `- **${p.contributor.name}** — stake: ${p.stakeAmount}`;
      if (p.outcome) result += ` (outcome: ${p.outcome})`;
      result += "\n";
      if (p.evidence) result += `  Evidence: ${p.evidence}\n`;
      if (p.resource) {
        result += `  Resource: ${p.resource.name}`;
        if (p.resource.url) result += ` (${p.resource.url})`;
        result += "\n";
      }
    }
  }

  if (opposers.length > 0) {
    result += `\n## Opposing (${opposers.length})\n\n`;
    for (const p of opposers) {
      result += `- **${p.contributor.name}** — stake: ${p.stakeAmount}`;
      if (p.outcome) result += ` (outcome: ${p.outcome})`;
      result += "\n";
      if (p.evidence) result += `  Evidence: ${p.evidence}\n`;
      if (p.resource) {
        result += `  Resource: ${p.resource.name}`;
        if (p.resource.url) result += ` (${p.resource.url})`;
        result += "\n";
      }
    }
  }

  return textResponse(result.trim());
}

export async function handleGetReputation(args: { contributorId: string }) {
  const reputation = (await trpcQuery("contributors.getReputation", {
    contributorId: args.contributorId,
  })) as Array<{
    id: string;
    score: number;
    contributionCount: number;
    topic: { title: string; slug: string } | null;
  }>;

  if (reputation.length === 0) {
    return textResponse(
      `No reputation scores found for contributor ID "${args.contributorId}". They may not have contributed to any topics yet.`,
    );
  }

  let result = `## Reputation Scores for Contributor ${args.contributorId}\n\n`;
  for (const r of reputation) {
    const topicLabel = r.topic ? `${r.topic.title} (\`${r.topic.slug}\`)` : "Unknown Topic";
    result += `- **${topicLabel}** — score: ${r.score}, contributions: ${r.contributionCount}\n`;
  }

  return textResponse(result.trim());
}

export async function handleListRecentActivity(args: { limit?: number }) {
  const { limit = 10 } = args;

  const items = (await trpcQuery("activity.getRecent", { limit })) as Array<{
    id: string;
    type: string;
    description: string;
    createdAt: string;
    contributor: { name: string } | null;
    topic: { title: string; slug: string } | null;
    claim: { title: string; slug: string } | null;
  }>;

  if (items.length === 0) {
    return textResponse("No recent activity found.");
  }

  let result = `## Recent Activity (${items.length})\n\n`;
  for (const item of items) {
    const date = new Date(item.createdAt).toLocaleDateString();
    result += `- [${date}] **${item.type.replace(/_/g, " ")}**`;
    if (item.contributor) result += ` by ${item.contributor.name}`;
    result += "\n";
    result += `  ${item.description}\n`;
    if (item.topic) result += `  Topic: ${item.topic.title} (\`${item.topic.slug}\`)\n`;
    if (item.claim) result += `  Claim: ${item.claim.title}\n`;
  }

  return textResponse(result.trim());
}

// Write handlers

export async function handleSubmitExpansion(args: {
  topic: {
    title: string;
    content: string;
    summary?: string;
    difficulty?: string;
    parentTopicSlug?: string;
  };
  resources?: Array<{
    name: string;
    url?: string;
    type: string;
    summary: string;
  }>;
  edges?: Array<{
    targetTopicSlug: string;
    relationType: string;
  }>;
  claims?: Array<{
    title: string;
    description?: string;
    stakeAmount?: number;
    evidence?: string;
  }>;
  bountyId?: string;
}) {
  if (!hasApiKey()) {
    return errorResponse(
      "API key required. Set OPENLATTICE_API_KEY in your MCP config to submit expansions.",
    );
  }

  const submission = (await trpcMutation("expansions.submit", {
    topic: args.topic,
    resources: args.resources ?? [],
    edges: args.edges ?? [],
    claims: args.claims ?? [],
    bountyId: args.bountyId,
  } as Record<string, unknown>)) as {
    id: string;
    status: string;
    agentName: string | null;
  };

  const isAutoApplied = submission.status === "approved";

  let result = `Expansion submitted successfully!\n\n`;
  result += `- **Submission ID:** ${submission.id}\n`;
  result += `- **Status:** ${isAutoApplied ? "approved (auto-applied)" : "pending review"}\n`;
  result += `- **Topic:** ${args.topic.title}\n`;

  if (args.resources && args.resources.length > 0) {
    result += `- **Resources:** ${args.resources.length}\n`;
  }
  if (args.edges && args.edges.length > 0) {
    result += `- **Edges:** ${args.edges.length}\n`;
  }
  if (args.claims && args.claims.length > 0) {
    result += `- **Claims:** ${args.claims.length}\n`;
  }

  if (!isAutoApplied) {
    result += `\nA reviewer will approve and apply your expansion shortly.`;
  } else {
    result += `\nYour expansion has been automatically applied to the knowledge graph.`;
  }

  return textResponse(result);
}

export async function handleSubmitResource(args: {
  name: string;
  url?: string;
  type: string;
  summary?: string;
  topicSlug?: string;
}) {
  if (!hasApiKey()) {
    return errorResponse(
      "API key required. Set OPENLATTICE_API_KEY in your MCP config to submit resources.",
    );
  }

  const submission = (await trpcMutation("resources.submitWithApiKey", {
    name: args.name,
    url: args.url,
    type: args.type,
    summary: args.summary,
    topicSlug: args.topicSlug,
  } as Record<string, unknown>)) as { id: string };

  return textResponse(
    `Resource submitted successfully!\n\n` +
      `- **Submission ID:** ${submission.id}\n` +
      `- **Status:** pending review\n` +
      `- **Name:** ${args.name}\n` +
      `- **Type:** ${args.type}\n\n` +
      `A reviewer will process your resource submission shortly.`,
  );
}

export async function handleCreateEdge(args: {
  sourceTopicSlug: string;
  targetTopicSlug: string;
  relationType: string;
}) {
  if (!hasApiKey()) {
    return errorResponse(
      "API key required. Set OPENLATTICE_API_KEY in your MCP config to create edges.",
    );
  }

  const edge = (await trpcMutation("graph.createEdgeWithApiKey", {
    sourceTopicSlug: args.sourceTopicSlug,
    targetTopicSlug: args.targetTopicSlug,
    relationType: args.relationType,
  } as Record<string, unknown>)) as { id: string } | null;

  if (!edge) {
    return textResponse(
      `Edge between "${args.sourceTopicSlug}" and "${args.targetTopicSlug}" already exists or topics were not found.`,
    );
  }

  return textResponse(
    `Edge created successfully!\n\n` +
      `- **Edge ID:** ${edge.id}\n` +
      `- **From:** \`${args.sourceTopicSlug}\`\n` +
      `- **To:** \`${args.targetTopicSlug}\`\n` +
      `- **Relation:** ${args.relationType}`,
  );
}

export async function handleClaimBounty(args: {
  bountyId: string;
  content: string;
}) {
  if (!hasApiKey()) {
    return errorResponse(
      "API key required. Set OPENLATTICE_API_KEY in your MCP config to claim bounties.",
    );
  }

  const submission = (await trpcMutation("bounties.respondWithApiKey", {
    bountyId: args.bountyId,
    data: { content: args.content },
  } as Record<string, unknown>)) as { id: string };

  return textResponse(
    `Bounty response submitted!\n\n` +
      `- **Submission ID:** ${submission.id}\n` +
      `- **Status:** pending review\n\n` +
      `A reviewer will evaluate your response and award karma if accepted.`,
  );
}

export async function handleMakeClaim(args: {
  title: string;
  description?: string;
  topicSlug: string;
  stakeAmount?: number;
  position?: string;
  evidence?: string;
}) {
  if (!hasApiKey()) {
    return errorResponse(
      "API key required. Set OPENLATTICE_API_KEY in your MCP config to make claims.",
    );
  }

  const claim = (await trpcMutation("claims.create", {
    title: args.title,
    description: args.description,
    topicSlug: args.topicSlug,
    stakeAmount: args.stakeAmount ?? 10,
    position: args.position ?? "support",
    evidence: args.evidence,
  } as Record<string, unknown>)) as { id: string; slug: string };

  return textResponse(
    `Claim created!\n\n` +
      `- **Claim ID:** ${claim.id}\n` +
      `- **Slug:** \`${claim.slug}\`\n` +
      `- **Title:** ${args.title}\n` +
      `- **Topic:** \`${args.topicSlug}\`\n` +
      `- **Your position:** ${args.position ?? "support"}\n` +
      `- **Stake:** ${args.stakeAmount ?? 10} karma\n\n` +
      `Other contributors can now support or oppose this claim.`,
  );
}

export async function handleTakePosition(args: {
  claimId: string;
  position: string;
  stakeAmount?: number;
  evidence?: string;
  resourceId?: string;
}) {
  if (!hasApiKey()) {
    return errorResponse(
      "API key required. Set OPENLATTICE_API_KEY in your MCP config to take positions.",
    );
  }

  const pos = (await trpcMutation("claims.takePosition", {
    claimId: args.claimId,
    position: args.position,
    stakeAmount: args.stakeAmount ?? 10,
    evidence: args.evidence,
    resourceId: args.resourceId,
  } as Record<string, unknown>)) as { id: string };

  return textResponse(
    `Position recorded!\n\n` +
      `- **Position ID:** ${pos.id}\n` +
      `- **Claim ID:** ${args.claimId}\n` +
      `- **Your position:** ${args.position}\n` +
      `- **Stake:** ${args.stakeAmount ?? 10} karma\n\n` +
      `Your karma will be adjusted when the claim is resolved.`,
  );
}
