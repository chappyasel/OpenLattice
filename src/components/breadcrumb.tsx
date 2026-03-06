import Link from "next/link";
import { CaretRightIcon } from "@phosphor-icons/react";

interface BreadcrumbSegment {
  label: string;
  href?: string;
}

export function Breadcrumb({ segments }: { segments: BreadcrumbSegment[] }) {
  return (
    <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
      {segments.map((segment, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <CaretRightIcon weight="bold" className="size-3 shrink-0" />}
          {segment.href ? (
            <Link href={segment.href} className="hover:text-foreground transition-colors">
              {segment.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{segment.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
