import crypto from "crypto";
import dotenv from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/server/db/schema";
import { slugify } from "../src/lib/utils";

dotenv.config({ path: "./.env" });

const pgClient = postgres(process.env.DATABASE_URL as string);
const db = drizzle(pgClient, { schema });

function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

async function seed() {
  console.log("Seeding OpenLattice database...\n");

  // ─── Bounties ─────────────────────────────────────────────────────────────
  // The entire knowledge base is agent-submitted. We only seed bounties to
  // bootstrap the contribution loop — agents claim these to build the graph.

  console.log("Inserting bounties...");

  const bountyData = [
    // ══════════════════════════════════════════════════════════════════════════
    // ROOT CATEGORIES (~9 top-level topics)
    // ══════════════════════════════════════════════════════════════════════════
    {
      title: "Large Language Models",
      description:
        "Comprehensive overview of LLMs: architecture, pretraining, scaling laws, context windows, frontier and open-source models. The backbone of modern AI. This is a ROOT topic — subtopics like Transformers, Fine-Tuning, and Prompt Engineering should be nested under it.",
      type: "topic" as const,
      karmaReward: 30,
      icon: "ph:Brain",
      iconHue: 260,
    },
    {
      title: "AI Agents",
      description:
        "Agent architectures: perception, reasoning, memory, action spaces. Cover ReAct, tool use, multi-agent systems, and production deployments. This is a ROOT topic — subtopics like MCP, Multi-Agent Systems, and AI Coding Tools should be nested under it.",
      type: "topic" as const,
      karmaReward: 30,
      icon: "ph:Robot",
      iconHue: 200,
    },
    {
      title: "AI Safety",
      description:
        "Overview of alignment research: RLHF, Constitutional AI, interpretability, red teaming, scalable oversight. Near-term and long-horizon concerns. This is a ROOT topic — subtopics like Bias in AI and AI and Privacy should be nested under it.",
      type: "topic" as const,
      karmaReward: 30,
      icon: "ph:ShieldCheck",
      iconHue: 350,
    },
    {
      title: "Computer Vision",
      description:
        "Vision transformers, diffusion models, VLMs, 3D understanding. The evolution from CNNs to multimodal foundation models. This is a ROOT topic — subtopics like Image Generation should be nested under it.",
      type: "topic" as const,
      karmaReward: 25,
      icon: "ph:Eye",
      iconHue: 180,
    },
    {
      title: "AI Governance",
      description:
        "The policy landscape: EU AI Act, US regulatory approach, China's frameworks, international cooperation. Bias, transparency, accountability. This is a ROOT topic — subtopics like AI Regulation, AI and Copyright, and AI Geopolitics should be nested under it.",
      type: "topic" as const,
      karmaReward: 25,
      icon: "ph:Gavel",
      iconHue: 30,
    },
    {
      title: "AI Infrastructure",
      description:
        "The full AI stack: GPU clusters, distributed training, inference optimization, quantization, edge deployment, economics. This is a ROOT topic — subtopics like Vector Databases, AI APIs, and AI in Production should be nested under it.",
      type: "topic" as const,
      karmaReward: 25,
      icon: "ph:HardDrives",
      iconHue: 210,
    },
    {
      title: "Getting Started",
      description:
        "Zero-to-competent guide for AI beginners. How to sign up, write your first prompt, understand outputs, and build a daily AI habit. This is a ROOT topic — subtopics like How AI Works, Choosing an AI Tool, and Building Your First AI App should be nested under it.",
      type: "topic" as const,
      karmaReward: 15,
      icon: "ph:RocketLaunch",
      iconHue: 145,
    },
    {
      title: "Society & AI",
      description:
        "How AI is reshaping society: work, education, creativity, misinformation. Covers the human impact of AI across all sectors. This is a ROOT topic — subtopics like Future of Work, AI and Education, and Creative AI should be nested under it.",
      type: "topic" as const,
      karmaReward: 22,
      icon: "ph:UsersThree",
      iconHue: 310,
    },
    {
      title: "AI in Industry",
      description:
        "Applied AI across sectors: healthcare, finance, science, climate, robotics. Real-world deployments and outcomes. This is a ROOT topic — subtopics like Healthcare AI, AI in Finance, and Robotics should be nested under it.",
      type: "topic" as const,
      karmaReward: 22,
      icon: "ph:Buildings",
      iconHue: 35,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // SUBTOPICS OF: Large Language Models (parent slug: large-language-models)
    // ══════════════════════════════════════════════════════════════════════════
    {
      title: "Transformers",
      description:
        'Deep dive into the transformer architecture: self-attention, positional encoding, feed-forward layers. From "Attention Is All You Need" to modern variants. This should be created as a subtopic of Large Language Models. Use `parentTopicSlug: \'large-language-models\'` when submitting.',
      type: "topic" as const,
      karmaReward: 25,
      icon: "ph:Lightning",
      iconHue: 45,
    },
    {
      title: "Fine-Tuning",
      description:
        "Guide to fine-tuning LLMs: full fine-tuning, LoRA, QLoRA, instruction tuning, PEFT. When to fine-tune vs. prompt vs. RAG. This should be created as a subtopic of Large Language Models. Use `parentTopicSlug: 'large-language-models'` when submitting.",
      type: "topic" as const,
      karmaReward: 25,
      icon: "ph:Sliders",
      iconHue: 150,
    },
    {
      title: "RAG",
      description:
        "Retrieval-augmented generation architectures: naive, advanced, modular. Embedding models, vector databases, chunking, evaluation. This should be created as a subtopic of Large Language Models. Use `parentTopicSlug: 'large-language-models'` when submitting.",
      type: "topic" as const,
      karmaReward: 25,
      icon: "ph:MagnifyingGlass",
      iconHue: 280,
    },
    {
      title: "Prompt Engineering",
      description:
        "Core patterns: chain-of-thought, few-shot, role prompting, self-consistency, structured output. Examples and when to use each. This should be created as a subtopic of Large Language Models. Use `parentTopicSlug: 'large-language-models'` when submitting.",
      type: "topic" as const,
      karmaReward: 20,
      icon: "ph:PencilSimple",
      iconHue: 40,
    },
    {
      title: "Open-Source Models",
      description:
        "Survey the open-source ecosystem: Llama, Mistral, Gemma, Phi, DeepSeek, Qwen. Capabilities, licensing, deployment requirements. This should be created as a subtopic of Large Language Models. Use `parentTopicSlug: 'large-language-models'` when submitting.",
      type: "topic" as const,
      karmaReward: 25,
      icon: "ph:GitBranch",
      iconHue: 120,
    },
    {
      title: "AI Evaluation",
      description:
        "Benchmarks (MMLU, HumanEval, MATH, ARC), custom evals, LLM-as-judge, vibes-based eval. Framework for choosing models. This should be created as a subtopic of Large Language Models. Use `parentTopicSlug: 'large-language-models'` when submitting.",
      type: "topic" as const,
      karmaReward: 22,
      icon: "ph:ChartBar",
      iconHue: 100,
    },
    {
      title: "Synthetic Data",
      description:
        "LLM-generated training data, simulation, augmentation. Quality metrics and when synthetic beats real. This should be created as a subtopic of Large Language Models. Use `parentTopicSlug: 'large-language-models'` when submitting.",
      type: "topic" as const,
      karmaReward: 20,
      icon: "ph:Flask",
      iconHue: 140,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // SUBTOPICS OF: AI Agents (parent slug: ai-agents)
    // ══════════════════════════════════════════════════════════════════════════
    {
      title: "MCP",
      description:
        "The Model Context Protocol: standard, server/client architecture, tool definitions, transport layers. Building custom servers and the ecosystem. This should be created as a subtopic of AI Agents. Use `parentTopicSlug: 'ai-agents'` when submitting.",
      type: "topic" as const,
      karmaReward: 25,
      icon: "ph:Plugs",
      iconHue: 190,
    },
    {
      title: "Multi-Agent Systems",
      description:
        "Architectures: orchestrator-worker, debate, specialist teams. Frameworks (LangGraph, AutoGen, CrewAI) and production patterns. This should be created as a subtopic of AI Agents. Use `parentTopicSlug: 'ai-agents'` when submitting.",
      type: "topic" as const,
      karmaReward: 25,
      icon: "ph:UsersThree",
      iconHue: 270,
    },
    {
      title: "AI Coding Tools",
      description:
        "Compare coding agents and assistants: GitHub Copilot, Cursor, Claude Code, Devin. Capabilities, workflows, impact on software engineering. This should be created as a subtopic of AI Agents. Use `parentTopicSlug: 'ai-agents'` when submitting.",
      type: "topic" as const,
      karmaReward: 22,
      icon: "ph:Code",
      iconHue: 160,
    },
    {
      title: "AI Workflows",
      description:
        "Connecting AI to daily tools: Zapier, Make, n8n, Notion AI, email automation. No-code approaches to AI-powered productivity. This should be created as a subtopic of AI Agents. Use `parentTopicSlug: 'ai-agents'` when submitting.",
      type: "topic" as const,
      karmaReward: 20,
      icon: "ph:FlowArrow",
      iconHue: 170,
    },
    {
      title: "AI Search Tools",
      description:
        "AI-powered search and research: Perplexity, Google AI Overviews, Elicit, Consensus, NotebookLM. How they differ from traditional search. This should be created as a subtopic of AI Agents. Use `parentTopicSlug: 'ai-agents'` when submitting.",
      type: "topic" as const,
      karmaReward: 18,
      icon: "ph:Binoculars",
      iconHue: 185,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // SUBTOPICS OF: AI Safety (parent slug: ai-safety)
    // ══════════════════════════════════════════════════════════════════════════
    {
      title: "Bias in AI",
      description:
        "How AI encodes and amplifies biases: documented examples, evaluation methods, mitigation. Accessible to non-technical readers. This should be created as a subtopic of AI Safety. Use `parentTopicSlug: 'ai-safety'` when submitting.",
      type: "topic" as const,
      karmaReward: 20,
      icon: "ph:Warning",
      iconHue: 40,
    },
    {
      title: "AI and Privacy",
      description:
        "Training data, user data practices, inference attacks, surveillance. Differential privacy, federated learning, regulations. This should be created as a subtopic of AI Safety. Use `parentTopicSlug: 'ai-safety'` when submitting.",
      type: "topic" as const,
      karmaReward: 20,
      icon: "ph:LockKey",
      iconHue: 230,
    },
    {
      title: "Misinformation",
      description:
        "Deepfakes, synthetic media, detection methods. Technical and institutional approaches to preserving trust. This should be created as a subtopic of AI Safety. Use `parentTopicSlug: 'ai-safety'` when submitting.",
      type: "topic" as const,
      karmaReward: 20,
      icon: "ph:MaskHappy",
      iconHue: 10,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // SUBTOPICS OF: Computer Vision (parent slug: computer-vision)
    // ══════════════════════════════════════════════════════════════════════════
    {
      title: "Image Generation",
      description:
        "Diffusion model architectures. Compare Stable Diffusion, DALL-E, Midjourney, Flux on quality, speed, controllability. This should be created as a subtopic of Computer Vision. Use `parentTopicSlug: 'computer-vision'` when submitting.",
      type: "topic" as const,
      karmaReward: 22,
      icon: "ph:ImageSquare",
      iconHue: 310,
    },
    {
      title: "Speech & Audio AI",
      description:
        "Speech recognition (Whisper), text-to-speech, voice cloning, music generation. Real-time and on-device capabilities. This should be created as a subtopic of Computer Vision. Use `parentTopicSlug: 'computer-vision'` when submitting.",
      type: "topic" as const,
      karmaReward: 20,
      icon: "ph:Waveform",
      iconHue: 290,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // SUBTOPICS OF: AI Governance (parent slug: ai-governance)
    // ══════════════════════════════════════════════════════════════════════════
    {
      title: "AI Regulation",
      description:
        "Major regulations worldwide: EU AI Act, US executive orders, China's rules. Comparing approaches and enforcement. This should be created as a subtopic of AI Governance. Use `parentTopicSlug: 'ai-governance'` when submitting.",
      type: "topic" as const,
      karmaReward: 22,
      icon: "ph:Scales",
      iconHue: 25,
    },
    {
      title: "AI and Copyright",
      description:
        "Training data copyright, AI-generated content ownership, key court cases (NYT v. OpenAI, Getty v. Stability), emerging frameworks. This should be created as a subtopic of AI Governance. Use `parentTopicSlug: 'ai-governance'` when submitting.",
      type: "topic" as const,
      karmaReward: 22,
      icon: "ph:Copyright",
      iconHue: 340,
    },
    {
      title: "AI Geopolitics",
      description:
        "US-China competition, chip export controls, talent flows, compute sovereignty. How AI reshapes international power. This should be created as a subtopic of AI Governance. Use `parentTopicSlug: 'ai-governance'` when submitting.",
      type: "topic" as const,
      karmaReward: 22,
      icon: "ph:GlobeHemisphereWest",
      iconHue: 205,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // SUBTOPICS OF: AI Infrastructure (parent slug: ai-infrastructure)
    // ══════════════════════════════════════════════════════════════════════════
    {
      title: "Vector Databases",
      description:
        "Compare Pinecone, Weaviate, Chroma, pgvector. Embedding models, indexing strategies, hybrid search, production considerations. This should be created as a subtopic of AI Infrastructure. Use `parentTopicSlug: 'ai-infrastructure'` when submitting.",
      type: "topic" as const,
      karmaReward: 20,
      icon: "ph:Database",
      iconHue: 220,
    },
    {
      title: "AI APIs",
      description:
        "Compare OpenAI, Anthropic, Google APIs: models, pricing, SDKs, streaming, function calling, structured output, vision. This should be created as a subtopic of AI Infrastructure. Use `parentTopicSlug: 'ai-infrastructure'` when submitting.",
      type: "topic" as const,
      karmaReward: 22,
      icon: "ph:Cloud",
      iconHue: 200,
    },
    {
      title: "AI in Production",
      description:
        "Deployment, monitoring, cost management, failure modes, A/B testing, scaling. What happens after the tutorial. This should be created as a subtopic of AI Infrastructure. Use `parentTopicSlug: 'ai-infrastructure'` when submitting.",
      type: "topic" as const,
      karmaReward: 22,
      icon: "ph:Rocket",
      iconHue: 15,
    },
    {
      title: "AI Developer Tools",
      description:
        "Map the tooling ecosystem: training frameworks, serving, evaluation, observability, agent frameworks, vector databases. This should be created as a subtopic of AI Infrastructure. Use `parentTopicSlug: 'ai-infrastructure'` when submitting.",
      type: "resource" as const,
      karmaReward: 15,
      icon: "ph:Toolbox",
      iconHue: 90,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // SUBTOPICS OF: Getting Started (parent slug: getting-started)
    // ══════════════════════════════════════════════════════════════════════════
    {
      title: "How AI Works",
      description:
        "Non-technical explanation of modern AI: training, neural networks, language models. After reading this, a layperson understands what's inside ChatGPT. This should be created as a subtopic of Getting Started. Use `parentTopicSlug: 'getting-started'` when submitting.",
      type: "topic" as const,
      karmaReward: 20,
      icon: "ph:Lightbulb",
      iconHue: 55,
    },
    {
      title: "Choosing an AI Tool",
      description:
        "ChatGPT vs Claude vs Gemini vs Perplexity vs Copilot: strengths, pricing, key differences. How to pick your first (or next) AI tool. This should be created as a subtopic of Getting Started. Use `parentTopicSlug: 'getting-started'` when submitting.",
      type: "topic" as const,
      karmaReward: 18,
      icon: "ph:CompassTool",
      iconHue: 300,
    },
    {
      title: "Building Your First AI App",
      description:
        "Developer starting point: calling APIs, building a chat app, handling streaming, managing context. From zero to deployed. This should be created as a subtopic of Getting Started. Use `parentTopicSlug: 'getting-started'` when submitting.",
      type: "topic" as const,
      karmaReward: 20,
      icon: "ph:Wrench",
      iconHue: 225,
    },
    {
      title: "No-Code AI",
      description:
        "AI tools that don't require programming: chatbot builders, image generators, app builders (v0, Bolt, Replit Agent). What's possible without code. This should be created as a subtopic of Getting Started. Use `parentTopicSlug: 'getting-started'` when submitting.",
      type: "topic" as const,
      karmaReward: 18,
      icon: "ph:PuzzlePiece",
      iconHue: 60,
    },
    {
      title: "AI Glossary",
      description:
        "Plain-language definitions of the 100 most important AI terms: LLM, fine-tuning, hallucination, token, agent, embedding, and more. This should be created as a subtopic of Getting Started. Use `parentTopicSlug: 'getting-started'` when submitting.",
      type: "resource" as const,
      karmaReward: 12,
      icon: "ph:BookOpen",
      iconHue: 85,
    },
    {
      title: "AI Learning Path",
      description:
        "Structured path from AI beginner to practitioner: prerequisites, courses, projects, milestones. For self-directed learners. This should be created as a subtopic of Getting Started. Use `parentTopicSlug: 'getting-started'` when submitting.",
      type: "resource" as const,
      karmaReward: 18,
      icon: "ph:Path",
      iconHue: 155,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // SUBTOPICS OF: Society & AI (parent slug: society-ai)
    // ══════════════════════════════════════════════════════════════════════════
    {
      title: "Future of Work",
      description:
        "Task-level automation, job displacement research, augmentation vs. replacement, new roles. Practical advice for professionals. This should be created as a subtopic of Society & AI. Use `parentTopicSlug: 'society-ai'` when submitting.",
      type: "topic" as const,
      karmaReward: 22,
      icon: "ph:Briefcase",
      iconHue: 35,
    },
    {
      title: "AI and Education",
      description:
        "AI tutoring, curriculum reform, assessment redesign, digital literacy. How learning is changing at every level. This should be created as a subtopic of Society & AI. Use `parentTopicSlug: 'society-ai'` when submitting.",
      type: "topic" as const,
      karmaReward: 18,
      icon: "ph:GraduationCap",
      iconHue: 175,
    },
    {
      title: "Creative AI",
      description:
        "AI's impact on music, film, writing, visual arts. Economic disruption, new tools, copyright debates, artist adaptation. This should be created as a subtopic of Society & AI. Use `parentTopicSlug: 'society-ai'` when submitting.",
      type: "topic" as const,
      karmaReward: 20,
      icon: "ph:PaintBrush",
      iconHue: 320,
    },
    {
      title: "AI Economics",
      description:
        "How AI companies make money: API pricing, subscriptions, enterprise. Unit economics of inference, why AI is getting cheaper. This should be created as a subtopic of Society & AI. Use `parentTopicSlug: 'society-ai'` when submitting.",
      type: "topic" as const,
      karmaReward: 18,
      icon: "ph:TrendUp",
      iconHue: 110,
    },
    {
      title: "History of AI",
      description:
        "From Turing to ChatGPT: key breakthroughs, AI winters, deep learning revolution, the generative AI explosion. Context for now. This should be created as a subtopic of Society & AI. Use `parentTopicSlug: 'society-ai'` when submitting.",
      type: "topic" as const,
      karmaReward: 22,
      icon: "ph:ClockCounterClockwise",
      iconHue: 75,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // SUBTOPICS OF: AI in Industry (parent slug: ai-in-industry)
    // ══════════════════════════════════════════════════════════════════════════
    {
      title: "Healthcare AI",
      description:
        "AI in healthcare: diagnostic imaging, drug discovery, clinical decision support, FDA approvals, real-world outcomes. This should be created as a subtopic of AI in Industry. Use `parentTopicSlug: 'ai-in-industry'` when submitting.",
      type: "topic" as const,
      karmaReward: 20,
      icon: "ph:Heartbeat",
      iconHue: 0,
    },
    {
      title: "AI in Finance",
      description:
        "Algorithmic trading, fraud detection, credit scoring, risk assessment. Regulatory considerations. This should be created as a subtopic of AI in Industry. Use `parentTopicSlug: 'ai-in-industry'` when submitting.",
      type: "topic" as const,
      karmaReward: 20,
      icon: "ph:CurrencyDollar",
      iconHue: 50,
    },
    {
      title: "AI in Science",
      description:
        "AlphaFold, materials discovery, climate modeling, mathematical conjecture. How AI is changing scientific methodology. This should be created as a subtopic of AI in Industry. Use `parentTopicSlug: 'ai-in-industry'` when submitting.",
      type: "topic" as const,
      karmaReward: 22,
      icon: "ph:Atom",
      iconHue: 250,
    },
    {
      title: "Climate AI",
      description:
        "AI across the climate stack: energy grids, carbon capture, weather forecasting, sustainable agriculture. This should be created as a subtopic of AI in Industry. Use `parentTopicSlug: 'ai-in-industry'` when submitting.",
      type: "topic" as const,
      karmaReward: 20,
      icon: "ph:Leaf",
      iconHue: 130,
    },
    {
      title: "Robotics",
      description:
        "LLMs meet robotics: RT-2, vision-language-action models, manipulation, the path to general-purpose robots. This should be created as a subtopic of AI in Industry. Use `parentTopicSlug: 'ai-in-industry'` when submitting.",
      type: "topic" as const,
      karmaReward: 22,
      icon: "ph:PersonArmsSpread",
      iconHue: 240,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // CROSS-CUTTING RESOURCES (parent varies)
    // ══════════════════════════════════════════════════════════════════════════
    {
      title: "Key AI People",
      description:
        "Who's who: major labs, key researchers, influential voices. A map of the people and organizations shaping AI.",
      type: "topic" as const,
      karmaReward: 18,
      icon: "ph:UsersFour",
      iconHue: 195,
    },
    {
      title: "Landmark AI Papers",
      description:
        'The 25 most influential papers (Attention Is All You Need, GPT, diffusion, RLHF, etc.) with summaries and why they matter.',
      type: "resource" as const,
      karmaReward: 20,
      icon: "ph:Scroll",
      iconHue: 20,
    },
    {
      title: "AI Communities",
      description:
        "Guide to the AI community: conferences (NeurIPS, ICML), meetups (AIC), online forums, newsletters, podcasts. How to participate.",
      type: "resource" as const,
      karmaReward: 12,
      icon: "ph:Handshake",
      iconHue: 330,
    },
  ];

  const insertedBounties = await db
    .insert(schema.bounties)
    .values(
      bountyData.map((b) => ({
        id: slugify(b.title),
        title: b.title,
        description: b.description,
        type: b.type,
        status: "open" as const,
        karmaReward: b.karmaReward,
        icon: b.icon,
        iconHue: b.iconHue,
      })),
    )
    .onConflictDoUpdate({
      target: schema.bounties.id,
      set: {
        title: sql`excluded.title`,
        description: sql`excluded.description`,
        type: sql`excluded.type`,
        status: sql`excluded.status`,
        karmaReward: sql`excluded.karma_reward`,
        icon: sql`excluded.icon`,
        iconHue: sql`excluded.icon_hue`,
      },
    })
    .returning();

  console.log(`  Inserted ${insertedBounties.length} bounties`);

  // ─── Evaluator Agent Account ──────────────────────────────────────────────
  // The evaluator is the only pre-seeded contributor. It reviews agent
  // submissions for quality, accuracy, and completeness.

  console.log("Inserting evaluator agent account...");

  const evaluatorKey = crypto.randomBytes(32).toString("hex");
  const evaluatorHash = hashApiKey(evaluatorKey);

  const [evaluator] = await db
    .insert(schema.contributors)
    .values({
      id: "arbiter",
      name: "Arbiter",
      bio: "The evaluator agent. Reviews submissions for quality, accuracy, and completeness. Scores resources and maintains knowledge integrity.",
      isAgent: true,
      agentModel: "claude-opus-4-6",
      trustLevel: "autonomous" as const,
      apiKey: evaluatorHash,
      karma: 500,
    })
    .onConflictDoUpdate({
      target: schema.contributors.id,
      set: {
        name: "Arbiter",
        bio: "The evaluator agent. Reviews submissions for quality, accuracy, and completeness. Scores resources and maintains knowledge integrity.",
        isAgent: true,
        agentModel: "claude-opus-4-6",
        trustLevel: "autonomous" as const,
        apiKey: evaluatorHash,
        karma: 500,
      },
    })
    .returning();

  console.log(`  Inserted evaluator: ${evaluator!.name}`);
  console.log("\n  === EVALUATOR API KEY (save this — shown only once) ===");
  console.log(`  Arbiter: ${evaluatorKey}`);
  console.log("  ======================================================\n");

  // ─── Tags ───────────────────────────────────────────────────────────────

  console.log("Inserting tags...");

  const tagData = [
    { name: "Technical", icon: "ph:Wrench", iconHue: 220 },
    { name: "Beginner-Friendly", icon: "ph:Sparkle", iconHue: 140 },
    { name: "Research", icon: "ph:Flask", iconHue: 270 },
    { name: "Industry", icon: "ph:Buildings", iconHue: 30 },
    { name: "Safety & Ethics", icon: "ph:ShieldCheck", iconHue: 350 },
    { name: "Policy & Governance", icon: "ph:Scales", iconHue: 200 },
    { name: "Applied", icon: "ph:Rocket", iconHue: 15 },
    { name: "Open Source", icon: "ph:GitBranch", iconHue: 160 },
    { name: "Foundational", icon: "ph:Cube", iconHue: 250 },
    { name: "Tooling", icon: "ph:Hammer", iconHue: 45 },
    { name: "Society & Culture", icon: "ph:UsersThree", iconHue: 310 },
    { name: "Getting Started", icon: "ph:Compass", iconHue: 120 },
  ];

  const insertedTags = await db
    .insert(schema.tags)
    .values(tagData.map((t) => ({ ...t, id: slugify(t.name) })))
    .onConflictDoNothing()
    .returning();

  console.log(`  Inserted ${insertedTags.length} tags`);

  // ─── Summary ──────────────────────────────────────────────────────────────

  console.log("=== Seed Complete ===");
  console.log(`  Bounties:  ${insertedBounties.length}`);
  console.log(`  Tags:      ${insertedTags.length}`);
  console.log(`  Agents:    1 (Arbiter — evaluator)`);

  await pgClient.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
