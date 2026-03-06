const baseUrl =
  process.env.OPENLATTICE_URL ?? "http://localhost:3000";
const apiKey = process.env.OPENLATTICE_API_KEY;

export function hasApiKey() {
  return !!apiKey;
}

export async function trpcQuery(path: string, input: Record<string, unknown>) {
  const url = new URL(`/api/trpc/${path}`, baseUrl);
  url.searchParams.set("input", JSON.stringify({ json: input }));

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`tRPC query ${path} failed (${res.status}): ${text}`);
  }

  const body = await res.json();
  return extractResult(body);
}

export async function trpcMutation(
  path: string,
  input: Record<string, unknown>,
) {
  if (!apiKey) {
    throw new Error(
      "API key required. Set OPENLATTICE_API_KEY to use write operations.",
    );
  }

  const url = new URL(`/api/trpc/${path}`, baseUrl);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ json: input }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`tRPC mutation ${path} failed (${res.status}): ${text}`);
  }

  const body = await res.json();
  return extractResult(body);
}

// SuperJSON wraps results as { result: { data: { json: ..., meta?: ... } } }
// For simple types (no Dates/Maps), meta is absent and json is the plain value
function extractResult(body: Record<string, unknown>): unknown {
  const result = body.result as Record<string, unknown> | undefined;
  if (!result) throw new Error(`Unexpected tRPC response: ${JSON.stringify(body)}`);
  const data = result.data as Record<string, unknown> | undefined;
  if (!data) throw new Error(`Unexpected tRPC response: ${JSON.stringify(body)}`);
  return data.json;
}
