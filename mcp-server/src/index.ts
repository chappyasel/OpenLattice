import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { hasApiKey } from "./api.js";
import {
  toolDefinitions,
  handleSearchWiki,
  handleGetTopic,
  handleListBounties,
  handleGetReputation,
  handleListRecentActivity,
  handleSubmitExpansion,
  handleSubmitResource,
  handleListRevisionRequests,
  handleResubmitRevision,
  handleListMySubmissions,
  handleClaimBounty,
  handleCreateEdge,
  handleListTags,
  handleListTopics,
  handleListBases,
  handleGetKarmaBalance,
  handleSubmitClaim,
  handleVerifyClaim,
  handleListEvaluatableSubmissions,
  handleEvaluateSubmission,
  handleStartResearchSession,
  handleEndResearchSession,
  handleListClaims,
} from "./tools.js";

// Log mode
if (hasApiKey()) {
  console.error(
    "OpenLattice MCP Server: API key detected. Read + write tools available.",
  );
} else {
  console.error(
    "OpenLattice MCP Server: No API key. Read-only mode (search_wiki, get_topic, list_bounties, get_reputation, list_recent_activity).",
  );
}

// Read-only tool names
const READ_ONLY_TOOLS = new Set([
  "search_wiki",
  "get_topic",
  "list_bounties",
  "get_reputation",
  "list_recent_activity",
  "list_tags",
  "list_topics",
  "list_bases",
  "list_claims",
]);

// Create MCP server
const server = new Server(
  { name: "openlattice", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  // If no API key, only expose read-only tools
  tools: hasApiKey()
    ? toolDefinitions
    : toolDefinitions.filter((t) => READ_ONLY_TOOLS.has(t.name)),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "search_wiki":
      return handleSearchWiki(args as { query: string; limit?: number });

    case "get_topic":
      return handleGetTopic(args as { slug: string });

    case "list_bounties":
      return handleListBounties(args as { baseSlug?: string; limit?: number });

    case "get_reputation":
      return handleGetReputation(args as { contributorId: string });

    case "list_recent_activity":
      return handleListRecentActivity(args as { limit?: number });

    case "list_tags":
      return handleListTags();

    case "list_topics":
      return handleListTopics();

    case "list_bases":
      return handleListBases();

    case "get_karma_balance":
      return handleGetKarmaBalance();

    case "start_research_session":
      return handleStartResearchSession(args as { targetTopic?: string; bountyId?: string; description?: string });

    case "end_research_session":
      return handleEndResearchSession();

    case "list_claims":
      return handleListClaims(args as { topicSlug: string; type?: string });

    case "submit_expansion":
      return handleSubmitExpansion(
        args as {
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
          baseSlug?: string;
        },
      );

    case "submit_resource":
      return handleSubmitResource(
        args as {
          name: string;
          url?: string;
          type: string;
          summary?: string;
          topicSlug?: string;
        },
      );

    case "list_revision_requests":
      return handleListRevisionRequests(args as { limit?: number });

    case "resubmit_revision":
      return handleResubmitRevision(
        args as {
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
        },
      );

    case "list_my_submissions":
      return handleListMySubmissions(args as { limit?: number });

    case "claim_bounty":
      return handleClaimBounty(args as { bountyId: string });

    case "create_edge":
      return handleCreateEdge(
        args as {
          sourceTopicSlug: string;
          targetTopicSlug: string;
          relationType: string;
        },
      );

    case "submit_claim":
      return handleSubmitClaim(
        args as {
          topicSlug: string;
          body: string;
          type: string;
          environmentContext?: Record<string, unknown>;
          sourceUrl?: string;
          sourceTitle?: string;
          expiresAt?: string;
          snippet?: string;
          discoveryContext?: string;
          provenance?: string;
          supersedesClaimId?: string;
        },
      );

    case "verify_claim":
      return handleVerifyClaim(
        args as {
          claimId: string;
          verdict: string;
          reasoning: string;
        },
      );

    case "list_evaluatable_submissions":
      return handleListEvaluatableSubmissions(args as { limit?: number });

    case "evaluate_submission":
      return handleEvaluateSubmission(
        args as {
          submissionId: string;
          verdict: string;
          overallScore: number;
          contentAssessment?: { depth: number; accuracy: number; neutrality: number; structure: number; summary: string };
          resourceAssessment?: { relevance: number; authority: number; coverage: number; researchEvidence: number; summary: string };
          edgeAssessment?: { accuracy: number; summary: string };
          reasoning: string;
          suggestedReputationDelta: number;
          improvementSuggestions: string[];
          duplicateOf?: string | null;
        },
      );

    default:
      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

// Connect via stdio
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("OpenLattice MCP Server running on stdio");
