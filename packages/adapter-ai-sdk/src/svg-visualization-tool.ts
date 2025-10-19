import { z } from "zod";
import { Tool } from "@mcpconnect/schemas";

export const generateVisualizationSchema = {
  nodes: z
    .array(
      z.object({
        id: z
          .string()
          .min(1, "Node ID cannot be empty")
          .describe("Unique identifier for the node (e.g., 'n0', 'n1')"),
        caption: z
          .string()
          .min(1, "Node caption cannot be empty")
          .describe("Display caption/name for the node"),
        labels: z
          .array(z.string())
          .min(1, "At least one label is required")
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
          .int()
          .min(0)
          .optional()
          .describe("Hierarchy level (0 = root, 1 = children, etc.)"),
      })
    )
    .min(1, "At least one node is required to generate a visualization")
    .describe("Array of nodes to include in the graph"),

  relationships: z
    .array(
      z.object({
        id: z
          .string()
          .min(1, "Relationship ID cannot be empty")
          .describe(
            "Unique identifier for the relationship (e.g., 'r0', 'r1')"
          ),
        fromId: z
          .string()
          .min(1, "Source node ID cannot be empty")
          .describe("Source node ID"),
        toId: z
          .string()
          .min(1, "Target node ID cannot be empty")
          .describe("Target node ID"),
        type: z
          .string()
          .min(1, "Relationship type cannot be empty")
          .describe("Relationship type/label (e.g., 'ACTED_IN', 'DIRECTED')"),
        properties: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Optional relationship properties"),
      })
    )
    .optional()
    .default([])
    .describe("Array of relationships between nodes"),

  title: z.string().optional().describe("Optional title for the graph"),

  style: z
    .object({
      nodeColor: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color format")
        .optional()
        .describe("Default node color (hex)"),
      backgroundColor: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color format")
        .optional()
        .describe("Background color (hex)"),
      arrowColor: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color format")
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
  // @ts-ignore
  typeof generateVisualizationSchema.relationships.element
>;
export type GraphStyle = z.infer<typeof generateVisualizationSchema.style>;

interface ProcessedNode extends GraphNode {
  position: { x: number; y: number };
  level: number;
  children: string[];
  parents: string[];
}

interface ProcessedRelationship extends GraphRelationship {
  from: ProcessedNode;
  to: ProcessedNode;
  labelPosition?: { x: number; y: number; rotation: number };
  type: string;
}

/**
 * Validates that all relationship node references exist in the nodes array
 */
function validateNodeReferences(
  nodes: GraphNode[],
  relationships: GraphRelationship[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(nodes) || nodes.length === 0) {
    errors.push("Nodes array is empty or invalid");
    return { valid: false, errors };
  }

  if (!Array.isArray(relationships)) {
    errors.push("Relationships must be an array");
    return { valid: false, errors };
  }

  const nodeIds = new Set(nodes.map(node => node.id));
  const duplicateNodeIds = nodes
    .map(node => node.id)
    .filter((id, index, arr) => arr.indexOf(id) !== index);

  if (duplicateNodeIds.length > 0) {
    errors.push(`Duplicate node IDs found: ${duplicateNodeIds.join(", ")}`);
  }

  const duplicateRelIds = relationships
    .map(rel => rel.id)
    .filter((id, index, arr) => arr.indexOf(id) !== index);

  if (duplicateRelIds.length > 0) {
    errors.push(
      `Duplicate relationship IDs found: ${duplicateRelIds.join(", ")}`
    );
  }

  const invalidFromIds = relationships
    .filter(rel => !nodeIds.has(rel.fromId))
    .map(rel => `${rel.id}:${rel.fromId}`);

  const invalidToIds = relationships
    .filter(rel => !nodeIds.has(rel.toId))
    .map(rel => `${rel.id}:${rel.toId}`);

  if (invalidFromIds.length > 0) {
    errors.push(`Invalid source node references: ${invalidFromIds.join(", ")}`);
  }

  if (invalidToIds.length > 0) {
    errors.push(`Invalid target node references: ${invalidToIds.join(", ")}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Calculate optimal layout with improved spacing and collision avoidance
 */
function calculateOptimalLayout(
  nodes: GraphNode[],
  relationships: GraphRelationship[]
): ProcessedNode[] {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    throw new Error("Cannot calculate layout: nodes array is empty or invalid");
  }

  if (!Array.isArray(relationships)) {
    throw new Error("Cannot calculate layout: relationships must be an array");
  }

  // Create adjacency lists
  const childrenMap = new Map<string, string[]>();
  const parentsMap = new Map<string, string[]>();

  nodes.forEach(node => {
    childrenMap.set(node.id, []);
    parentsMap.set(node.id, []);
  });

  relationships.forEach(rel => {
    const children = childrenMap.get(rel.fromId);
    const parents = parentsMap.get(rel.toId);

    if (children && parents) {
      children.push(rel.toId);
      parents.push(rel.fromId);
    }
  });

  const hasRelationships = relationships.length > 0;

  if (!hasRelationships) {
    return calculateGridLayout(nodes, childrenMap, parentsMap);
  } else {
    return calculateHierarchicalLayoutV2(
      nodes,
      relationships,
      childrenMap,
      parentsMap
    );
  }
}

/**
 * Improved grid layout with better spacing
 */
function calculateGridLayout(
  nodes: GraphNode[],
  childrenMap: Map<string, string[]>,
  parentsMap: Map<string, string[]>
): ProcessedNode[] {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return [];
  }

  const processedNodes: ProcessedNode[] = [];
  const nodeRadius = 60; // Increased radius for better spacing
  const minSpacing = nodeRadius * 2.8; // Increased minimum spacing
  const padding = 80;

  const nodeCount = nodes.length;
  let cols = Math.ceil(Math.sqrt(nodeCount));
  let rows = Math.ceil(nodeCount / cols);

  // Optimize grid dimensions to minimize empty space
  while (cols > 1 && (cols - 1) * rows >= nodeCount) {
    cols--;
    rows = Math.ceil(nodeCount / cols);
  }

  nodes.forEach((node, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;

    // Calculate base position with improved spacing
    const baseX = padding + col * minSpacing + nodeRadius;
    const baseY = padding + row * minSpacing + nodeRadius;

    const x = node.position?.x || baseX;
    const y = node.position?.y || baseY;

    processedNodes.push({
      ...node,
      position: { x, y },
      level: 0,
      children: childrenMap.get(node.id) || [],
      parents: parentsMap.get(node.id) || [],
    });
  });

  return processedNodes;
}

/**
 * Enhanced hierarchical layout with better collision avoidance
 */
function calculateHierarchicalLayoutV2(
  nodes: GraphNode[],
  relationships: GraphRelationship[],
  childrenMap: Map<string, string[]>,
  parentsMap: Map<string, string[]>
): ProcessedNode[] {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return [];
  }

  // Find root nodes
  const rootNodes = nodes.filter(
    node =>
      node.level === 0 ||
      (node.level === undefined && (parentsMap.get(node.id)?.length || 0) === 0)
  );

  if (rootNodes.length === 0 && nodes.length > 0) {
    const nodesByOutgoing = [...nodes].sort(
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

  // Enhanced layout calculations with better spacing
  const processedNodes: ProcessedNode[] = [];
  const levelHeight = 180; // Reduced for tighter vertical spacing
  const minNodeSpacing = 140; // Minimum horizontal spacing between nodes
  const padding = 100;

  // Calculate optimal width and positioning
  const maxNodesInLevel = Math.max(
    ...Array.from(nodesByLevel.values()).map(nodes => nodes.length)
  );

  nodesByLevel.forEach((nodeIds, level) => {
    const nodesAtLevel = nodeIds.length;

    // Calculate optimal spacing for this level
    const levelSpacing = Math.max(
      minNodeSpacing,
      maxNodesInLevel > 6 ? minNodeSpacing * 0.8 : minNodeSpacing
    );

    const totalLevelWidth = (nodesAtLevel - 1) * levelSpacing;
    const startX =
      padding +
      Math.max(0, (maxNodesInLevel * minNodeSpacing - totalLevelWidth) / 2);

    nodeIds.forEach((nodeId, index) => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) {
        throw new Error(
          `Node with ID ${nodeId} not found during layout calculation`
        );
      }

      const x = node.position?.x || startX + index * levelSpacing;
      const y = node.position?.y || padding + level * levelHeight;

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

/**
 * Calculate optimal label positioning to avoid overlaps
 */
function calculateLabelPositions(
  processedNodes: ProcessedNode[],
  relationships: GraphRelationship[]
): ProcessedRelationship[] {
  const nodeMap = new Map(processedNodes.map(n => [n.id, n]));
  const processedRels: ProcessedRelationship[] = [];

  // Track used label positions to avoid overlaps
  const usedPositions: {
    x: number;
    y: number;
    width: number;
    height: number;
  }[] = [];

  relationships.forEach(rel => {
    const fromNode = nodeMap.get(rel.fromId);
    const toNode = nodeMap.get(rel.toId);

    if (!fromNode || !toNode) {
      console.warn(`Skipping relationship ${rel.id}: missing node reference`);
      return;
    }

    // Calculate label position with collision avoidance
    const midX = (fromNode.position.x + toNode.position.x) / 2;
    const midY = (fromNode.position.y + toNode.position.y) / 2;

    const dx = toNode.position.x - fromNode.position.x;
    const dy = toNode.position.y - fromNode.position.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    // Calculate perpendicular offset for label positioning
    const labelWidth = rel.type.length * 8; // Estimate label width
    const labelHeight = 16;
    const perpOffset = 25; // Distance from line

    // Calculate perpendicular vector
    const perpX = length > 0 ? -dy / length : 0;
    const perpY = length > 0 ? dx / length : 0;

    // Try different positions to avoid overlaps
    let finalX = midX + perpX * perpOffset;
    let finalY = midY + perpY * perpOffset - labelHeight / 2;

    // Check for overlaps and adjust
    const proposedRect = {
      x: finalX - labelWidth / 2,
      y: finalY,
      width: labelWidth,
      height: labelHeight,
    };

    // Find a position that doesn't overlap
    let attempts = 0;
    let offsetMultiplier = 1;
    while (attempts < 4) {
      const hasOverlap = usedPositions.some(
        used =>
          !(
            proposedRect.x + proposedRect.width < used.x ||
            proposedRect.x > used.x + used.width ||
            proposedRect.y + proposedRect.height < used.y ||
            proposedRect.y > used.y + used.height
          )
      );

      if (!hasOverlap) break;

      // Try alternate positions
      if (attempts === 1) {
        // Try opposite side
        finalX = midX - perpX * perpOffset * offsetMultiplier;
        finalY = midY - perpY * perpOffset * offsetMultiplier - labelHeight / 2;
      } else if (attempts === 2) {
        // Try above
        finalX = midX;
        finalY = midY - perpOffset * offsetMultiplier;
      } else {
        // Try below
        finalX = midX;
        finalY = midY + perpOffset * offsetMultiplier;
      }

      proposedRect.x = finalX - labelWidth / 2;
      proposedRect.y = finalY;
      offsetMultiplier += 0.5;
      attempts++;
    }

    usedPositions.push({
      x: finalX - labelWidth / 2,
      y: finalY,
      width: labelWidth,
      height: labelHeight,
    });

    processedRels.push({
      ...rel,
      from: fromNode,
      to: toNode,
      labelPosition: {
        x: finalX,
        y: finalY + labelHeight / 2,
        rotation: 0,
      },
    });
  });

  return processedRels;
}

/**
 * Generate optimized SVG with improved collision avoidance
 */
function generateSVGFromGraph(args: GenerateGraphArgs): string {
  const { nodes, relationships, title, style } = args;

  if (!Array.isArray(nodes) || nodes.length === 0) {
    throw new Error("Cannot generate SVG: nodes array is empty or invalid");
  }

  if (!Array.isArray(relationships)) {
    throw new Error("Cannot generate SVG: relationships must be an array");
  }

  // Default styles
  const defaultStyle = {
    nodeColor: style?.nodeColor || "#ffffff",
    backgroundColor: style?.backgroundColor || "#ffffff",
    arrowColor: style?.arrowColor || "#000000",
  };

  // Calculate optimal layout
  const processedNodes = calculateOptimalLayout(nodes, relationships);

  if (processedNodes.length === 0) {
    throw new Error("Failed to process nodes for layout");
  }

  // Calculate processed relationships with optimal label positioning
  const processedRelationships = calculateLabelPositions(
    processedNodes,
    relationships
  );

  // Calculate SVG dimensions with better padding
  const positions = processedNodes.map(n => n.position);
  const minX = Math.min(...positions.map(p => p.x)) - 120;
  const maxX = Math.max(...positions.map(p => p.x)) + 120;
  const minY = Math.min(...positions.map(p => p.y)) - 80;
  const maxY = Math.max(...positions.map(p => p.y)) + 80;

  const width = Math.max(600, maxX - minX);
  const height = Math.max(400, maxY - minY);

  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${defaultStyle.backgroundColor}"/>
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" 
            refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="${defaultStyle.arrowColor}" />
    </marker>
    <filter id="labelShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="1" dy="1" stdDeviation="1" flood-color="rgba(0,0,0,0.3)"/>
    </filter>
  </defs>
`;

  // Add title if provided
  if (title && typeof title === "string" && title.trim()) {
    const escapedTitle = title
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    svg += `  <text x="${width / 2}" y="30" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#000000">${escapedTitle}</text>\n`;
  }

  // Draw relationships with improved rendering
  if (processedRelationships.length > 0) {
    processedRelationships.forEach(rel => {
      const x1 = rel.from.position.x - minX;
      const y1 = rel.from.position.y - minY;
      const x2 = rel.to.position.x - minX;
      const y2 = rel.to.position.y - minY;

      const nodeRadius = 45;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.sqrt(dx * dx + dy * dy);

      if (length === 0) return;

      // Calculate connection points on node edges
      const startX = x1 + (dx / length) * nodeRadius;
      const startY = y1 + (dy / length) * nodeRadius;
      const endX = x2 - (dx / length) * nodeRadius;
      const endY = y2 - (dy / length) * nodeRadius;

      // Use straight lines for cleaner appearance
      svg += `  <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" 
                stroke="${defaultStyle.arrowColor}" stroke-width="2" marker-end="url(#arrowhead)"/>\n`;

      // Add relationship label with better positioning
      if (
        rel.type &&
        typeof rel.type === "string" &&
        rel.type.trim() &&
        rel.labelPosition
      ) {
        const labelX = rel.labelPosition.x - minX;
        const labelY = rel.labelPosition.y - minY;
        const escapedType = rel.type
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

        const labelWidth = rel.type.length * 8;
        const labelHeight = 18;

        // Background rectangle for label with better styling
        svg += `  <rect x="${labelX - labelWidth / 2 - 4}" y="${labelY - labelHeight / 2 - 2}" 
                width="${labelWidth + 8}" height="${labelHeight + 4}" 
                fill="${defaultStyle.backgroundColor}" fill-opacity="0.95" 
                stroke="${defaultStyle.arrowColor}" stroke-width="1" rx="4" 
                filter="url(#labelShadow)"/>\n`;

        svg += `  <text x="${labelX}" y="${labelY + 2}" text-anchor="middle" font-family="Arial, sans-serif" 
                font-size="11" font-weight="600" fill="${defaultStyle.arrowColor}">${escapedType}</text>\n`;
      }
    });
  }

  // Draw nodes with consistent styling
  processedNodes.forEach(node => {
    const x = node.position.x - minX;
    const y = node.position.y - minY;
    const radius = 45;

    // Node styling
    const strokeWidth = relationships.length > 0 && node.level === 0 ? 3 : 2;
    const fillColor =
      relationships.length > 0 && node.level === 0
        ? "#f0f8ff"
        : defaultStyle.nodeColor;

    // Add subtle shadow effect
    svg += `  <circle cx="${x + 2}" cy="${y + 2}" r="${radius}" 
            fill="rgba(0,0,0,0.1)" opacity="0.3"/>\n`;

    svg += `  <circle cx="${x}" cy="${y}" r="${radius}" 
            fill="${fillColor}" stroke="#333333" stroke-width="${strokeWidth}"/>\n`;

    // Node caption with better text handling
    if (
      node.caption &&
      typeof node.caption === "string" &&
      node.caption.trim()
    ) {
      const fontSize = 12;
      const fontWeight =
        relationships.length > 0 && node.level === 0 ? "bold" : "600";

      const escapedCaption = node.caption
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      // Improved text wrapping
      const maxChars = 14;
      const words = escapedCaption.split(" ");
      const lines = [];
      let currentLine = "";

      words.forEach(word => {
        if ((currentLine + " " + word).length <= maxChars) {
          currentLine += (currentLine ? " " : "") + word;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      });
      if (currentLine) lines.push(currentLine);

      const startY = y - (lines.length - 1) * 6;
      lines.forEach((line, index) => {
        svg += `  <text x="${x}" y="${startY + index * 12}" text-anchor="middle" font-family="Arial, sans-serif" 
                font-size="${fontSize}" font-weight="${fontWeight}" fill="#333333">${line}</text>\n`;
      });
    }

    // Node labels (below the node) with improved styling
    if (Array.isArray(node.labels) && node.labels.length > 0) {
      const validLabels = node.labels.filter(
        label => typeof label === "string" && label.trim()
      );
      if (validLabels.length > 0) {
        const labelsText = validLabels
          .join(", ")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        svg += `  <text x="${x}" y="${y + radius + 18}" text-anchor="middle" font-family="Arial, sans-serif" 
                font-size="10" fill="#666666">${labelsText}</text>\n`;
      }
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
    // Input validation
    if (!args || typeof args !== "object") {
      return {
        content: [
          {
            type: "text",
            text: "Error: Invalid input. Expected an object with 'nodes' array and optional 'relationships' array.",
          },
        ],
      };
    }

    // Parse and validate with detailed error messages
    let validatedArgs: GenerateGraphArgs;
    try {
      validatedArgs = GenerateVisualizationArgsSchema.parse(args);
    } catch (parseError) {
      if (parseError instanceof z.ZodError) {
        // @ts-ignore
        const errorDetails = parseError.errors
          .map((err: any) => `${err.path.join(".")}: ${err.message}`)
          .join("; ");
        return {
          content: [
            {
              type: "text",
              text: `Error: Input validation failed. ${errorDetails}. 

Expected format:
{
  "nodes": [
    {
      "id": "unique_id",
      "caption": "Node Name", 
      "labels": ["Label1", "Label2"]
    }
  ],
  "relationships": [
    {
      "id": "rel_id",
      "fromId": "source_node_id",
      "toId": "target_node_id", 
      "type": "RELATIONSHIP_TYPE"
    }
  ]
}`,
            },
          ],
        };
      }
      throw parseError;
    }

    // Validate node references in relationships
    const validation = validateNodeReferences(
      validatedArgs.nodes,
      validatedArgs.relationships || []
    );

    if (!validation.valid) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Data validation failed. ${validation.errors.join("; ")}`,
          },
        ],
      };
    }

    // Generate the SVG
    const svgContent = generateSVGFromGraph(validatedArgs);

    if (
      !svgContent ||
      typeof svgContent !== "string" ||
      !svgContent.includes("<svg")
    ) {
      throw new Error("Failed to generate valid SVG content");
    }

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

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return {
      content: [
        {
          type: "text",
          text: `Error generating graph visualization: ${errorMessage}

Please ensure your data follows this format:
{
  "nodes": [
    {"id": "n1", "caption": "Node 1", "labels": ["Type1"]},
    {"id": "n2", "caption": "Node 2", "labels": ["Type2"]}
  ],
  "relationships": [
    {"id": "r1", "fromId": "n1", "toId": "n2", "type": "CONNECTS_TO"}
  ]
}

All node IDs must be unique, and relationship fromId/toId must reference existing nodes.`,
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
      "Generate professional SVG visualizations from structured data with nodes and relationships. Perfect for creating clean flowcharts, network graphs, organizational charts, and data relationship diagrams with optimized spacing and collision avoidance. Requires at least one node with id, caption, and labels array. Relationships are optional but must reference existing node IDs.",
    inputSchema: {
      type: "object",
      properties: {
        nodes: {
          type: "array",
          description: "Array of nodes (required, minimum 1 node)",
          minItems: 1,
          items: {
            type: "object",
            required: ["id", "caption", "labels"],
            properties: {
              id: {
                type: "string",
                description: "Unique identifier for the node",
              },
              caption: {
                type: "string",
                description: "Display name for the node",
              },
              labels: {
                type: "array",
                description: "Node type labels",
                items: { type: "string" },
                minItems: 1,
              },
              properties: {
                type: "object",
                description: "Optional node properties",
              },
              position: {
                type: "object",
                description: "Optional position coordinates",
                properties: {
                  x: { type: "number" },
                  y: { type: "number" },
                },
              },
              level: {
                type: "number",
                description: "Hierarchy level (0 = root)",
              },
            },
          },
        },
        relationships: {
          type: "array",
          description: "Array of relationships between nodes (optional)",
          items: {
            type: "object",
            required: ["id", "fromId", "toId", "type"],
            properties: {
              id: {
                type: "string",
                description: "Unique relationship identifier",
              },
              fromId: {
                type: "string",
                description: "Source node ID (must exist in nodes)",
              },
              toId: {
                type: "string",
                description: "Target node ID (must exist in nodes)",
              },
              type: {
                type: "string",
                description: "Relationship type/label",
              },
              properties: {
                type: "object",
                description: "Optional relationship properties",
              },
            },
          },
        },
        title: {
          type: "string",
          description: "Optional graph title",
        },
        style: {
          type: "object",
          description: "Optional styling options",
          properties: {
            nodeColor: {
              type: "string",
              description: "Default node color (hex format: #RRGGBB)",
            },
            backgroundColor: {
              type: "string",
              description: "Background color (hex format: #RRGGBB)",
            },
            arrowColor: {
              type: "string",
              description: "Arrow/relationship color (hex format: #RRGGBB)",
            },
          },
        },
      },
      required: ["nodes"],
    },
    parameters: [
      {
        name: "nodes",
        type: "array",
        description:
          "Array of nodes with id, caption, labels, and optional position/level (minimum 1 required)",
        required: true,
      },
      {
        name: "relationships",
        type: "array",
        description:
          "Array of relationships between nodes with fromId, toId, and type (optional)",
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
