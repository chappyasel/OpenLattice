"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraphCanvas, GraphCanvasRef, useSelection } from "reagraph";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { TopicIcon } from "@/components/topic-icon";

interface GraphNode {
  id: string;
  title: string;
  type: "topic";
  icon?: string | null;
  iconHue?: number | null;
  connectionCount?: number;
}

interface GraphEdge {
  id: string;
  sourceTopicId: string;
  targetTopicId: string;
  relationType?: string;
}

interface GraphViewerProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  height?: string;
  onNodeClick?: (node: GraphNode) => void;
  selectedNodeId?: string;
  /** When true, prevents zoom/pan/drag interactions (click-through for node clicks still works via the overlay) */
  disableZoom?: boolean;
}

interface EdgeData {
  sourceTitle: string;
  targetTitle: string;
  relationType: string;
}

const BRAND_BLUE = "#0076db";
const BRAND_ORANGE = "#f59e0b";
const EDGE_COLOR = "#0076db";

const RELATION_STYLES: Record<string, { dashed?: boolean; dashArray?: [number, number] }> = {
  related: {},
  prerequisite: { dashed: true, dashArray: [6, 3] },
  subtopic: { dashed: true, dashArray: [2, 2] },
  see_also: { dashed: true, dashArray: [8, 4] },
};

const RELATION_LABELS: Record<string, string> = {
  related: "Related",
  prerequisite: "Prerequisite",
  subtopic: "Subtopic",
  see_also: "See Also",
};

function getNodeColor(iconHue?: number | null, nodeId?: string): string {
  // Match TopicIcon's --icon-fg: hsl(hue 70% 45%)
  if (iconHue != null) return `hsl(${iconHue}, 70%, 45%)`;
  if (nodeId) {
    let hash = 0;
    for (let i = 0; i < nodeId.length; i++) {
      hash = ((hash << 5) - hash + nodeId.charCodeAt(i)) | 0;
    }
    return `hsl(${Math.abs(hash) % 360}, 70%, 45%)`;
  }
  return BRAND_BLUE;
}

