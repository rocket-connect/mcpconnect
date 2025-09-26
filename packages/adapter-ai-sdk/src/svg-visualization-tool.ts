// packages/adapter-ai-sdk/src/svg-visualization-tool.ts
import { z } from "zod";
import { Tool } from "@mcpconnect/schemas";

export const generateVisualizationSchema = {
  nodes: z
    .array(
      z.object({
        id: z
          .string()
          .describe("Unique identifier for the node (e.g., 'n0', 'n1')"),
        caption: z.string().describe("Display caption/name for the node"),
        labels: z
          .array(z.string())
          .describe("Node labels (e.g., ['Movie'], ['Actor'])"),
        properties: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Optional properties as key-value pairs"),
        position: z
          .object({
            x: z.number().describe("X coordinate position"),
            y: z.number().describe("Y coordinate position"),
          })
          .optional()
          .describe("Optional position coordinates for the node"),
        level: z
          .number()
          .optional()
          .describe("Hierarchy level (0 = root, 1 = children, etc.)"),
      })
    )
    .describe("Array of nodes to include in the graph"),

  relationships: z
    .array(
      z.object({
        id: z
          .string()
          .describe(
            "Unique identifier for the relationship (e.g., 'r0', 'r1')"
          ),
        fromId: z.string().describe("Source node ID"),
        toId: z.string().describe("Target node ID"),
        type: z
          .string()
          .describe("Relationship type/label (e.g., 'ACTED_IN', 'DIRECTED')"),
        properties: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Optional relationship properties"),
      })
    )
    .describe("Array of relationships between nodes"),

  title: z.string().optional().describe("Optional title for the graph"),

  style: z
    .object({
      nodeColor: z.string().optional().describe("Default node color (hex)"),
      backgroundColor: z.string().optional().describe("Background color (hex)"),
      arrowColor: z
        .string()
        .optional()
        .describe("Arrow/relationship color (hex)"),
    })
    .optional()
    .describe("Optional styling options for the graph"),
};

const GenerateVisualizationArgsSchema = z.object(generateVisualizationSchema);
export type GenerateGraphArgs = z.infer<typeof GenerateVisualizationArgsSchema>;

export type GraphNode = z.infer<
  typeof generateVisualizationSchema.nodes.element
>;
export type GraphRelationship = z.infer<
  typeof generateVisualizationSchema.relationships.element
>;
export type GraphStyle = z.infer<typeof generateVisualizationSchema.style>;

interface ProcessedNode extends GraphNode {
  position: { x: number; y: number };
  level: number;
  children: string[];
  parents: string[];
}

function calculateOptimalLayout(
  nodes: GraphNode[],
  relationships: GraphRelationship[]
): ProcessedNode[] {
  // Create adjacency lists
  const childrenMap = new Map<string, string[]>();
  const parentsMap = new Map<string, string[]>();

  nodes.forEach(node => {
    childrenMap.set(node.id, []);
    parentsMap.set(node.id, []);
  });

  relationships.forEach(rel => {
    childrenMap.get(rel.fromId)?.push(rel.toId);
    parentsMap.get(rel.toId)?.push(rel.fromId);
  });

  // Check if we have any relationships at all
  const hasRelationships = relationships.length > 0;

  if (!hasRelationships) {
    // Use grid layout for unconnected nodes
    return calculateGridLayout(nodes, childrenMap, parentsMap);
  } else {
    // Use hierarchical layout for connected nodes
    return calculateHierarchicalLayout(
      nodes,
      relationships,
      childrenMap,
      parentsMap
    );
  }
}

