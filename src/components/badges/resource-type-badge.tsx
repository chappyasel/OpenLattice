"use client";

import {
    ArticleIcon,
    ScrollIcon,
    BookOpenIcon,
    GraduationCapIcon,
    PlayIcon,
    WaveformIcon,
    DatabaseIcon,
    WrenchIcon,
    CubeIcon,
    BooksIcon,
    GitBranchIcon,
    TerminalIcon,
    FlowArrowIcon,
    ChartBarIcon,
    FileIcon,
    ChatCircleIcon,
    UsersThreeIcon,
    CalendarBlankIcon,
    BuildingsIcon,
    UserIcon,
    LightbulbIcon,
    ScalesIcon,
    ListBulletsIcon,
    EnvelopeIcon,
    MegaphoneIcon,
    ChalkboardTeacherIcon,
    FileCodeIcon,
} from "@phosphor-icons/react";
import type { ComponentType } from "react";
import type { IconWeight } from "@phosphor-icons/react";
import { cn, getBadgeColors } from "@/lib/utils";
import { type BadgeSize, baseBadge, sizeClasses } from "./shared";

const resourceTypeConfig: Record<string, { hue: number; saturation?: number; icon: ComponentType<{ weight?: IconWeight; className?: string }> }> = {
    article:      { hue: 200, icon: ArticleIcon },
    paper:        { hue: 220, icon: ScrollIcon },
    book:         { hue: 240, icon: BookOpenIcon },
    course:       { hue: 30,  icon: GraduationCapIcon },
    video:        { hue: 0,   icon: PlayIcon },
    podcast:      { hue: 330, icon: WaveformIcon },
    dataset:      { hue: 150, icon: DatabaseIcon },
    tool:         { hue: 270, icon: WrenchIcon },
    model:        { hue: 280, icon: CubeIcon },
    library:      { hue: 180, icon: BooksIcon },
    repository:   { hue: 170, icon: GitBranchIcon },
    prompt:       { hue: 45,  icon: TerminalIcon },
    workflow:     { hue: 190, icon: FlowArrowIcon },
    benchmark:    { hue: 80,  icon: ChartBarIcon },
    report:       { hue: 60,  icon: FileIcon },
    discussion:   { hue: 340, icon: ChatCircleIcon },
    community:    { hue: 300, icon: UsersThreeIcon },
    event:        { hue: 50,  icon: CalendarBlankIcon },
    organization: { hue: 210, icon: BuildingsIcon },
    person:       { hue: 15,  icon: UserIcon },
    concept:      { hue: 120, icon: LightbulbIcon },
    comparison:   { hue: 160, icon: ScalesIcon },
    curated_list: { hue: 100, icon: ListBulletsIcon },
    newsletter:   { hue: 25,  icon: EnvelopeIcon },
    social_media: { hue: 310, icon: MegaphoneIcon },
    tutorial:     { hue: 35,  icon: ChalkboardTeacherIcon },
    documentation:{ hue: 195, icon: FileCodeIcon },
};

export function ResourceTypeBadge({ type, size = "default" }: { type: string; size?: BadgeSize }) {
    const config = resourceTypeConfig[type];
    const colors = config
        ? getBadgeColors(config.hue, config.saturation)
        : getBadgeColors(0, 0);
    const Icon = config?.icon;

    return (
        <span
            className={cn(baseBadge, sizeClasses[size], "gap-1 capitalize")}
            style={{
                backgroundColor: colors.bg,
                color: colors.fg,
                borderColor: colors.border,
            }}
        >
            {Icon && <Icon weight="bold" className="size-3" />}
            {type.replace("_", " ")}
        </span>
    );
}
