/**
 * URL verification for evaluator — performs HEAD requests to check if
 * resource URLs actually exist, feeding results into the AI evaluation.
 */

export interface UrlVerificationResult {
  url: string;
  status: "live" | "plausible" | "dead" | "skipped";
  httpStatus?: number;
  redirectedTo?: string;
  error?: string;
  durationMs: number;
}

const USER_AGENT =
  "Mozilla/5.0 (compatible; OpenLattice-Evaluator/1.0; +https://wiki.aicollective.com)";

async function verifyOneUrl(
  url: string,
  timeoutMs: number,
): Promise<UrlVerificationResult> {
  const start = Date.now();

  // Skip non-HTTP URLs
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return { url, status: "skipped", durationMs: 0 };
  }

  // Skip localhost / private IPs
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname.startsWith("192.168.") ||
      parsed.hostname.startsWith("10.")
    ) {
      return { url, status: "skipped", durationMs: 0 };
    }
  } catch {
    return {
      url,
      status: "dead",
      error: "Invalid URL",
      durationMs: Date.now() - start,
    };
  }

  try {
    // Try HEAD first
    let res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });

    // Some servers reject HEAD — fall back to GET with range
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": USER_AGENT,
          Range: "bytes=0-0",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
      });
    }

    const durationMs = Date.now() - start;
    const httpStatus = res.status;
    const redirectedTo =
      res.redirected && res.url !== url ? res.url : undefined;

    // Classify
    if (httpStatus >= 200 && httpStatus < 400) {
      return { url, status: "live", httpStatus, redirectedTo, durationMs };
    }
    if (httpStatus === 401 || httpStatus === 403 || httpStatus === 429) {
      // Paywall, auth-gated, or rate-limited — probably real
      return { url, status: "plausible", httpStatus, durationMs };
    }
    // 404, 410, 5xx, etc.
    return { url, status: "dead", httpStatus, durationMs };
  } catch (err: any) {
    const durationMs = Date.now() - start;
    const errorMsg =
      err.name === "TimeoutError"
        ? "Timeout"
        : err.cause?.code === "ENOTFOUND"
          ? "DNS not found"
          : err.message?.slice(0, 80) ?? "Unknown error";

    return { url, status: "dead", error: errorMsg, durationMs };
  }
}

/**
 * Verify a list of URLs by making HEAD requests.
 * Runs up to `maxConcurrent` requests in parallel with an overall time cap.
 */
export async function verifyUrls(
  urls: string[],
  options?: { timeoutMs?: number; maxConcurrent?: number; totalTimeoutMs?: number },
): Promise<UrlVerificationResult[]> {
  const timeoutMs = options?.timeoutMs ?? 5000;
  const maxConcurrent = options?.maxConcurrent ?? 5;
  const totalTimeoutMs = options?.totalTimeoutMs ?? 15000;

  const unique = [...new Set(urls)];
  if (unique.length === 0) return [];

  const results: UrlVerificationResult[] = [];
  const totalStart = Date.now();

  // Simple concurrency limiter
  let running = 0;
  let idx = 0;

  await new Promise<void>((resolve) => {
    function next() {
      // Check total timeout
      if (Date.now() - totalStart > totalTimeoutMs) {
        // Mark remaining as skipped
        while (idx < unique.length) {
          results.push({
            url: unique[idx]!,
            status: "skipped",
            error: "Total timeout exceeded",
            durationMs: 0,
          });
          idx++;
        }
        if (running === 0) resolve();
        return;
      }

      while (running < maxConcurrent && idx < unique.length) {
        const url = unique[idx]!;
        idx++;
        running++;
        verifyOneUrl(url, timeoutMs).then((result) => {
          results.push(result);
          running--;
          if (idx >= unique.length && running === 0) {
            resolve();
          } else {
            next();
          }
        });
      }
    }
    next();
  });

  return results;
}