function calculateGridLayout(
  nodes: GraphNode[],
  childrenMap: Map<string, string[]>,
  parentsMap: Map<string, string[]>
): ProcessedNode[] {
  const processedNodes: ProcessedNode[] = [];
  const nodeSpacing = 200;
  const padding = 100;

  // Calculate optimal grid dimensions
  const nodeCount = nodes.length;
  const aspectRatio = 16 / 9; // Target aspect ratio for rectangular layout

  // Calculate columns to achieve target aspect ratio
  let cols = Math.ceil(Math.sqrt(nodeCount * aspectRatio));
  let rows = Math.ceil(nodeCount / cols);

  // Adjust to ensure we don't have too many empty spaces
  while (cols > 1 && (cols - 1) * rows >= nodeCount) {
    cols--;
    rows = Math.ceil(nodeCount / cols);
  }

  nodes.forEach((node, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;

    // Center the grid and add some randomness to avoid perfect alignment
    const baseX = padding + col * nodeSpacing + nodeSpacing / 2;
    const baseY = padding + row * nodeSpacing + nodeSpacing / 2;

    // Add slight random offset for more natural look (±20px)
    const offsetX = (Math.random() - 0.5) * 40;
    const offsetY = (Math.random() - 0.5) * 40;

    const x = node.position?.x || baseX + offsetX;
    const y = node.position?.y || baseY + offsetY;

    processedNodes.push({
      ...node,
      position: { x, y },
      level: 0, // All nodes at same level in grid layout
      children: childrenMap.get(node.id) || [],
      parents: parentsMap.get(node.id) || [],
    });
  });

  return processedNodes;
}

function calculateHierarchicalLayout(
  nodes: GraphNode[],
  relationships: GraphRelationship[],
  childrenMap: Map<string, string[]>,
  parentsMap: Map<string, string[]>
): ProcessedNode[] {
  // Find root nodes (nodes with no incoming relationships or explicitly marked as level 0)
  const rootNodes = nodes.filter(
    node =>
      node.level === 0 ||
      (node.level === undefined && parentsMap.get(node.id)!.length === 0)
  );

  // If no clear roots, use nodes with most outgoing connections as roots
  if (rootNodes.length === 0) {
    const nodesByOutgoing = nodes.sort(
      (a, b) =>
        (childrenMap.get(b.id)?.length || 0) -
        (childrenMap.get(a.id)?.length || 0)
    );
    rootNodes.push(nodesByOutgoing[0]);
  }

  // Calculate levels using BFS
  const levels = new Map<string, number>();
  const queue: { nodeId: string; level: number }[] = [];

  rootNodes.forEach(root => {
    levels.set(root.id, root.level || 0);
    queue.push({ nodeId: root.id, level: root.level || 0 });
  });

  while (queue.length > 0) {
    const { nodeId, level } = queue.shift()!;
    const children = childrenMap.get(nodeId) || [];

    children.forEach(childId => {
      if (!levels.has(childId) || levels.get(childId)! > level + 1) {
        levels.set(childId, level + 1);
        queue.push({ nodeId: childId, level: level + 1 });
      }
    });
  }

  // Group nodes by level
  const nodesByLevel = new Map<number, string[]>();
  levels.forEach((level, nodeId) => {
    if (!nodesByLevel.has(level)) {
      nodesByLevel.set(level, []);
    }
    nodesByLevel.get(level)!.push(nodeId);
  });

  // Calculate positions
  const processedNodes: ProcessedNode[] = [];
  const levelHeight = 200;
  const baseNodeSpacing = 250;

  // Calculate total width needed for the largest level
  const maxNodesInLevel = Math.max(
    ...Array.from(nodesByLevel.values()).map(nodes => nodes.length)
  );
  const totalWidth = Math.max(800, maxNodesInLevel * baseNodeSpacing);

  nodesByLevel.forEach((nodeIds, level) => {
    const nodesAtLevel = nodeIds.length;
    const spacing = Math.min(baseNodeSpacing, totalWidth / (nodesAtLevel + 1));
    const startX = totalWidth / 2 - ((nodesAtLevel - 1) * spacing) / 2;

    nodeIds.forEach((nodeId, index) => {
      const node = nodes.find(n => n.id === nodeId)!;
      const x = node.position?.x || startX + index * spacing;
      const y = node.position?.y || 100 + level * levelHeight;

      processedNodes.push({
        ...node,
        position: { x, y },
        level: levels.get(nodeId) || 0,
        children: childrenMap.get(nodeId) || [],
        parents: parentsMap.get(nodeId) || [],
      });
    });
  });

  return processedNodes;
}

