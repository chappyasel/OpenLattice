"use client";

import { useCallback, useMemo, useRef } from "react";
import { GraphCanvas, GraphCanvasRef, useSelection } from "reagraph";
import { useRouter } from "next/navigation";

interface GraphNode {
  id: string;
  title: string;
  type: "topic";
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
}

function getEdgeColor(relationType?: string): string {
  switch (relationType) {
    case "subtopic":
      return "rgba(156, 163, 175, 0.6)";
    case "related":
      return "rgba(99, 102, 241, 0.6)";
    case "prerequisite":
      return "rgba(168, 85, 247, 0.6)";
    case "see_also":
      return "rgba(34, 197, 94, 0.5)";
    default:
      return "rgba(0, 118, 219, 0.6)";
  }
}

function getNodeColor(_type: "topic"): string {
  return "#0076db";
}

export function GraphViewer({
  nodes,
  edges,
  height = "600px",
  onNodeClick,
  selectedNodeId,
}: GraphViewerProps) {
  const router = useRouter();
  const graphRef = useRef<GraphCanvasRef>(null);

  const graphNodes = useMemo(
    () =>
      nodes.map((node) => ({
        id: node.id,
        label: node.title,
        fill: getNodeColor(node.type),
        size: Math.max(4, Math.min(16, (node.connectionCount ?? 1) * 2)),
        data: node,
      })),
    [nodes],
  );

  const graphEdges = useMemo(
    () =>
      edges
        .filter((e) => {
          const nodeIds = new Set(nodes.map((n) => n.id));
          return nodeIds.has(e.sourceTopicId) && nodeIds.has(e.targetTopicId);
        })
        .map((edge) => ({
          id: edge.id,
          source: edge.sourceTopicId,
          target: edge.targetTopicId,
          fill: getEdgeColor(edge.relationType),
          size: 3,
        })),
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
      onSelect?.(node as never);
      const graphNode = node.data ?? nodes.find((n) => n.id === node.id);
      if (onNodeClick && graphNode) {
        onNodeClick(graphNode as GraphNode);
      } else if (graphNode?.id) {
        router.push(`/topic/${graphNode.id}`);
      }
    },
    [nodes, onNodeClick, onSelect, router],
  );

  return (
    <div style={{ height, width: "100%", position: "relative" }}>
      <GraphCanvas
        ref={graphRef}
        nodes={graphNodes}
        edges={graphEdges}
        selections={selections}
        actives={actives}
        onNodeClick={handleNodeClick as never}
        onCanvasClick={onCanvasClick}
        theme={{
          canvas: { background: undefined, fog: undefined },
          node: {
            fill: "#0076db",
            activeFill: "#3399e6",
            opacity: 1,
            selectedOpacity: 1,
            inactiveOpacity: 0.3,
            label: {
              color: "hsl(220, 14%, 96%)",
              activeColor: "hsl(220, 14%, 100%)",
            },
            ring: { fill: "#3399e6" },
            port: {
              fill: "#0076db",
              activeFill: "#3399e6",
            },
          },
          lasso: { border: "1px solid #0076db", background: "rgba(0, 118, 219, 0.1)" },
          ring: { fill: "#0076db", activeFill: "#3399e6" },
          edge: {
            fill: "rgba(0, 118, 219, 0.6)",
            activeFill: "#3399e6",
            opacity: 1,
            selectedOpacity: 1,
            inactiveOpacity: 0.1,
            label: { color: "hsl(220, 14%, 96%)", activeColor: "hsl(220, 14%, 100%)", fontSize: 8 },
          },
          arrow: {
            fill: "rgba(0, 118, 219, 0.6)",
            activeFill: "#3399e6",
          },
          cluster: {
            stroke: "hsl(210, 20%, 16%)",
            opacity: 1,
            selectedOpacity: 1,
            inactiveOpacity: 0.1,
            label: { color: "hsl(220, 14%, 96%)", fontSize: 10 },
          },
        } as any}
        layoutType="forceDirected2d"
        animated
      />
    </div>
  );
}