export function GraphViewer({
  nodes,
  edges,
  height = "600px",
  onNodeClick,
  selectedNodeId,
  disableZoom,
}: GraphViewerProps) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const graphRef = useRef<GraphCanvasRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Poll until the canvas element has actually rendered content
    const check = () => {
      const canvas = containerRef.current?.querySelector("canvas");
      if (canvas) {
        // Give the canvas one extra frame to paint
        requestAnimationFrame(() => setVisible(true));
      } else {
        requestAnimationFrame(check);
      }
    };
    requestAnimationFrame(check);
  }, []);
  const [tooltip, setTooltip] = useState<{
    type: "node" | "edge";
    label: string;
    sublabel: string;
    icon?: string | null;
    iconHue?: number | null;
    color?: string;
    screenX: number;
    screenY: number;
  } | null>(null);

  const mousePos = useRef({ screenX: 0, screenY: 0 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      mousePos.current = { screenX: e.clientX, screenY: e.clientY };
    };
    el.addEventListener("mousemove", onMove);
    return () => el.removeEventListener("mousemove", onMove);
  }, []);

  const graphNodes = useMemo(
    () =>
      nodes.map((node) => ({
        id: node.id,
        label: node.title,
        fill: getNodeColor(node.iconHue, node.id),
        size: Math.min(50, 18 + 32 * Math.pow(Math.min(node.connectionCount ?? 1, 50) / 50, 2)),
        data: node,
      })),
    [nodes],
  );

  const graphEdges = useMemo(
    () => {
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      return edges
        .filter((e) => nodeMap.has(e.sourceTopicId) && nodeMap.has(e.targetTopicId))
        .map((edge) => {
          const rel = edge.relationType ?? "related";
          const style = RELATION_STYLES[rel] ?? {};
          return {
            id: edge.id,
            source: edge.sourceTopicId,
            target: edge.targetTopicId,
            fill: EDGE_COLOR,
            size: 4,
            ...style,
            data: {
              sourceTitle: nodeMap.get(edge.sourceTopicId)?.title ?? "",
              targetTitle: nodeMap.get(edge.targetTopicId)?.title ?? "",
              relationType: rel,
            } as EdgeData,
          };
        });
    },
    [edges, nodes],
  );

  const { selections, actives, onNodeClick: onSelect, onCanvasClick } = useSelection({
    ref: graphRef,
    nodes: graphNodes,
    edges: graphEdges,
    pathSelectionType: "all",
  });

  const handleNodeClick = useCallback(
    (node: { id: string; data?: GraphNode }) => {
      const graphNode = node.data ?? nodes.find((n) => n.id === node.id);
      if (onNodeClick && graphNode) {
        onNodeClick(graphNode as GraphNode);
      } else {
        onSelect?.(node as never);
        if (graphNode?.id) {
          router.push(`/topic/${graphNode.id}`);
        }
      }
    },
    [nodes, onNodeClick, onSelect, router],
  );

  const handleNodePointerOver = useCallback(
    (node: { id: string; data?: GraphNode }, event: PointerEvent) => {
      const graphNode = node.data ?? nodes.find((n) => n.id === node.id);
      if (!graphNode) return;

      setTooltip({
        type: "node",
        label: graphNode.title,
        sublabel: `${graphNode.connectionCount ?? 0} connection${(graphNode.connectionCount ?? 0) !== 1 ? "s" : ""}`,
        icon: graphNode.icon,
        iconHue: graphNode.iconHue,
        color: getNodeColor(graphNode.iconHue, graphNode.id),
        screenX: event.clientX,
        screenY: event.clientY,
      });
    },
    [nodes],
  );

  const handleEdgePointerOver = useCallback(
    (edge: { id: string; data?: EdgeData; source: string; target: string }) => {
      const data = edge.data;
      const relLabel = RELATION_LABELS[data?.relationType ?? "related"] ?? "Related";
      setTooltip({
        type: "edge",
        label: `${data?.sourceTitle ?? "?"} → ${data?.targetTitle ?? "?"}`,
        sublabel: relLabel,
        screenX: mousePos.current.screenX,
        screenY: mousePos.current.screenY,
      });
    },
    [],
  );

  const handlePointerOut = useCallback(() => {
    setTooltip(null);
  }, []);

  return (
    <div ref={containerRef} style={{ height, width: "100%", position: "relative", opacity: visible ? 1 : 0, transition: "opacity 700ms ease-in" }}>
      <GraphCanvas
        ref={graphRef}
        nodes={graphNodes}
        edges={graphEdges}
        selections={selections}
        actives={actives}
        onNodeClick={handleNodeClick as never}
        onNodePointerOver={handleNodePointerOver as never}
        onNodePointerOut={handlePointerOut as never}
        onEdgePointerOver={handleEdgePointerOver as never}
        onEdgePointerOut={handlePointerOut as never}
        onCanvasClick={onCanvasClick}
        theme={{
          canvas: { background: undefined, fog: undefined },
          node: {
            fill: BRAND_BLUE,
            activeFill: BRAND_ORANGE,
            opacity: 1,
            selectedOpacity: 1,
            inactiveOpacity: 0.3,
            label: {
              color: isDark ? "hsl(220, 14%, 96%)" : "hsl(220, 14%, 15%)",
              activeColor: isDark ? "hsl(220, 14%, 100%)" : "hsl(220, 14%, 5%)",
            },
            ring: { fill: BRAND_ORANGE },
            port: {
              fill: BRAND_BLUE,
              activeFill: BRAND_ORANGE,
            },
          },
          lasso: { border: `1px solid ${BRAND_BLUE}`, background: "rgba(0, 118, 219, 0.1)" },
          ring: { fill: BRAND_BLUE, activeFill: BRAND_ORANGE },
          edge: {
            fill: EDGE_COLOR,
            activeFill: BRAND_ORANGE,
            opacity: 0.15,
            selectedOpacity: 0.8,
            inactiveOpacity: 0.05,
            label: {
              color: isDark ? "hsl(220, 14%, 96%)" : "hsl(220, 14%, 15%)",
              activeColor: isDark ? "hsl(220, 14%, 100%)" : "hsl(220, 14%, 5%)",
              fontSize: 8,
            },
          },
          arrow: {
            fill: EDGE_COLOR,
            activeFill: BRAND_ORANGE,
          },
          cluster: {
            stroke: isDark ? "hsl(210, 20%, 16%)" : "hsl(210, 20%, 84%)",
            opacity: 1,
            selectedOpacity: 1,
            inactiveOpacity: 0.1,
            label: {
              color: isDark ? "hsl(220, 14%, 96%)" : "hsl(220, 14%, 15%)",
              fontSize: 10,
            },
          },
        } as any}
        labelFontUrl="https://fonts.gstatic.com/s/opensans/v44/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjr0C4n.ttf"
        minNodeSize={5}
        maxNodeSize={50}
        edgeInterpolation="curved"
        layoutType="forceDirected2d"
        animated
        {...(disableZoom ? { minDistance: 5000, maxDistance: 5000 } : {})}
      />

      {/* Tooltip */}
      <div
        className="pointer-events-none fixed z-[100] max-w-xs overflow-hidden rounded-lg border border-border/50 bg-card/95 backdrop-blur-sm shadow-lg transition-all duration-150 ease-out"
        style={{
          left: tooltip?.screenX ?? 0,
          top: (tooltip?.screenY ?? 0) - 8,
          transform: "translate(-50%, -100%)",
          opacity: tooltip ? 1 : 0,
          scale: tooltip ? 1 : 0.95,
          visibility: tooltip ? "visible" : "hidden",
        }}
      >
        <div className="flex items-stretch">
          {tooltip?.type === "node" && tooltip.color && (
            <div
              className="w-1 shrink-0"
              style={{ backgroundColor: tooltip.color }}
            />
          )}
          <div className="flex items-center gap-2 px-3 py-2">
            {tooltip?.type === "node" && tooltip.icon && (
              <TopicIcon icon={tooltip.icon} hue={tooltip.iconHue} size="md" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{tooltip?.label}</p>
              <p className="text-xs text-muted-foreground">{tooltip?.sublabel}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
