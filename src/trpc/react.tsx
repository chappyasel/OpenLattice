"use client";

import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import {
  httpLink,
  loggerLink,
  splitLink,
  unstable_httpBatchStreamLink,
} from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import SuperJSON from "superjson";

import { type AppRouter } from "@/server/api/root";
import { createQueryClient } from "./query-client";

let clientQueryClientSingleton: QueryClient | undefined;
const getQueryClient = () => {
  if (typeof window === "undefined") return createQueryClient();
  if (!clientQueryClientSingleton) {
    clientQueryClientSingleton = createQueryClient();
  }
  return clientQueryClientSingleton;
};

export const api = createTRPCReact<AppRouter>();

export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

const persister =
  typeof window !== "undefined"
    ? createSyncStoragePersister({
        storage: window.localStorage,
        key: "ol-query-cache",
        serialize: (data) => SuperJSON.stringify(data),
        deserialize: (data) => SuperJSON.parse(data),
      })
    : undefined;

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        splitLink({
          condition: (op) => op.context.skipBatch === true,
          true: httpLink({
            transformer: SuperJSON,
            url: `${getBaseUrl()}/api/trpc`,
            headers: () => {
              const headers = new Headers();
              headers.set("x-trpc-source", "nextjs-react");
              return headers;
            },
          }),
          false: unstable_httpBatchStreamLink({
            transformer: SuperJSON,
            url: `${getBaseUrl()}/api/trpc`,
            headers: () => {
              const headers = new Headers();
              headers.set("x-trpc-source", "nextjs-react");
              return headers;
            },
          }),
        }),
      ],
    }),
  );

  const Wrapper =
    typeof window !== "undefined" && persister
      ? ({ children }: { children: React.ReactNode }) => (
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
              persister,
              maxAge: 24 * 60 * 60 * 1000,
              dehydrateOptions: {
                shouldDehydrateQuery: (query) => {
                  const key = query.queryKey as unknown[];
                  if (!Array.isArray(key) || !Array.isArray(key[0]))
                    return false;
                  const path = key[0] as string[];
                  return (
                    (path[0] === "topics" && path[1] === "list") ||
                    (path[0] === "tags" && path[1] === "list")
                  );
                },
              },
            }}
          >
            {children}
          </PersistQueryClientProvider>
        )
      : QueryClientProvider;

  return (
    <Wrapper client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {props.children}
      </api.Provider>
    </Wrapper>
  );
}

function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}
