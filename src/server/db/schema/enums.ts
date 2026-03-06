import { pgEnum } from "drizzle-orm/pg-core";

export const difficultyEnum = pgEnum("difficulty", [
  "beginner",
  "intermediate",
  "advanced",
]);

export const topicStatusEnum = pgEnum("topic_status", [
  "draft",
  "published",
  "archived",
]);
