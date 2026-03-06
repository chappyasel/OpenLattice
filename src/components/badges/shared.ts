export type BadgeSize = "sm" | "default" | "lg";

export const sizeClasses: Record<BadgeSize, string> = {
    sm: "px-2.5 py-0.5 text-[11px]",
    default: "px-3 py-0.5 text-xs",
    lg: "px-2.5 py-1 text-sm",
};

export const baseBadge = "inline-flex items-center rounded-full border font-semibold";