function generateSVGFromGraph(args: GenerateGraphArgs): string {
  const { nodes, relationships, title, style } = args;

  // Default styles
  const defaultStyle = {
    nodeColor: style?.nodeColor || "#ffffff",
    backgroundColor: style?.backgroundColor || "#ffffff",
    arrowColor: style?.arrowColor || "#000000",
  };

  // Calculate optimal layout (grid or hierarchical)
  const processedNodes = calculateOptimalLayout(nodes, relationships);

  // Calculate SVG dimensions with better padding
  const positions = processedNodes.map(n => n.position);
  const minX = Math.min(...positions.map(p => p.x)) - 100;
  const maxX = Math.max(...positions.map(p => p.x)) + 100;
  const minY = Math.min(...positions.map(p => p.y)) - 100;
  const maxY = Math.max(...positions.map(p => p.y)) + 100;

  const width = maxX - minX;
  const height = maxY - minY;

  // Create node lookup
  const nodeMap = new Map(processedNodes.map(n => [n.id, n]));

  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${defaultStyle.backgroundColor}"/>
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" 
            refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="${defaultStyle.arrowColor}" />
    </marker>
  </defs>
`;

  // Add title if provided
  if (title) {
    svg += `  <text x="${width / 2}" y="30" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="bold" fill="#000000">${title}</text>\n`;
  }

  // Draw relationships (only if they exist)
  if (relationships.length > 0) {
    relationships.forEach(rel => {
      const fromNode = nodeMap.get(rel.fromId);
      const toNode = nodeMap.get(rel.toId);

      if (!fromNode || !toNode) return;

      const x1 = fromNode.position.x - minX;
      const y1 = fromNode.position.y - minY;
      const x2 = toNode.position.x - minX;
      const y2 = toNode.position.y - minY;

      const nodeRadius = 50;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.sqrt(dx * dx + dy * dy);

      if (length === 0) return;

      // Calculate connection points on node edges
      const startX = x1 + (dx / length) * nodeRadius;
      const startY = y1 + (dy / length) * nodeRadius;
      const endX = x2 - (dx / length) * nodeRadius;
      const endY = y2 - (dy / length) * nodeRadius;

      // Use curved paths for better visual hierarchy
      const isHierarchical = Math.abs(fromNode.level - toNode.level) === 1;

      if (isHierarchical && Math.abs(dx) > 50) {
        // Use curved path for hierarchical relationships that aren't vertical
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        const curveOffset = Math.min(50, Math.abs(dx) * 0.3);
        const controlX = midX + (dx > 0 ? curveOffset : -curveOffset);
        const controlY = midY - 30;

        svg += `  <path d="M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}" 
                stroke="${defaultStyle.arrowColor}" stroke-width="2" fill="none" marker-end="url(#arrowhead)"/>\n`;
      } else {
        // Straight line for vertical or non-hierarchical relationships
        svg += `  <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" 
                stroke="${defaultStyle.arrowColor}" stroke-width="2" marker-end="url(#arrowhead)"/>\n`;
      }

      // Add relationship label
      if (rel.type) {
        const labelX = (startX + endX) / 2;
        const labelY = (startY + endY) / 2;

        // Background for label
        const textWidth = rel.type.length * 7;
        svg += `  <rect x="${labelX - textWidth / 2 - 4}" y="${labelY - 10}" 
                width="${textWidth + 8}" height="16" 
                fill="${defaultStyle.backgroundColor}" fill-opacity="0.9" 
                stroke="${defaultStyle.arrowColor}" stroke-width="1" rx="3"/>\n`;

        svg += `  <text x="${labelX}" y="${labelY + 3}" text-anchor="middle" font-family="sans-serif" 
                font-size="10" font-weight="bold" fill="${defaultStyle.arrowColor}">${rel.type}</text>\n`;
      }
    });
  }

  // Draw nodes
  processedNodes.forEach(node => {
    const x = node.position.x - minX;
    const y = node.position.y - minY;
    const baseRadius = 45;
    const radius = baseRadius;

    // Node styling - simpler for grid layouts
    const strokeWidth = relationships.length > 0 && node.level === 0 ? 3 : 2;
    const fillColor =
      relationships.length > 0 && node.level === 0
        ? "#f0f8ff"
        : defaultStyle.nodeColor;

    svg += `  <circle cx="${x}" cy="${y}" r="${radius}" 
            fill="${fillColor}" stroke="#000000" stroke-width="${strokeWidth}"/>\n`;

    // Node caption
    if (node.caption) {
      const fontSize = 12;
      const fontWeight =
        relationships.length > 0 && node.level === 0 ? "bold" : "normal";

      // Split long captions into multiple lines
      const maxChars = 12;
      const words = node.caption.split(" ");
      const lines = [];
      let currentLine = "";

      words.forEach(word => {
        if ((currentLine + word).length <= maxChars) {
          currentLine += (currentLine ? " " : "") + word;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      });
      if (currentLine) lines.push(currentLine);

      const startY = y - (lines.length - 1) * 6;
      lines.forEach((line, index) => {
        svg += `  <text x="${x}" y="${startY + index * 12}" text-anchor="middle" font-family="sans-serif" 
                font-size="${fontSize}" font-weight="${fontWeight}" fill="#000000">${line}</text>\n`;
      });
    }

    // Node labels (below the node)
    if (node.labels && node.labels.length > 0) {
      const labelsText = node.labels.join(", ");
      svg += `  <text x="${x}" y="${y + radius + 15}" text-anchor="middle" font-family="sans-serif" 
              font-size="9" fill="#666666">${labelsText}</text>\n`;
    }
  });

  svg += `</svg>`;
  return svg;
}

// ===============================
// GRAPH GENERATION ACTION
// ===============================

export async function generateVisualization(
  args: GenerateGraphArgs
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const validatedArgs = GenerateVisualizationArgsSchema.parse(args);

    if (!validatedArgs.nodes || validatedArgs.nodes.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "Error: At least one node is required to generate a graph.",
          },
        ],
      };
    }

    const nodeIds = new Set(validatedArgs.nodes.map(node => node.id));
    const invalidRelationships = (validatedArgs.relationships || []).filter(
      rel => !nodeIds.has(rel.fromId) || !nodeIds.has(rel.toId)
    );

    if (invalidRelationships.length > 0) {
      const invalidIds = invalidRelationships
        .map(rel => `${rel.id}: ${rel.fromId} -> ${rel.toId}`)
        .join(", ");
      return {
        content: [
          {
            type: "text",
            text: `Error: Invalid relationship references found: ${invalidIds}. All fromId and toId values must reference existing node ids.`,
          },
        ],
      };
    }

    const svgContent = generateSVGFromGraph(validatedArgs);

    return {
      content: [
        {
          type: "text",
          text: svgContent,
        },
      ],
    };
  } catch (error) {
    console.error("Error in generateVisualization:", error);

    if (error instanceof z.ZodError) {
      return {
        content: [
          {
            type: "text",
            // @ts-ignore
            text: `Validation error: ${error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Error generating graph: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      ],
    };
  }
}

// Create the system tool definition
export function createVisualizationTool(): Tool {
  return {
    id: "system_generate_svg_visualization",
    name: "generate_svg_visualization",
    description:
      "Generate SVG visualizations from structured data with nodes and relationships. Perfect for creating flowcharts, network graphs, organizational charts, and data relationship diagrams.",
    inputSchema: {
      type: "object",
      properties: generateVisualizationSchema,
      required: ["nodes"],
    },
    parameters: [
      {
        name: "nodes",
        type: "array",
        description:
          "Array of nodes with id, caption, labels, and optional position/level",
        required: true,
      },
      {
        name: "relationships",
        type: "array",
        description:
          "Array of relationships between nodes with fromId, toId, and type",
        required: false,
      },
      {
        name: "title",
        type: "string",
        description: "Optional title for the graph",
        required: false,
      },
      {
        name: "style",
        type: "object",
        description:
          "Optional styling with nodeColor, backgroundColor, arrowColor (hex values)",
        required: false,
      },
    ],
    category: "visualization",
    tags: ["system", "visualization", "svg", "graph", "diagram"],
    deprecated: false,
  };
}
