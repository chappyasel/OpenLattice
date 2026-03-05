import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  adminProcedure,
  apiKeyProcedure,
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import { resources, submissions } from "@/server/db/schema";
import { slugify } from "@/lib/utils";

const resourceTypeValues = [
  "article", "paper", "book", "course", "video", "podcast", "dataset",
  "tool", "model", "library", "repository", "prompt", "workflow",
  "benchmark", "report", "discussion", "community", "event",
  "organization", "person", "concept", "comparison", "curated_list",
] as const;

export const resourcesRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z
        .object({
          type: z.enum(resourceTypeValues).optional(),
          visibility: z
            .enum(["pending_review", "public", "hidden", "archived"])
            .default("public"),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const visibility = input?.visibility ?? "public";
      const conditions = [eq(resources.visibility, visibility)];

      if (input?.type) {
        conditions.push(eq(resources.type, input.type));
      }

      return ctx.db.query.resources.findMany({
        where: and(...conditions),
        with: {
          resourceTags: {
            with: { tag: true },
          },
          submittedBy: true,
        },
        orderBy: [desc(resources.score)],
      });
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const resource = await ctx.db.query.resources.findFirst({
        where: eq(resources.slug, input.slug),
        with: {
          resourceTags: {
            with: { tag: true },
          },
          topicResources: {
            with: { topic: true },
          },
          submittedBy: true,
        },
      });
      return resource ?? null;
    }),

  submit: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        url: z.string().url().optional(),
        type: z.enum(resourceTypeValues),
        summary: z.string().optional(),
        data: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [submission] = await ctx.db
        .insert(submissions)
        .values({
          type: "resource",
          status: "pending",
          data: input as Record<string, unknown>,
          contributorId: ctx.contributor.id,
          source: "web",
        })
        .returning();
      return submission!;
    }),

  submitWithApiKey: apiKeyProcedure
    .input(
      z.object({
        name: z.string().min(1),
        url: z.string().url().optional(),
        type: z.enum(resourceTypeValues),
        summary: z.string().optional(),
        topicSlug: z.string().optional(),
        data: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [submission] = await ctx.db
        .insert(submissions)
        .values({
          type: "resource",
          status: "pending",
          data: input as Record<string, unknown>,
          contributorId: ctx.contributor.id,
          source: "mcp",
        })
        .returning();
      return submission!;
    }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        url: z.string().url().optional(),
        type: z.enum(resourceTypeValues),
        summary: z.string().default(""),
        content: z.string().optional(),
        score: z.number().int().default(0),
        visibility: z
          .enum(["pending_review", "public", "hidden", "archived"])
          .default("public"),
        data: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const slug = slugify(input.name);
      const [resource] = await ctx.db
        .insert(resources)
        .values({ ...input, slug })
        .returning();
      return resource!;
    }),

  review: adminProcedure
    .input(
      z.object({
        id: z.string(),
        visibility: z.enum(["public", "hidden", "archived"]),
        reviewNotes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(resources)
        .set({
          visibility: input.visibility,
          reviewNotes: input.reviewNotes,
          reviewedAt: new Date(),
        })
        .where(eq(resources.id, input.id))
        .returning();
      return updated!;
    }),
});
