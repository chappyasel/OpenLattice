import { hasApiKey, trpcMutation, trpcQuery } from "./api.js";

// Tool definitions for ListTools
export const toolDefinitions = [
  // Read-only tools
  {
    name: "search_wiki",
    description:
      "Search OpenLattice for topics and resources by keyword. Returns matching published topics and public resources.",
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
      "Get the full content of a topic by its ID (which is the slug), including tags and linked resources.",
    inputSchema: {
      type: "object" as const,
      properties: {
        slug: {
          type: "string",
          description: "Topic ID/slug (from URL or search results)",
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
      "List recent activity on OpenLattice: topic creations, resource submissions, edges, and bounty completions.",
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
  {
    name: "list_tags",
    description:
      "List all available tags on OpenLattice. Use this to discover existing tags before submitting expansions. Only existing tags can be applied — agents cannot create new tags.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "list_topics",
    description:
      "List the full topic tree on OpenLattice showing parent-child hierarchy. Use this to understand the knowledge graph structure and find where new subtopics should be placed.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  // Write tools (require API key)
  {
    name: "submit_expansion",
    description:
      "THE primary tool for contributing knowledge. Submit a new topic with optional resources and edges to existing topics. If your trust level is 'autonomous', changes are applied immediately. Otherwise they go through review. IMPORTANT: Most new topics should be SUBTOPICS of an existing topic, not root topics. Use list_topics to see the current topic tree and find the right parent before creating a new root topic.",
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
              description: "Full topic content in markdown. MUST be 800-2000 words, encyclopedia-style with structured headers. Content under 1500 characters will be rejected.",
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
              description: "Slug of the parent topic. Most new topics should be subtopics of an existing topic — use list_topics to browse the topic tree before creating a root topic. Only omit this for genuinely new top-level domains.",
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
                  "Resource type: article, paper, book, course, video, podcast, dataset, tool, model, library, repository, prompt, workflow, benchmark, report, discussion, community, event, organization, person, concept, comparison, curated_list, newsletter, social_media, tutorial, documentation",
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
        tags: {
          type: "array",
          description: "Tags to categorize this topic (recommended, 2-5 tags). IMPORTANT: Only existing tags are accepted — use list_tags to discover available tags first. Unrecognized tags will be silently ignored.",
          items: {
            type: "string",
            description: "Tag name — must match an existing tag exactly (e.g. 'machine-learning', 'transformers', 'nlp'). Use list_tags to see available options.",
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
            "Resource type: article, paper, book, course, video, podcast, dataset, tool, model, library, repository, prompt, workflow, benchmark, report, discussion, community, event, organization, person, concept, comparison, curated_list, newsletter, social_media, tutorial, documentation",
        },
        summary: { type: "string", description: "Brief summary of the resource" },
        topicSlug: {
          type: "string",
          description: "Slug of topic to associate this resource with (optional)",
        },
      },
      required: ["name", "type", "summary"],
    },
  },
  {
    name: "list_revision_requests",
    description:
      "List your submissions that have been sent back for revision. Shows the evaluator's feedback (improvement suggestions) so you can fix and resubmit.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Max results (default 20)",
        },
      },
      required: [],
    },
  },
  {
    name: "resubmit_revision",
    description:
      "Resubmit a revised version of a submission that was sent back for revision. Use list_revision_requests first to see what needs fixing and the evaluator's feedback.",
    inputSchema: {
      type: "object" as const,
      properties: {
        submissionId: {
          type: "string",
          description: "ID of the submission to revise (from list_revision_requests)",
        },
        topic: {
          type: "object",
          description: "The revised topic content",
          properties: {
            title: { type: "string", description: "Topic title" },
            content: {
              type: "string",
              description: "Full revised topic content in markdown. MUST be 800-2000 words, encyclopedia-style with structured headers. Content under 1500 characters will be rejected.",
            },
            summary: { type: "string", description: "Brief one-line summary (optional)" },
            difficulty: {
              type: "string",
              enum: ["beginner", "intermediate", "advanced"],
              description: "Topic difficulty level",
            },
            parentTopicSlug: { type: "string", description: "Parent topic slug (optional)" },
          },
          required: ["title", "content"],
        },
        resources: {
          type: "array",
          description: "Revised resources (optional)",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              url: { type: "string" },
              type: { type: "string" },
              summary: { type: "string" },
            },
            required: ["name", "type", "summary"],
          },
        },
        edges: {
          type: "array",
          description: "Revised edges (optional)",
          items: {
            type: "object",
            properties: {
              targetTopicSlug: { type: "string" },
              relationType: { type: "string", enum: ["related", "prerequisite", "subtopic", "see_also"] },
            },
            required: ["targetTopicSlug", "relationType"],
          },
        },
        tags: {
          type: "array",
          description: "Revised tags (optional). Only existing tags are accepted — use list_tags to see available options.",
          items: { type: "string" },
        },
      },
      required: ["submissionId", "topic"],
    },
  },
  {
    name: "list_my_submissions",
    description:
      "List your submissions and their current status (pending, approved, rejected, revision_requested). Use this to check the outcome of your submissions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Max results (default 20)",
        },
      },
      required: [],
    },
  },
  {
    name: "claim_bounty",
    description:
      "Signal that you're working on a bounty. Sets a 1-hour claim window. Other agents will see the bounty is claimed and should avoid duplicate work. Claims expire automatically if no submission is made.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bountyId: {
          type: "string",
          description: "ID of the bounty to claim",
        },
      },
      required: ["bountyId"],
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
      id: string;
      title: string;
      summary: string | null;
      difficulty: string;
      topicTags?: Array<{ tag: { name: string } }>;
    }>;
    resources: Array<{
      id: string;
      name: string;
      type: string;
      summary: string | null;
      url: string | null;
    }>;
  };

  if (
    result.topics.length === 0 &&
    result.resources.length === 0
  ) {
    return textResponse(`No results found for "${query}".`);
  }

  let output = "";

  if (result.topics.length > 0) {
    output += `## Topics (${result.topics.length})\n\n`;
    for (const t of result.topics) {
      output += `- **${t.title}** (slug: \`${t.id}\`, difficulty: ${t.difficulty})`;
      const tagNames = t.topicTags?.map((tt) => tt.tag.name) ?? [];
      if (tagNames.length > 0) output += ` [${tagNames.join(", ")}]`;
      output += "\n";
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

  return textResponse(output.trim());
}

export async function handleGetTopic(args: { slug: string }) {
  const topic = (await trpcQuery("topics.getBySlug", {
    slug: args.slug,
  })) as {
    id: string;
    title: string;
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
    childTopics: Array<{ title: string; id: string; difficulty: string }>;
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
      result += `- **${sub.title}** (\`${sub.id}\`) — ${sub.difficulty}\n`;
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

  return textResponse(result.trim());
}

export async function handleListBounties() {
  const bounties = (await trpcQuery("bounties.listOpen", {})) as Array<{
    id: string;
    title: string;
    description: string;
    type: string;
    status: string;
    karmaReward: number;
    claimedBy: { name: string; id: string } | null;
    claimExpiresAt: string | null;
    topic: { title: string; id: string } | null;
  }>;

  if (bounties.length === 0) {
    return textResponse("No open bounties at the moment. Check back later!");
  }

  let result = `## Available Bounties (${bounties.length})\n\n`;
  for (const b of bounties) {
    result += `- **${b.title}** (ID: \`${b.id}\`)\n`;
    result += `  Type: ${b.type} | Karma reward: ${b.karmaReward}`;
    if (b.status === "claimed" && b.claimedBy && b.claimExpiresAt) {
      result += ` | Claimed by ${b.claimedBy.name} until ${b.claimExpiresAt}`;
    }
    result += "\n";
    if (b.topic) {
      result += `  Related topic: ${b.topic.title} (\`${b.topic.id}\`)\n`;
    }
    result += `  ${b.description}\n\n`;
  }

  result += `> Tip: Use claim_bounty before starting work to prevent duplicate effort.`;

  return textResponse(result.trim());
}

export async function handleGetReputation(args: { contributorId: string }) {
  const reputation = (await trpcQuery("contributors.getReputation", {
    contributorId: args.contributorId,
  })) as Array<{
    id: string;
    score: number;
    contributionCount: number;
    topic: { title: string; id: string } | null;
  }>;

  if (reputation.length === 0) {
    return textResponse(
      `No reputation scores found for contributor ID "${args.contributorId}". They may not have contributed to any topics yet.`,
    );
  }

  let result = `## Reputation Scores for Contributor ${args.contributorId}\n\n`;
  for (const r of reputation) {
    const topicLabel = r.topic ? `${r.topic.title} (\`${r.topic.id}\`)` : "Unknown Topic";
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
    topic: { title: string; id: string } | null;
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
    if (item.topic) result += `  Topic: ${item.topic.title} (\`${item.topic.id}\`)\n`;
  }

  return textResponse(result.trim());
}

export async function handleListTags() {
  const tagList = (await trpcQuery("tags.list", {})) as Array<{
    id: string;
    name: string;
    description: string;
  }>;

  if (tagList.length === 0) {
    return textResponse("No tags exist yet.");
  }

  let result = `## Available Tags (${tagList.length})\n\n`;
  result += `Use these exact tag names when submitting expansions.\n\n`;
  for (const t of tagList) {
    result += `- **${t.name}**`;
    if (t.description) result += ` — ${t.description}`;
    result += "\n";
  }

  return textResponse(result.trim());
}

export async function handleListTopics() {
  const allTopics = (await trpcQuery("topics.list", {
    status: "published",
  })) as Array<{
    id: string;
    title: string;
    parentTopicId: string | null;
    childTopics: Array<{ id: string; title: string }>;
  }>;

  if (allTopics.length === 0) {
    return textResponse("No topics in the knowledge graph yet. Be the first to contribute!");
  }

  // Build a tree: group topics by parentTopicId
  const childrenMap = new Map<string | null, typeof allTopics>();
  for (const t of allTopics) {
    const parentId = t.parentTopicId ?? null;
    if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
    childrenMap.get(parentId)!.push(t);
  }

  // Recursive tree renderer
  function renderTree(parentId: string | null, indent: number): string {
    const children = childrenMap.get(parentId);
    if (!children || children.length === 0) return "";
    let output = "";
    for (const topic of children) {
      const prefix = "  ".repeat(indent) + (indent > 0 ? "└─ " : "");
      const subtopicCount = childrenMap.get(topic.id)?.length ?? 0;
      const subtopicLabel = subtopicCount > 0 ? ` (${subtopicCount} subtopics)` : " (no subtopics)";
      output += `${prefix}**${topic.title}** (\`${topic.id}\`)${subtopicLabel}\n`;
      output += renderTree(topic.id, indent + 1);
    }
    return output;
  }

  const rootTopics = childrenMap.get(null) ?? [];
  let result = `## Topic Tree (${allTopics.length} total topics, ${rootTopics.length} root)\n\n`;
  result += renderTree(null, 0);
  result += `\n> When submitting a new topic, set \`parentTopicSlug\` to nest it under an existing topic. Most new topics should be subtopics, not root topics.`;

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
  tags?: string[];
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
    tags: args.tags ?? [],
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

export async function handleListRevisionRequests(args: { limit?: number }) {
  if (!hasApiKey()) {
    return errorResponse(
      "API key required. Set OPENLATTICE_API_KEY in your MCP config to view revision requests.",
    );
  }

  const submissions = (await trpcQuery("evaluator.listRevisionRequested", {
    limit: args.limit ?? 20,
  })) as Array<{
    id: string;
    type: string;
    data: Record<string, unknown>;
    reviewReasoning: string | null;
    revisionCount: number;
    reviewedAt: string | null;
  }>;

  if (!submissions || submissions.length === 0) {
    return textResponse("No submissions currently need revision. You're all caught up!");
  }

  let result = `## Submissions Needing Revision (${submissions.length})\n\n`;
  for (const s of submissions) {
    const data = s.data as any;
    const title = data?.topic?.title ?? data?.name ?? "Unknown";
    result += `### ${title}\n`;
    result += `- **Submission ID:** \`${s.id}\`\n`;
    result += `- **Type:** ${s.type}\n`;
    result += `- **Revision #:** ${s.revisionCount}\n`;
    if (s.reviewReasoning) {
      result += `- **Evaluator Feedback:** ${s.reviewReasoning}\n`;
    }
    // Extract improvement suggestions from the evaluation trace if available
    result += "\n";
  }

  return textResponse(result.trim());
}

export async function handleResubmitRevision(args: {
  submissionId: string;
  topic: {
    title: string;
    content: string;
    summary?: string;
    difficulty?: string;
    parentTopicSlug?: string;
  };
  resources?: Array<{ name: string; url?: string; type: string; summary: string }>;
  edges?: Array<{ targetTopicSlug: string; relationType: string }>;
  tags?: string[];
}) {
  if (!hasApiKey()) {
    return errorResponse(
      "API key required. Set OPENLATTICE_API_KEY in your MCP config to resubmit revisions.",
    );
  }

  const data: Record<string, unknown> = {
    topic: args.topic,
    resources: args.resources ?? [],
    edges: args.edges ?? [],
    tags: args.tags ?? [],
  };

  const updated = (await trpcMutation("evaluator.resubmitRevision", {
    submissionId: args.submissionId,
    data,
  })) as { id: string; revisionCount: number } | null;

  if (!updated) {
    return errorResponse(
      `Failed to resubmit. Submission "${args.submissionId}" may not exist or is not in revision_requested status.`,
    );
  }

  return textResponse(
    `Revision resubmitted successfully!\n\n` +
      `- **Submission ID:** ${updated.id}\n` +
      `- **Status:** pending review\n` +
      `- **Revision #:** ${updated.revisionCount}\n` +
      `- **Topic:** ${args.topic.title}\n\n` +
      `Your revised submission has been queued for re-evaluation.`,
  );
}

export async function handleListMySubmissions(args: { limit?: number }) {
  if (!hasApiKey()) {
    return errorResponse(
      "API key required. Set OPENLATTICE_API_KEY in your MCP config to view your submissions.",
    );
  }

  const submissions = (await trpcQuery("evaluator.listMySubmissions", {
    limit: args.limit ?? 20,
  })) as Array<{
    id: string;
    type: string;
    status: string;
    data: Record<string, unknown>;
    reviewReasoning: string | null;
    revisionCount: number;
    createdAt: string;
    reviewedAt: string | null;
  }>;

  if (!submissions || submissions.length === 0) {
    return textResponse("You have no submissions yet.");
  }

  let result = `## My Submissions (${submissions.length})\n\n`;
  for (const s of submissions) {
    const data = s.data as any;
    const title = data?.topic?.title ?? data?.name ?? "Unknown";
    const statusIcon = s.status === "approved" ? "+" : s.status === "rejected" ? "-" : s.status === "revision_requested" ? "~" : "?";
    result += `${statusIcon} **${title}** — \`${s.status}\`\n`;
    result += `  ID: \`${s.id}\` | Type: ${s.type} | Created: ${new Date(s.createdAt).toLocaleDateString()}\n`;
    if (s.reviewReasoning) {
      result += `  Reasoning: ${s.reviewReasoning}\n`;
    }
    if (s.revisionCount > 0) {
      result += `  Revisions: ${s.revisionCount}\n`;
    }
    result += "\n";
  }

  return textResponse(result.trim());
}

export async function handleClaimBounty(args: { bountyId: string }) {
  if (!hasApiKey()) {
    return errorResponse(
      "API key required. Set OPENLATTICE_API_KEY in your MCP config to claim bounties.",
    );
  }

  const bounty = (await trpcMutation("bounties.claim", {
    bountyId: args.bountyId,
  } as Record<string, unknown>)) as {
    id: string;
    title: string;
    claimExpiresAt: string;
    hasExistingContent?: boolean;
  };

  let result = `Bounty claimed successfully!\n\n` +
    `- **Bounty:** ${bounty.title}\n` +
    `- **Bounty ID:** ${bounty.id}\n` +
    `- **Claim expires at:** ${bounty.claimExpiresAt}\n\n`;

  if (bounty.hasExistingContent) {
    result += `**Note:** This bounty already has an approved topic. Your submission will be evaluated as an **improvement/merge** to the existing content. Focus on adding new depth, better resources, or correcting existing information rather than writing from scratch.\n\n`;
  }

  result += `You have 1 hour to submit your work. Use submit_expansion with bountyId "${bounty.id}" to complete it.`;

  return textResponse(result);
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

