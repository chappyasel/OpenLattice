import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

import { topicsRouter } from "./routers/topics";
import { resourcesRouter } from "./routers/resources";
import { graphRouter } from "./routers/graph";
import { searchRouter } from "./routers/search";
import { tagsRouter } from "./routers/tags";
import { submissionsRouter } from "./routers/submissions";
import { bountiesRouter } from "./routers/bounties";
import { contributorsRouter } from "./routers/contributors";
import { activityRouter } from "./routers/activity";
import { expansionsRouter } from "./routers/expansions";
import { evaluatorRouter } from "./routers/evaluator";
import { adminRouter } from "./routers/admin";
import { kudosRouter } from "./routers/kudos";
import { basesRouter } from "./routers/bases";
import { claimsRouter } from "./routers/claims";
import { sessionsRouter } from "./routers/sessions";
import { signalsRouter } from "./routers/signals";

export const appRouter = createTRPCRouter({
  topics: topicsRouter,
  resources: resourcesRouter,
  graph: graphRouter,
  search: searchRouter,
  tags: tagsRouter,
  submissions: submissionsRouter,
  bounties: bountiesRouter,
  contributors: contributorsRouter,
  activity: activityRouter,
  expansions: expansionsRouter,
  evaluator: evaluatorRouter,
  admin: adminRouter,
  kudos: kudosRouter,
  bases: basesRouter,
  claims: claimsRouter,
  sessions: sessionsRouter,
  signals: signalsRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
