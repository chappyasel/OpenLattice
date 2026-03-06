"use client";

import { useSyncExternalStore } from "react";
import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// Resolved icon components — synchronous lookup after module loads
const iconCache = new Map<string, ComponentType<IconProps>>();

// Module loading state
let phosphorModule: Record<string, ComponentType<IconProps>> | null = null;
const moduleListeners = new Set<() => void>();

// Start loading immediately when this module is imported
const modulePromise = (
    import("@phosphor-icons/react") as Promise<unknown>
).then((m) => {
    phosphorModule = m as Record<string, ComponentType<IconProps>>;
    moduleListeners.forEach((l) => l());
});

// Subscribe to module load for useSyncExternalStore
function subscribeToModule(callback: () => void) {
    moduleListeners.add(callback);
    return () => {
        moduleListeners.delete(callback);
    };
}

function getModuleLoaded() {
    return phosphorModule !== null;
}

function getPhosphorIcon(name: string): ComponentType<IconProps> | null {
    if (!phosphorModule) return null;
    if (!iconCache.has(name)) {
        const Icon = phosphorModule[name];
        if (Icon) {
            iconCache.set(name, Icon);
        } else {
            return null;
        }
    }
    return iconCache.get(name)!;
}

interface TopicIconProps {
    icon: string | null | undefined;
    hue: number | null | undefined;
    size?: "sm" | "md" | "lg";
    className?: string;
}

export function TopicIcon({ icon, hue, size = "sm", className }: TopicIconProps) {
    // Subscribe to module load — triggers re-render once icons are available
    useSyncExternalStore(subscribeToModule, getModuleLoaded, () => false);

    if (!icon) return null;

    const sizeClass = size === "lg" ? "size-8" : size === "md" ? "size-5" : "size-4";
    const iconSizeClass = size === "lg" ? "size-6" : size === "md" ? "size-4" : "size-3";
    const containerSize = size === "lg" ? "size-8" : size === "md" ? "size-5" : "size-4";

    // Phosphor icon: "ph:IconName"
    if (icon.startsWith("ph:")) {
        const iconName = icon.slice(3);
        const IconComponent = getPhosphorIcon(iconName);

        if (!IconComponent) {
            // Module not loaded yet or invalid name — render placeholder
            if (hue != null) {
                return <span className={`${containerSize} inline-block shrink-0 rounded`} />;
            }
            return <span className={`${sizeClass} inline-block shrink-0`} />;
        }

        if (hue != null) {
            const isTransparent = className?.includes("bg-transparent");
            return (
                <span
                    className={cn(
                        `${containerSize} inline-flex shrink-0 items-center justify-center rounded`,
                        className,
                    )}
                    style={{
                        ...(isTransparent
                            ? {}
                            : {
                                  "--icon-bg": `hsl(${hue} 80% 92%)`,
                                  "--icon-bg-dark": `hsl(${hue} 50% 18%)`,
                                  backgroundColor: "var(--icon-bg)",
                              }),
                        "--icon-fg": `hsl(${hue} 70% 45%)`,
                        "--icon-fg-dark": `hsl(${hue} 70% 72%)`,
                        color: "var(--icon-fg)",
                    } as React.CSSProperties}
                >
                    <IconComponent weight="bold" className={iconSizeClass} />
                </span>
            );
        }

        return <IconComponent weight="bold" className={`${sizeClass} shrink-0`} />;
    }

    // Image: "img:url"
    if (icon.startsWith("img:")) {
        const src = icon.slice(4);
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className={`${sizeClass} shrink-0 rounded object-cover`} />
        );
    }

    // Emoji (default)
    if (hue != null) {
        return (
            <span
                className={`${containerSize} inline-flex shrink-0 items-center justify-center rounded text-xs leading-none`}
                style={{
                    "--icon-bg": `hsl(${hue} 80% 92%)`,
                    "--icon-bg-dark": `hsl(${hue} 50% 18%)`,
                    backgroundColor: "var(--icon-bg)",
                } as React.CSSProperties}
            >
                {icon}
            </span>
        );
    }

    return (
        <span
            className={`${sizeClass} inline-flex shrink-0 items-center justify-center text-xs leading-none`}
        >
            {icon}
        </span>
    );
}
