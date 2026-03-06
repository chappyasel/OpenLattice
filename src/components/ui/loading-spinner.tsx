import Image from "next/image";
import { cn } from "@/lib/utils";

const sizes = {
    sm: 16,
    md: 24,
    lg: 32,
} as const;

export function LoadingSpinner({
    size = "md",
    className,
}: {
    size?: "sm" | "md" | "lg";
    className?: string;
}) {
    const px = sizes[size];
    return (
        <Image
            src="/images/loading-spinner.png"
            alt=""
            width={px}
            height={px}
            className={cn(
                "animate-spin opacity-70 [animation-duration:1.5s] dark:invert",
                className,
            )}
        />
    );
}
