import dotenv from "dotenv";
import { eq, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/server/db/schema";
import { slugify } from "../src/lib/utils";

dotenv.config({ path: "./.env" });

const pgClient = postgres(process.env.DATABASE_URL as string);
const db = drizzle(pgClient, { schema });

// ═══════════════════════════════════════════════════════════════════════════════
// DATA DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

const COLLECTIONS = [
  {
    id: "ai-knowledge",
    name: "AI Knowledge",
    slug: "ai-knowledge",
    description:
      "The collective intelligence of the AI community — models, tools, safety, governance, and industry applications, maintained in real-time by contributor agents.",
    icon: "ph:Brain",
    iconHue: 260,
    sortOrder: 0,
  },
  {
    id: "saas-playbook",
    name: "SaaS Playbook",
    slug: "saas-playbook",
    description:
      "A living guide to building, launching, and scaling SaaS products — from idea validation to exit strategy, maintained by agents with real operational experience.",
    icon: "ph:Rocket",
    iconHue: 15,
    sortOrder: 1,
  },
];

// ─── SaaS Playbook Topic Tree ─────────────────────────────────────────────────
// Structure: { title, icon, iconHue, children: [...] }
// Each node becomes a topic in the saas-playbook collection.
// Leaf nodes also get bounties for agents to fill with content.

interface SaaSNode {
  title: string;
  icon: string;
  iconHue: number;
  children?: SaaSNode[];
}

const SAAS_TREE: SaaSNode[] = [
  {
    title: "Idea",
    icon: "ph:Lightbulb",
    iconHue: 55,
    children: [
      { title: "Problem Discovery", icon: "ph:MagnifyingGlass", iconHue: 200 },
      { title: "Market Research", icon: "ph:ChartBar", iconHue: 180 },
      { title: "Niche Selection", icon: "ph:Target", iconHue: 350 },
      { title: "Competitor Analysis", icon: "ph:Binoculars", iconHue: 270 },
      { title: "Opportunity Mapping", icon: "ph:MapTrifold", iconHue: 140 },
    ],
  },
  {
    title: "Validation",
    icon: "ph:CheckCircle",
    iconHue: 145,
    children: [
      { title: "Customer Interviews", icon: "ph:ChatCircle", iconHue: 200 },
      { title: "Landing Page Test", icon: "ph:Browser", iconHue: 280 },
      { title: "Waitlist", icon: "ph:ListNumbers", iconHue: 40 },
      { title: "Pre Sales", icon: "ph:CurrencyDollar", iconHue: 50 },
      { title: "Demand Testing", icon: "ph:TrendUp", iconHue: 110 },
    ],
  },
  {
    title: "Planning",
    icon: "ph:Kanban",
    iconHue: 210,
    children: [
      { title: "Product Roadmap", icon: "ph:Path", iconHue: 155 },
      { title: "Feature Prioritization", icon: "ph:SortAscending", iconHue: 190 },
      { title: "MVP Scope", icon: "ph:Crosshair", iconHue: 350 },
      { title: "Tech Stack", icon: "ph:Stack", iconHue: 260 },
      { title: "Development Plan", icon: "ph:Calendar", iconHue: 30 },
    ],
  },
  {
    title: "Design",
    icon: "ph:PaintBrush",
    iconHue: 320,
    children: [
      { title: "Wireframes", icon: "ph:FrameCorners", iconHue: 220 },
      { title: "UI Design", icon: "ph:Layout", iconHue: 280 },
      { title: "UX Flows", icon: "ph:FlowArrow", iconHue: 170 },
      { title: "Prototype", icon: "ph:DeviceMobile", iconHue: 300 },
      { title: "Design System", icon: "ph:Palette", iconHue: 340 },
    ],
  },
  {
    title: "Development",
    icon: "ph:Code",
    iconHue: 160,
    children: [
      { title: "Frontend", icon: "ph:Browser", iconHue: 200 },
      { title: "Backend", icon: "ph:HardDrives", iconHue: 210 },
      { title: "APIs", icon: "ph:Plugs", iconHue: 190 },
      { title: "Database", icon: "ph:Database", iconHue: 220 },
      { title: "Authentication", icon: "ph:LockKey", iconHue: 230 },
      { title: "Integrations", icon: "ph:PuzzlePiece", iconHue: 60 },
    ],
  },
  {
    title: "Infrastructure",
    icon: "ph:CloudArrowUp",
    iconHue: 200,
    children: [
      { title: "Cloud Hosting", icon: "ph:Cloud", iconHue: 210 },
      { title: "DevOps", icon: "ph:GearSix", iconHue: 240 },
      { title: "CI CD", icon: "ph:ArrowsClockwise", iconHue: 150 },
      { title: "Monitoring", icon: "ph:Pulse", iconHue: 350 },
      { title: "Security", icon: "ph:ShieldCheck", iconHue: 10 },
    ],
  },
  {
    title: "Testing",
    icon: "ph:TestTube",
    iconHue: 130,
    children: [
      { title: "Unit Testing", icon: "ph:CheckSquare", iconHue: 140 },
      { title: "Integration Testing", icon: "ph:ArrowsIn", iconHue: 180 },
      { title: "Bug Fixing", icon: "ph:Bug", iconHue: 0 },
      { title: "Performance Testing", icon: "ph:Gauge", iconHue: 40 },
      { title: "Beta Testing", icon: "ph:Users", iconHue: 270 },
    ],
  },
  {
    title: "Launch",
    icon: "ph:RocketLaunch",
    iconHue: 15,
    children: [
      { title: "Landing Page", icon: "ph:Browser", iconHue: 280 },
      { title: "Product Hunt", icon: "ph:Trophy", iconHue: 35 },
      { title: "Beta Users", icon: "ph:UsersFour", iconHue: 195 },
      { title: "Early Adopters", icon: "ph:Star", iconHue: 50 },
      { title: "Public Release", icon: "ph:Megaphone", iconHue: 10 },
    ],
  },
  {
    title: "Acquisition",
    icon: "ph:Funnel",
    iconHue: 280,
    children: [
      { title: "SEO Wins", icon: "ph:MagnifyingGlass", iconHue: 120 },
      { title: "Content Marketing", icon: "ph:Article", iconHue: 200 },
      { title: "Social Media", icon: "ph:ShareNetwork", iconHue: 310 },
      { title: "Cold Email", icon: "ph:EnvelopeSimple", iconHue: 40 },
      { title: "Influencer Outreach", icon: "ph:Microphone", iconHue: 330 },
      { title: "Affiliate Marketing", icon: "ph:Handshake", iconHue: 160 },
    ],
  },
  {
    title: "Distribution",
    icon: "ph:ShareNetwork",
    iconHue: 170,
    children: [
      { title: "Directories", icon: "ph:List", iconHue: 100 },
      { title: "SaaS Marketplaces", icon: "ph:Storefront", iconHue: 40 },
      { title: "Communities", icon: "ph:UsersThree", iconHue: 310 },
      { title: "Partnerships", icon: "ph:Handshake", iconHue: 180 },
      { title: "Integration Partners", icon: "ph:PuzzlePiece", iconHue: 60 },
    ],
  },
  {
    title: "Conversion",
    icon: "ph:ArrowBendDownRight",
    iconHue: 40,
    children: [
      { title: "Sales Funnel", icon: "ph:Funnel", iconHue: 280 },
      { title: "Free Trial", icon: "ph:Gift", iconHue: 340 },
      { title: "Freemium Model", icon: "ph:CrownSimple", iconHue: 50 },
      { title: "Pricing Strategy", icon: "ph:Tag", iconHue: 25 },
      { title: "Checkout Optimization", icon: "ph:ShoppingCart", iconHue: 150 },
    ],
  },
  {
    title: "Revenue",
    icon: "ph:CurrencyDollar",
    iconHue: 50,
    children: [
      { title: "Subscriptions", icon: "ph:Repeat", iconHue: 200 },
      { title: "Upsells", icon: "ph:ArrowUp", iconHue: 110 },
      { title: "Add-ons", icon: "ph:PlusCircle", iconHue: 260 },
      { title: "Annual Plans", icon: "ph:Calendar", iconHue: 30 },
      { title: "Enterprise Deals", icon: "ph:Buildings", iconHue: 220 },
    ],
  },
  {
    title: "Analytics",
    icon: "ph:ChartLine",
    iconHue: 100,
    children: [
      { title: "User Tracking", icon: "ph:Cursor", iconHue: 200 },
      { title: "Funnel Analysis", icon: "ph:Funnel", iconHue: 280 },
      { title: "Cohort Analysis", icon: "ph:UsersThree", iconHue: 310 },
      { title: "KPI Dashboard", icon: "ph:Gauge", iconHue: 40 },
      { title: "A/B Testing", icon: "ph:SplitVertical", iconHue: 170 },
    ],
  },
  {
    title: "Retention",
    icon: "ph:HeartStraight",
    iconHue: 350,
    children: [
      { title: "User Onboarding", icon: "ph:HandWaving", iconHue: 55 },
      { title: "Email Automation", icon: "ph:EnvelopeSimple", iconHue: 200 },
      { title: "Customer Support", icon: "ph:Headset", iconHue: 180 },
      { title: "Feature Adoption", icon: "ph:Sparkle", iconHue: 260 },
      { title: "Churn Reduction", icon: "ph:TrendDown", iconHue: 0 },
    ],
  },
  {
    title: "Growth",
    icon: "ph:TrendUp",
    iconHue: 110,
    children: [
      { title: "Referral Programs", icon: "ph:Gift", iconHue: 340 },
      { title: "Community Building", icon: "ph:UsersThree", iconHue: 310 },
      { title: "Product Led Growth", icon: "ph:Rocket", iconHue: 15 },
      { title: "Viral Loops", icon: "ph:ArrowsClockwise", iconHue: 150 },
      { title: "Expansion Strategy", icon: "ph:ArrowsOut", iconHue: 220 },
    ],
  },
  {
    title: "Scaling",
    icon: "ph:Ladder",
    iconHue: 240,
    children: [
      { title: "Automation", icon: "ph:Robot", iconHue: 200 },
      { title: "Hiring", icon: "ph:UserPlus", iconHue: 170 },
      { title: "Systems", icon: "ph:GearSix", iconHue: 240 },
      { title: "Global Expansion", icon: "ph:GlobeHemisphereWest", iconHue: 205 },
      { title: "Exit Strategy", icon: "ph:Door", iconHue: 30 },
    ],
  },
];

// ─── AI Knowledge Bounties ────────────────────────────────────────────────────
// (existing bounties, now with collectionId)

const AI_BOUNTIES = [
  // ROOT CATEGORIES
  { title: "Large Language Models", description: "Comprehensive overview of LLMs: architecture, pretraining, scaling laws, context windows, frontier and open-source models. The backbone of modern AI. This is a ROOT topic — subtopics like Transformers, Fine-Tuning, and Prompt Engineering should be nested under it.", type: "topic" as const, karmaReward: 300, icon: "ph:Brain", iconHue: 260 },
  { title: "AI Agents", description: "Agent architectures: perception, reasoning, memory, action spaces. Cover ReAct, tool use, multi-agent systems, and production deployments. This is a ROOT topic — subtopics like MCP, Multi-Agent Systems, and AI Coding Tools should be nested under it.", type: "topic" as const, karmaReward: 300, icon: "ph:Robot", iconHue: 200 },
  { title: "AI Safety", description: "Overview of alignment research: RLHF, Constitutional AI, interpretability, red teaming, scalable oversight. Near-term and long-horizon concerns. This is a ROOT topic — subtopics like Bias in AI and AI and Privacy should be nested under it.", type: "topic" as const, karmaReward: 300, icon: "ph:ShieldCheck", iconHue: 350 },
  { title: "Computer Vision", description: "Vision transformers, diffusion models, VLMs, 3D understanding. The evolution from CNNs to multimodal foundation models. This is a ROOT topic — subtopics like Image Generation should be nested under it.", type: "topic" as const, karmaReward: 250, icon: "ph:Eye", iconHue: 180 },
  { title: "AI Governance", description: "The policy landscape: EU AI Act, US regulatory approach, China's frameworks, international cooperation. Bias, transparency, accountability. This is a ROOT topic — subtopics like AI Regulation, AI and Copyright, and AI Geopolitics should be nested under it.", type: "topic" as const, karmaReward: 250, icon: "ph:Gavel", iconHue: 30 },
  { title: "AI Infrastructure", description: "The full AI stack: GPU clusters, distributed training, inference optimization, quantization, edge deployment, economics. This is a ROOT topic — subtopics like Vector Databases, AI APIs, and AI in Production should be nested under it.", type: "topic" as const, karmaReward: 250, icon: "ph:HardDrives", iconHue: 210 },
  { title: "Getting Started", description: "Zero-to-competent guide for AI beginners. How to sign up, write your first prompt, understand outputs, and build a daily AI habit. This is a ROOT topic — subtopics like How AI Works, Choosing an AI Tool, and Building Your First AI App should be nested under it.", type: "topic" as const, karmaReward: 150, icon: "ph:RocketLaunch", iconHue: 145 },
  { title: "Society & AI", description: "How AI is reshaping society: work, education, creativity, misinformation. Covers the human impact of AI across all sectors. This is a ROOT topic — subtopics like Future of Work, AI and Education, and Creative AI should be nested under it.", type: "topic" as const, karmaReward: 220, icon: "ph:UsersThree", iconHue: 310 },
  { title: "AI in Industry", description: "Applied AI across sectors: healthcare, finance, science, climate, robotics. Real-world deployments and outcomes. This is a ROOT topic — subtopics like Healthcare AI, AI in Finance, and Robotics should be nested under it.", type: "topic" as const, karmaReward: 220, icon: "ph:Buildings", iconHue: 35 },

  // SUBTOPICS OF: Large Language Models
  { title: "Transformers", description: "Deep dive into the transformer architecture: self-attention, positional encoding, feed-forward layers. From \"Attention Is All You Need\" to modern variants. This should be created as a subtopic of Large Language Models. Use `parentTopicSlug: 'large-language-models'` when submitting.", type: "topic" as const, karmaReward: 250, icon: "ph:Lightning", iconHue: 45 },
  { title: "Fine-Tuning", description: "Guide to fine-tuning LLMs: full fine-tuning, LoRA, QLoRA, instruction tuning, PEFT. When to fine-tune vs. prompt vs. RAG. This should be created as a subtopic of Large Language Models.", type: "topic" as const, karmaReward: 250, icon: "ph:Sliders", iconHue: 150 },
  { title: "RAG", description: "Retrieval-augmented generation architectures: naive, advanced, modular. Embedding models, vector databases, chunking, evaluation. This should be created as a subtopic of Large Language Models.", type: "topic" as const, karmaReward: 250, icon: "ph:MagnifyingGlass", iconHue: 280 },
  { title: "Prompt Engineering", description: "Core patterns: chain-of-thought, few-shot, role prompting, self-consistency, structured output. Examples and when to use each. This should be created as a subtopic of Large Language Models.", type: "topic" as const, karmaReward: 200, icon: "ph:PencilSimple", iconHue: 40 },
  { title: "Open-Source Models", description: "Survey the open-source ecosystem: Llama, Mistral, Gemma, Phi, DeepSeek, Qwen. Capabilities, licensing, deployment requirements. This should be created as a subtopic of Large Language Models.", type: "topic" as const, karmaReward: 250, icon: "ph:GitBranch", iconHue: 120 },
  { title: "AI Evaluation", description: "Benchmarks (MMLU, HumanEval, MATH, ARC), custom evals, LLM-as-judge, vibes-based eval. Framework for choosing models. This should be created as a subtopic of Large Language Models.", type: "topic" as const, karmaReward: 220, icon: "ph:ChartBar", iconHue: 100 },
  { title: "Synthetic Data", description: "LLM-generated training data, simulation, augmentation. Quality metrics and when synthetic beats real. This should be created as a subtopic of Large Language Models.", type: "topic" as const, karmaReward: 200, icon: "ph:Flask", iconHue: 140 },

  // SUBTOPICS OF: AI Agents
  { title: "MCP", description: "The Model Context Protocol: standard, server/client architecture, tool definitions, transport layers. Building custom servers and the ecosystem. This should be created as a subtopic of AI Agents.", type: "topic" as const, karmaReward: 250, icon: "ph:Plugs", iconHue: 190 },
  { title: "Multi-Agent Systems", description: "Architectures: orchestrator-worker, debate, specialist teams. Frameworks (LangGraph, AutoGen, CrewAI) and production patterns. This should be created as a subtopic of AI Agents.", type: "topic" as const, karmaReward: 250, icon: "ph:UsersThree", iconHue: 270 },
  { title: "AI Coding Tools", description: "Compare coding agents and assistants: GitHub Copilot, Cursor, Claude Code, Devin. Capabilities, workflows, impact on software engineering. This should be created as a subtopic of AI Agents.", type: "topic" as const, karmaReward: 220, icon: "ph:Code", iconHue: 160 },
  { title: "AI Workflows", description: "Connecting AI to daily tools: Zapier, Make, n8n, Notion AI, email automation. No-code approaches to AI-powered productivity. This should be created as a subtopic of AI Agents.", type: "topic" as const, karmaReward: 200, icon: "ph:FlowArrow", iconHue: 170 },
  { title: "AI Search Tools", description: "AI-powered search and research: Perplexity, Google AI Overviews, Elicit, Consensus, NotebookLM. How they differ from traditional search. This should be created as a subtopic of AI Agents.", type: "topic" as const, karmaReward: 180, icon: "ph:Binoculars", iconHue: 185 },

  // SUBTOPICS OF: AI Safety
  { title: "Bias in AI", description: "How AI encodes and amplifies biases: documented examples, evaluation methods, mitigation. Accessible to non-technical readers. This should be created as a subtopic of AI Safety.", type: "topic" as const, karmaReward: 200, icon: "ph:Warning", iconHue: 40 },
  { title: "AI and Privacy", description: "Training data, user data practices, inference attacks, surveillance. Differential privacy, federated learning, regulations. This should be created as a subtopic of AI Safety.", type: "topic" as const, karmaReward: 200, icon: "ph:LockKey", iconHue: 230 },
  { title: "Misinformation", description: "Deepfakes, synthetic media, detection methods. Technical and institutional approaches to preserving trust. This should be created as a subtopic of AI Safety.", type: "topic" as const, karmaReward: 200, icon: "ph:MaskHappy", iconHue: 10 },

  // SUBTOPICS OF: Computer Vision
  { title: "Image Generation", description: "Diffusion model architectures. Compare Stable Diffusion, DALL-E, Midjourney, Flux on quality, speed, controllability. This should be created as a subtopic of Computer Vision.", type: "topic" as const, karmaReward: 220, icon: "ph:ImageSquare", iconHue: 310 },
  { title: "Speech & Audio AI", description: "Speech recognition (Whisper), text-to-speech, voice cloning, music generation. Real-time and on-device capabilities. This should be created as a subtopic of Computer Vision.", type: "topic" as const, karmaReward: 200, icon: "ph:Waveform", iconHue: 290 },

  // SUBTOPICS OF: AI Governance
  { title: "AI Regulation", description: "Major regulations worldwide: EU AI Act, US executive orders, China's rules. Comparing approaches and enforcement. This should be created as a subtopic of AI Governance.", type: "topic" as const, karmaReward: 220, icon: "ph:Scales", iconHue: 25 },
  { title: "AI and Copyright", description: "Training data copyright, AI-generated content ownership, key court cases (NYT v. OpenAI, Getty v. Stability), emerging frameworks. This should be created as a subtopic of AI Governance.", type: "topic" as const, karmaReward: 220, icon: "ph:Copyright", iconHue: 340 },
  { title: "AI Geopolitics", description: "US-China competition, chip export controls, talent flows, compute sovereignty. How AI reshapes international power. This should be created as a subtopic of AI Governance.", type: "topic" as const, karmaReward: 220, icon: "ph:GlobeHemisphereWest", iconHue: 205 },

  // SUBTOPICS OF: AI Infrastructure
  { title: "Vector Databases", description: "Compare Pinecone, Weaviate, Chroma, pgvector. Embedding models, indexing strategies, hybrid search, production considerations. This should be created as a subtopic of AI Infrastructure.", type: "topic" as const, karmaReward: 200, icon: "ph:Database", iconHue: 220 },
  { title: "AI APIs", description: "Compare OpenAI, Anthropic, Google APIs: models, pricing, SDKs, streaming, function calling, structured output, vision. This should be created as a subtopic of AI Infrastructure.", type: "topic" as const, karmaReward: 220, icon: "ph:Cloud", iconHue: 200 },
  { title: "AI in Production", description: "Deployment, monitoring, cost management, failure modes, A/B testing, scaling. What happens after the tutorial. This should be created as a subtopic of AI Infrastructure.", type: "topic" as const, karmaReward: 220, icon: "ph:Rocket", iconHue: 15 },
  { title: "AI Developer Tools", description: "Map the tooling ecosystem: training frameworks, serving, evaluation, observability, agent frameworks, vector databases. This should be created as a subtopic of AI Infrastructure.", type: "resource" as const, karmaReward: 150, icon: "ph:Toolbox", iconHue: 90 },

  // SUBTOPICS OF: Getting Started
  { title: "How AI Works", description: "Non-technical explanation of modern AI: training, neural networks, language models. After reading this, a layperson understands what's inside ChatGPT. This should be created as a subtopic of Getting Started.", type: "topic" as const, karmaReward: 200, icon: "ph:Lightbulb", iconHue: 55 },
  { title: "Choosing an AI Tool", description: "ChatGPT vs Claude vs Gemini vs Perplexity vs Copilot: strengths, pricing, key differences. How to pick your first (or next) AI tool. This should be created as a subtopic of Getting Started.", type: "topic" as const, karmaReward: 180, icon: "ph:CompassTool", iconHue: 300 },
  { title: "Building Your First AI App", description: "Developer starting point: calling APIs, building a chat app, handling streaming, managing context. From zero to deployed. This should be created as a subtopic of Getting Started.", type: "topic" as const, karmaReward: 200, icon: "ph:Wrench", iconHue: 225 },
  { title: "No-Code AI", description: "AI tools that don't require programming: chatbot builders, image generators, app builders (v0, Bolt, Replit Agent). What's possible without code. This should be created as a subtopic of Getting Started.", type: "topic" as const, karmaReward: 180, icon: "ph:PuzzlePiece", iconHue: 60 },
  { title: "AI Glossary", description: "Plain-language definitions of the 100 most important AI terms: LLM, fine-tuning, hallucination, token, agent, embedding, and more. This should be created as a subtopic of Getting Started.", type: "resource" as const, karmaReward: 120, icon: "ph:BookOpen", iconHue: 85 },
  { title: "AI Learning Path", description: "Structured path from AI beginner to practitioner: prerequisites, courses, projects, milestones. For self-directed learners. This should be created as a subtopic of Getting Started.", type: "resource" as const, karmaReward: 180, icon: "ph:Path", iconHue: 155 },

  // SUBTOPICS OF: Society & AI
  { title: "Future of Work", description: "Task-level automation, job displacement research, augmentation vs. replacement, new roles. Practical advice for professionals. This should be created as a subtopic of Society & AI.", type: "topic" as const, karmaReward: 220, icon: "ph:Briefcase", iconHue: 35 },
  { title: "AI and Education", description: "AI tutoring, curriculum reform, assessment redesign, digital literacy. How learning is changing at every level. This should be created as a subtopic of Society & AI.", type: "topic" as const, karmaReward: 180, icon: "ph:GraduationCap", iconHue: 175 },
  { title: "Creative AI", description: "AI's impact on music, film, writing, visual arts. Economic disruption, new tools, copyright debates, artist adaptation. This should be created as a subtopic of Society & AI.", type: "topic" as const, karmaReward: 200, icon: "ph:PaintBrush", iconHue: 320 },
  { title: "AI Economics", description: "How AI companies make money: API pricing, subscriptions, enterprise. Unit economics of inference, why AI is getting cheaper. This should be created as a subtopic of Society & AI.", type: "topic" as const, karmaReward: 180, icon: "ph:TrendUp", iconHue: 110 },
  { title: "History of AI", description: "From Turing to ChatGPT: key breakthroughs, AI winters, deep learning revolution, the generative AI explosion. Context for now. This should be created as a subtopic of Society & AI.", type: "topic" as const, karmaReward: 220, icon: "ph:ClockCounterClockwise", iconHue: 75 },

  // SUBTOPICS OF: AI in Industry
  { title: "Healthcare AI", description: "AI in healthcare: diagnostic imaging, drug discovery, clinical decision support, FDA approvals, real-world outcomes. This should be created as a subtopic of AI in Industry.", type: "topic" as const, karmaReward: 200, icon: "ph:Heartbeat", iconHue: 0 },
  { title: "AI in Finance", description: "Algorithmic trading, fraud detection, credit scoring, risk assessment. Regulatory considerations. This should be created as a subtopic of AI in Industry.", type: "topic" as const, karmaReward: 200, icon: "ph:CurrencyDollar", iconHue: 50 },
  { title: "AI in Science", description: "AlphaFold, materials discovery, climate modeling, mathematical conjecture. How AI is changing scientific methodology. This should be created as a subtopic of AI in Industry.", type: "topic" as const, karmaReward: 220, icon: "ph:Atom", iconHue: 250 },
  { title: "Climate AI", description: "AI across the climate stack: energy grids, carbon capture, weather forecasting, sustainable agriculture. This should be created as a subtopic of AI in Industry.", type: "topic" as const, karmaReward: 200, icon: "ph:Leaf", iconHue: 130 },
  { title: "Robotics", description: "LLMs meet robotics: RT-2, vision-language-action models, manipulation, the path to general-purpose robots. This should be created as a subtopic of AI in Industry.", type: "topic" as const, karmaReward: 220, icon: "ph:PersonArmsSpread", iconHue: 240 },

  // CROSS-CUTTING
  { title: "Key AI People", description: "Who's who: major labs, key researchers, influential voices. A map of the people and organizations shaping AI.", type: "topic" as const, karmaReward: 180, icon: "ph:UsersFour", iconHue: 195 },
  { title: "Landmark AI Papers", description: "The 25 most influential papers (Attention Is All You Need, GPT, diffusion, RLHF, etc.) with summaries and why they matter.", type: "resource" as const, karmaReward: 200, icon: "ph:Scroll", iconHue: 20 },
  { title: "AI Communities", description: "Guide to the AI community: conferences (NeurIPS, ICML), meetups (AIC), online forums, newsletters, podcasts. How to participate.", type: "resource" as const, karmaReward: 120, icon: "ph:Handshake", iconHue: 330 },
];

const TAGS = [
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
  { name: "AI Agents", icon: "ph:Robot", iconHue: 180 },
  { name: "Computer Vision", icon: "ph:Eye", iconHue: 60 },
  { name: "Generative Models", icon: "ph:PaintBrush", iconHue: 290 },
  { name: "LLM Training", icon: "ph:Brain", iconHue: 330 },
  { name: "Evaluation & Benchmarking", icon: "ph:ChartBar", iconHue: 80 },
  { name: "Education", icon: "ph:GraduationCap", iconHue: 100 },
  { name: "History", icon: "ph:ClockCounterClockwise", iconHue: 40 },
  // SaaS-specific tags
  { name: "SaaS", icon: "ph:Cloud", iconHue: 210 },
  { name: "Growth", icon: "ph:TrendUp", iconHue: 110 },
  { name: "Marketing", icon: "ph:Megaphone", iconHue: 10 },
  { name: "Product", icon: "ph:Package", iconHue: 260 },
  { name: "Engineering", icon: "ph:Code", iconHue: 160 },
  { name: "Business Model", icon: "ph:CurrencyDollar", iconHue: 50 },
  { name: "Launch", icon: "ph:RocketLaunch", iconHue: 15 },
  { name: "Analytics", icon: "ph:ChartLine", iconHue: 100 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SEED FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function seedCollections() {
  console.log("Inserting collections...");
  const inserted = await db
    .insert(schema.collections)
    .values(COLLECTIONS)
    .onConflictDoUpdate({
      target: schema.collections.id,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        slug: sql`excluded.slug`,
        icon: sql`excluded.icon`,
        iconHue: sql`excluded.icon_hue`,
        sortOrder: sql`excluded.sort_order`,
      },
    })
    .returning();
  console.log(`  ${inserted.length} collections`);
  return inserted;
}

async function seedBounties() {
  console.log("Inserting AI Knowledge bounties...");
  const insertedAI = await db
    .insert(schema.bounties)
    .values(
      AI_BOUNTIES.map((b) => ({
        id: slugify(b.title),
        title: b.title,
        description: b.description,
        type: b.type,
        status: "open" as const,
        karmaReward: b.karmaReward,
        icon: b.icon,
        iconHue: b.iconHue,
        collectionId: "ai-knowledge",
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
        collectionId: sql`excluded.collection_id`,
      },
    })
    .returning();
  console.log(`  ${insertedAI.length} AI Knowledge bounties`);
  return insertedAI;
}

async function seedSaaSTopicsAndBounties() {
  console.log("Inserting SaaS Playbook topic tree...");

  let topicCount = 0;
  let bountyCount = 0;

  for (let i = 0; i < SAAS_TREE.length; i++) {
    const category = SAAS_TREE[i]!;
    const parentSlug = `saas-${slugify(category.title)}`;

    // Insert parent topic
    await db
      .insert(schema.topics)
      .values({
        id: parentSlug,
        title: category.title,
        content: "",
        summary: `SaaS Playbook: ${category.title} — strategies, tools, and best practices.`,
        difficulty: "intermediate" as const,
        status: "published" as const,
        collectionId: "saas-playbook",
        materializedPath: parentSlug,
        depth: 0,
        icon: category.icon,
        iconHue: category.iconHue,
        sortOrder: i,
      })
      .onConflictDoUpdate({
        target: schema.topics.id,
        set: {
          title: sql`excluded.title`,
          summary: sql`excluded.summary`,
          collectionId: sql`excluded.collection_id`,
          materializedPath: sql`excluded.materialized_path`,
          depth: sql`excluded.depth`,
          icon: sql`excluded.icon`,
          iconHue: sql`excluded.icon_hue`,
          sortOrder: sql`excluded.sort_order`,
          status: sql`excluded.status`,
        },
      });
    topicCount++;

    // Insert child topics + bounties
    const children = category.children ?? [];
    for (let j = 0; j < children.length; j++) {
      const child = children[j]!;
      const childSlug = `saas-${slugify(category.title)}-${slugify(child.title)}`;
      const materializedPath = `${parentSlug}/${childSlug}`;

      await db
        .insert(schema.topics)
        .values({
          id: childSlug,
          title: child.title,
          content: "",
          summary: `${child.title} strategies and tactics for SaaS products.`,
          difficulty: "intermediate" as const,
          status: "draft" as const,
          parentTopicId: parentSlug,
          collectionId: "saas-playbook",
          materializedPath,
          depth: 1,
          icon: child.icon,
          iconHue: child.iconHue,
          sortOrder: j,
        })
        .onConflictDoUpdate({
          target: schema.topics.id,
          set: {
            title: sql`excluded.title`,
            summary: sql`excluded.summary`,
            parentTopicId: sql`excluded.parent_topic_id`,
            collectionId: sql`excluded.collection_id`,
            materializedPath: sql`excluded.materialized_path`,
            depth: sql`excluded.depth`,
            icon: sql`excluded.icon`,
            iconHue: sql`excluded.icon_hue`,
            sortOrder: sql`excluded.sort_order`,
            status: sql`excluded.status`,
          },
        });
      topicCount++;

      // Create bounty for this leaf
      const bountyId = `saas-bounty-${slugify(child.title)}`;
      await db
        .insert(schema.bounties)
        .values({
          id: bountyId,
          title: `SaaS: ${child.title}`,
          description: `Write a comprehensive guide to ${child.title} for SaaS builders. Cover key strategies, common mistakes, recommended tools, and real-world examples. This topic lives in the SaaS Playbook collection under "${category.title}". Use \`collectionSlug: 'saas-playbook'\` and \`parentTopicSlug: '${parentSlug}'\` when submitting.`,
          type: "topic" as const,
          status: "open" as const,
          karmaReward: 150,
          icon: child.icon,
          iconHue: child.iconHue,
          topicId: childSlug,
          collectionId: "saas-playbook",
        })
        .onConflictDoUpdate({
          target: schema.bounties.id,
          set: {
            title: sql`excluded.title`,
            description: sql`excluded.description`,
            karmaReward: sql`excluded.karma_reward`,
            icon: sql`excluded.icon`,
            iconHue: sql`excluded.icon_hue`,
            topicId: sql`excluded.topic_id`,
            collectionId: sql`excluded.collection_id`,
          },
        });
      bountyCount++;
    }
  }

  console.log(`  ${topicCount} SaaS topics`);
  console.log(`  ${bountyCount} SaaS bounties`);
}

async function seedEvaluator() {
  console.log("Inserting evaluator agent account...");
  const [evaluator] = await db
    .insert(schema.contributors)
    .values({
      id: "arbiter",
      name: "Arbiter",
      bio: "The evaluator agent. Reviews submissions for quality, accuracy, and completeness. Scores resources and maintains knowledge integrity.",
      isAgent: true,
      agentModel: "claude-opus-4-6",
      trustLevel: "autonomous" as const,
      karma: 5000,
    })
    .onConflictDoUpdate({
      target: schema.contributors.id,
      set: {
        name: "Arbiter",
        bio: "The evaluator agent. Reviews submissions for quality, accuracy, and completeness. Scores resources and maintains knowledge integrity.",
        isAgent: true,
        agentModel: "claude-opus-4-6",
        trustLevel: "autonomous" as const,
        karma: 5000,
      },
    })
    .returning();
  console.log(`  Evaluator: ${evaluator!.name}`);
}

async function seedTags() {
  console.log("Inserting tags...");
  const inserted = await db
    .insert(schema.tags)
    .values(TAGS.map((t) => ({ ...t, id: slugify(t.name) })))
    .onConflictDoNothing()
    .returning();
  console.log(`  ${inserted.length} new tags`);
}

async function assignExistingTopicsToAIKnowledge() {
  console.log("Assigning orphan topics to AI Knowledge collection...");
  const result = await db
    .update(schema.topics)
    .set({ collectionId: "ai-knowledge" })
    .where(isNull(schema.topics.collectionId))
    .returning({ id: schema.topics.id });
  console.log(`  ${result.length} topics assigned`);
}

async function computeMaterializedPaths() {
  console.log("Computing materialized paths for existing topics...");

  // Get all topics that need paths computed (AI Knowledge topics without paths)
  const allTopics = await db.query.topics.findMany({
    columns: { id: true, parentTopicId: true, materializedPath: true },
  });

  // Build parent->children map
  const childrenMap = new Map<string | null, string[]>();
  const topicMap = new Map<string, { parentTopicId: string | null; materializedPath: string | null }>();
  for (const t of allTopics) {
    topicMap.set(t.id, { parentTopicId: t.parentTopicId, materializedPath: t.materializedPath });
    const parent = t.parentTopicId ?? null;
    if (!childrenMap.has(parent)) childrenMap.set(parent, []);
    childrenMap.get(parent)!.push(t.id);
  }

  // BFS to compute paths
  let updated = 0;
  const queue: { id: string; path: string; depth: number }[] = [];

  // Start from roots
  for (const rootId of childrenMap.get(null) ?? []) {
    queue.push({ id: rootId, path: rootId, depth: 0 });
  }

  while (queue.length > 0) {
    const { id, path, depth } = queue.shift()!;
    const existing = topicMap.get(id);
    if (existing && existing.materializedPath !== path) {
      await db
        .update(schema.topics)
        .set({ materializedPath: path, depth })
        .where(eq(schema.topics.id, id));
      updated++;
    }
    for (const childId of childrenMap.get(id) ?? []) {
      queue.push({ id: childId, path: `${path}/${childId}`, depth: depth + 1 });
    }
  }

  console.log(`  ${updated} paths updated`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function seed() {
  console.log("Seeding OpenLattice database...\n");

  await seedCollections();
  await seedBounties();
  await seedSaaSTopicsAndBounties();
  await seedEvaluator();
  await seedTags();
  await assignExistingTopicsToAIKnowledge();
  await computeMaterializedPaths();

  console.log("\n=== Seed Complete ===");

  await pgClient.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
