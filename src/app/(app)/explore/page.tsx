"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { api } from "@/trpc/react";
import { Breadcrumb } from "@/components/breadcrumb";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const GraphViewer = dynamic(
    () => import("@/components/graph-viewer").then((m) => m.GraphViewer),
    { ssr: false },
);

export default function ExplorePage() {
    const router = useRouter();
    const { data: graphData, isLoading } = api.graph.getFullGraph.useQuery();

    const graphNodes = useMemo(() => {
        if (!graphData) return [];
        return graphData.nodes.map((node) => ({
            id: node.id,
            title: node.title,
            type: "topic" as const,
            icon: node.icon,
            iconHue: node.iconHue,
            connectionCount:
                graphData.edges.filter(
                    (e) => e.sourceTopicId === node.id || e.targetTopicId === node.id,
                ).length + 1,
        }));
    }, [graphData]);

    const graphEdges = useMemo(
        () =>
            graphData?.edges.map((edge) => ({
                id: edge.id,
                sourceTopicId: edge.sourceTopicId,
                targetTopicId: edge.targetTopicId,
                relationType: edge.relationType,
            })) ?? [],
        [graphData],
    );

    return (
        <div className="flex h-[calc(100vh-2rem)] flex-col bg-background">
            <div className="shrink-0 px-6 pt-6">
                <Breadcrumb
                    segments={[
                        { label: "Home", href: "/" },
                        { label: "Explore" },
                    ]}
                />
            </div>

            <div className="relative flex-1">
                {isLoading ? (
                    <div className="flex h-full items-center justify-center">
                        <LoadingSpinner size="lg" />
                    </div>
                ) : graphNodes.length > 0 ? (
                    <GraphViewer
                        nodes={graphNodes}
                        edges={graphEdges}
                        height="100%"
                        onNodeClick={(node) => {
                            if (node.id) router.push(`/topic/${node.id}`);
                        }}
                    />
                ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        No topics to display yet.
                    </div>
                )}
            </div>
        </div>
    );
}
