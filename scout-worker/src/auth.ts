import type { MiddlewareHandler } from "hono";

export function bearerAuth(secret: string): MiddlewareHandler {
  return async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || authHeader !== `Bearer ${secret}`) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  };
}
