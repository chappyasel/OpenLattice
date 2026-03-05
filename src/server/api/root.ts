import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

import { topicsRouter } from "./routers/topics";
import { resourcesRouter } from "./routers/resources";
import { graphRouter } from "./routers/graph";
import { searchRouter } from "./routers/search";
import { tagsRouter } from "./routers/tags";
import { submissionsRouter } from "./routers/submissions";
import { bountiesRouter } from "./routers/bounties";
import { contributorsRouter } from "./routers/contributors";
import { claimsRouter } from "./routers/claims";
import { activityRouter } from "./routers/activity";
import { expansionsRouter } from "./routers/expansions";
import { evaluatorRouter } from "./routers/evaluator";
import { adminRouter } from "./routers/admin";

export const appRouter = createTRPCRouter({
  topics: topicsRouter,
  resources: resourcesRouter,
  graph: graphRouter,
  search: searchRouter,
  tags: tagsRouter,
  submissions: submissionsRouter,
  bounties: bountiesRouter,
  contributors: contributorsRouter,
  claims: claimsRouter,
  activity: activityRouter,
  expansions: expansionsRouter,
  evaluator: evaluatorRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
