"use client";

import { use } from "react";
import Link from "next/link";
import { BookOpenIcon, LinkIcon } from "@phosphor-icons/react";
import { api } from "@/trpc/react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ResourceTypeBadge } from "@/components/badges";
import { Breadcrumb } from "@/components/breadcrumb";

export default function TypePage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = use(params);
  const { data: resources, isLoading } = api.resources.list.useQuery({ type: type as never });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <Breadcrumb segments={[{ label: "Home", href: "/" }, { label: type.replace("_", " ") }]} />

        {/* Header */}
        <div className="mb-8 rounded-2xl border border-border/50 bg-card p-6 md:p-8">
          <div className="mb-3 flex items-center gap-3">
            <ResourceTypeBadge type={type} size="lg" />
          </div>
          <p className="text-muted-foreground leading-relaxed">
            All resources of type &ldquo;{type.replace("_", " ")}&rdquo;
          </p>
        </div>

        {/* Resources */}
        {resources && resources.length > 0 ? (
          <div>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <BookOpenIcon weight="bold" className="size-5" />
              Resources
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                {resources.length}
              </span>
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {resources.map((resource) => (
                <div
                  key={resource.id}
                  className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-5 transition-colors hover:border-border"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="mb-2">
                        <ResourceTypeBadge type={resource.type} />
                      </div>
                      <h3 className="font-semibold leading-snug">{resource.name}</h3>
                    </div>
                    {resource.url && (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-lg border border-border p-2 text-muted-foreground hover:border-brand-blue hover:text-brand-blue"
                      >
                        <LinkIcon weight="bold" className="size-4" />
                      </a>
                    )}
                  </div>
                  {resource.summary && (
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                      {resource.summary}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <BookOpenIcon weight="thin" className="mb-3 size-12 text-muted-foreground/40" />
            <p className="text-muted-foreground">No resources of this type yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
