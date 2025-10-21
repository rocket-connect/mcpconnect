import {
  buildClientSchema,
  getIntrospectionQuery,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLField,
  GraphQLInputType,
  GraphQLOutputType,
  GraphQLNamedType,
  GraphQLType,
  isNonNullType,
  isListType,
  isScalarType,
  isEnumType,
  isObjectType,
  isInputObjectType,
  GraphQLScalarType,
  GraphQLInputObjectType,
  IntrospectionQuery,
} from "graphql";
import { Connection, Tool, ToolExecution } from "@mcpconnect/schemas";
import { AdapterError } from "@mcpconnect/base-adapters";
import type { FetchFunction } from "@ai-sdk/provider-utils";

export class GraphQLService {
  private static fetch?: FetchFunction;
  private static schemaCache = new Map<string, GraphQLSchema>();
  private static readonly MAX_RECURSION_DEPTH = 5;
  private static readonly MAX_TOOLS_PER_CONNECTION = 100;

  static setFetch(fetchFn: FetchFunction) {
    this.fetch = fetchFn;
  }

  /**
   * Introspect GraphQL schema and convert to MCP tools
   * Optimized for large schemas like Supabase
   */
  static async introspectSchema(connection: Connection): Promise<{
    tools: Tool[];
    schema: GraphQLSchema;
  }> {
    try {
      const introspectionQuery = getIntrospectionQuery();

      const response = await this.executeGraphQL(
        connection,
        introspectionQuery,
        {}
      );

      if (response.errors) {
        throw new AdapterError(
          `GraphQL introspection failed: ${JSON.stringify(response.errors)}`,
          "GRAPHQL_INTROSPECTION_FAILED"
        );
      }

      const schema = buildClientSchema(response.data as IntrospectionQuery);
      this.schemaCache.set(connection.id, schema);

      // Generate tools with optimization for large schemas
      const tools = this.schemaToToolsOptimized(schema, connection);

      return { tools, schema };
    } catch (error) {
      throw new AdapterError(
        `Failed to introspect GraphQL schema: ${error}`,
        "GRAPHQL_INTROSPECTION_ERROR",
        { originalError: error }
      );
    }
  }

  /**
   * Optimized schema to tools conversion for large schemas
   */
  private static schemaToToolsOptimized(
    schema: GraphQLSchema,
    connection: Connection
  ): Tool[] {
    const tools: Tool[] = [];
    const config = connection.graphqlConfig;
    let toolCount = 0;
    const maxTools = this.MAX_TOOLS_PER_CONNECTION;

    // Process queries first (most common)
    if (config?.includeQueries !== false) {
      const queryType = schema.getQueryType();
      if (queryType) {
        const queryTools = this.fieldsToToolsOptimized(
          queryType,
          "query",
          connection,
          schema,
          maxTools - toolCount
        );
        tools.push(...queryTools);
        toolCount += queryTools.length;
      }
    }

    // Process mutations if we have room
    if (config?.includeMutations !== false && toolCount < maxTools) {
      const mutationType = schema.getMutationType();
      if (mutationType) {
        const mutationTools = this.fieldsToToolsOptimized(
          mutationType,
          "mutation",
          connection,
          schema,
          maxTools - toolCount
        );
        tools.push(...mutationTools);
        toolCount += mutationTools.length;
      }
    }

    // Process subscriptions if explicitly enabled and we have room
    if (config?.includeSubscriptions === true && toolCount < maxTools) {
      const subscriptionType = schema.getSubscriptionType();
      if (subscriptionType) {
        const subscriptionTools = this.fieldsToToolsOptimized(
          subscriptionType,
          "subscription",
          connection,
          schema,
          maxTools - toolCount
        );
        tools.push(...subscriptionTools);
      }
    }

    return this.filterTools(tools, config);
  }

  /**
   * Convert GraphQL fields to tools with limit
   */
  private static fieldsToToolsOptimized(
    type: GraphQLObjectType,
    operationType: "query" | "mutation" | "subscription",
    connection: Connection,
    schema: GraphQLSchema,
    maxTools: number
  ): Tool[] {
    const fields = type.getFields();
    const fieldEntries = Object.entries(fields);

    // Limit the number of tools generated
    const limitedFields = fieldEntries.slice(0, maxTools);

    return limitedFields.map(([, field]) => {
      return this.fieldToToolOptimized(
        field,
        operationType,
        connection,
        schema
      );
    });
  }

  /**
   * Optimized field to tool conversion with depth limiting
   */
  private static fieldToToolOptimized(
    field: GraphQLField<any, any>,
    operationType: "query" | "mutation" | "subscription",
    connection: Connection,
    schema: GraphQLSchema
  ): Tool {
    const operationName = field.name;
    const maxDepth = Math.min(
      connection.graphqlConfig?.maxDepth || 3,
      this.MAX_RECURSION_DEPTH
    );

    // Build input schema with controlled recursion
    const { inputSchema, parameters } = this.buildInputSchemaOptimized(
      field,
      schema,
      maxDepth
    );

    const variableDefinitions = this.generateVariableDefinitions(field.args);

    const tool: Tool = {
      id: `graphql_${operationType}_${operationName}`,
      name: operationName,
      description:
        field.description || `Execute ${operationType} ${operationName}`,
      inputSchema,
      parameters,
      category: "graphql",
      tags: ["graphql", operationType, connection.id],
      deprecated: field.deprecationReason !== undefined,
      metadata: {
        graphql: {
          operationType,
          operationName,
          returnTypeName: this.getTypeName(field.type),
          variableDefinitions,
          fullOperation: "",
        },
      },
    };

    return tool;
  }

  /**
   * Build input schema with depth limiting to prevent stack overflow
   */
  private static buildInputSchemaOptimized(
    field: GraphQLField<any, any>,
    schema: GraphQLSchema,
    maxDepth: number
  ): { inputSchema: any; parameters: Tool["parameters"] } {
    const parameters: Tool["parameters"] = [];
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Add operation arguments
    if (field.args && field.args.length > 0) {
      for (const arg of field.args) {
        const argSchema = this.graphQLTypeToJSONSchemaOptimized(
          arg.type,
          0,
          maxDepth
        );
        properties[arg.name] = argSchema;

        if (arg.description) {
          properties[arg.name].description = arg.description;
        }

        if (isNonNullType(arg.type)) {
          required.push(arg.name);
        }

        parameters.push({
          name: arg.name,
          type: this.graphQLTypeToParameterType(arg.type),
          description: arg.description || `Argument ${arg.name}`,
          required: isNonNullType(arg.type),
          default: arg.defaultValue,
        });
      }
    }

    // Add field selection parameter with controlled depth
    const returnType = this.unwrapType(field.type);
    if (isObjectType(returnType)) {
      const fieldSelectionSchema = this.buildFieldSelectionSchemaOptimized(
        returnType,
        schema,
        maxDepth,
        new Set(),
        0
      );

      properties["_fields"] = {
        type: "object",
        description: `Select which fields to include in the response. Nested up to ${maxDepth} levels deep.`,
        properties: fieldSelectionSchema.properties,
        additionalProperties: false,
      };

      parameters.push({
        name: "_fields",
        type: "object",
        description: `Field selection object. Example: { "id": true, "name": true }`,
        required: false,
      });
    }

    return {
      inputSchema: {
        type: "object",
        properties,
        required,
      },
      parameters,
    };
  }

  /**
   * Build field selection schema with strict depth control
   */
  private static buildFieldSelectionSchemaOptimized(
    type: GraphQLObjectType,
    schema: GraphQLSchema,
    maxDepth: number,
    visited: Set<string>,
    currentDepth: number = 0
  ): { properties: Record<string, any> } {
    const properties: Record<string, any> = {};

    // Stop recursion if we've hit max depth or seen this type
    if (currentDepth >= maxDepth || visited.has(type.name)) {
      return { properties };
    }

    // Mark this type as visited in this path
    const newVisited = new Set(visited);
    newVisited.add(type.name);

    const fields = type.getFields();
    const fieldEntries = Object.entries(fields);

    // Limit number of fields at each level for performance
    const maxFieldsPerLevel = 50;
    const limitedFields = fieldEntries.slice(0, maxFieldsPerLevel);

    for (const [fieldName, fieldDef] of limitedFields) {
      if (fieldName.startsWith("__")) continue;

      const fieldType = this.unwrapType(fieldDef.type);

      if (isScalarType(fieldType) || isEnumType(fieldType)) {
        properties[fieldName] = {
          type: "boolean",
          description: `Include ${fieldName} field (${fieldType.name})`,
        };
      } else if (isObjectType(fieldType) && currentDepth < maxDepth - 1) {
        // Only allow nested selection if we're not at max depth
        const nestedSchema = this.buildFieldSelectionSchemaOptimized(
          fieldType,
          schema,
          maxDepth,
          newVisited,
          currentDepth + 1
        );

        properties[fieldName] = {
          oneOf: [
            {
              type: "boolean",
              description: `Include all fields of ${fieldName}`,
            },
            {
              type: "object",
              description: `Select specific fields from ${fieldName}`,
              properties: nestedSchema.properties,
              additionalProperties: false,
            },
          ],
        };
      } else {
        // At max depth, just allow boolean selection
        properties[fieldName] = {
          type: "boolean",
          description: `Include ${fieldName}`,
        };
      }
    }

    return { properties };
  }

  /**
   * Convert GraphQL type to JSON Schema with depth control
   */
  private static graphQLTypeToJSONSchemaOptimized(
    type: GraphQLInputType,
    currentDepth: number,
    maxDepth: number
  ): any {
    if (isNonNullType(type)) {
      return this.graphQLTypeToJSONSchemaOptimized(
        type.ofType,
        currentDepth,
        maxDepth
      );
    }

    if (isListType(type)) {
      return {
        type: "array",
        items: this.graphQLTypeToJSONSchemaOptimized(
          type.ofType,
          currentDepth,
          maxDepth
        ),
      };
    }

    if (isScalarType(type)) {
      return this.scalarToJSONSchema(type);
    }

    if (isEnumType(type)) {
      return {
        type: "string",
        enum: type.getValues().map(v => v.name),
      };
    }

    if (isInputObjectType(type)) {
      // Prevent deep recursion in input objects
      if (currentDepth >= maxDepth) {
        return { type: "object", description: `${type.name} (depth limited)` };
      }
      return this.inputObjectToJSONSchemaOptimized(
        type,
        currentDepth + 1,
        maxDepth
      );
    }

    return { type: "object" };
  }

  /**
   * Convert input object with depth control
   */
  private static inputObjectToJSONSchemaOptimized(
    inputObject: GraphQLInputObjectType,
    currentDepth: number,
    maxDepth: number
  ): any {
    const fields = inputObject.getFields();
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const [fieldName, field] of Object.entries(fields)) {
      properties[fieldName] = this.graphQLTypeToJSONSchemaOptimized(
        field.type,
        currentDepth,
        maxDepth
      );

      if (field.description) {
        properties[fieldName].description = field.description;
      }

      if (isNonNullType(field.type)) {
        required.push(fieldName);
      }
    }

    return {
      type: "object",
      properties,
      required,
    };
  }

  /**
   * Build GraphQL selection set from field selection with depth control
   */
  private static buildSelectionFromFields(
    fields: Record<string, any> | boolean | undefined,
    type: GraphQLObjectType,
    schema: GraphQLSchema,
    indent: number = 1,
    maxDepth: number = 5,
    currentDepth: number = 0
  ): string {
    // @ts-ignore
    if (!fields || fields === false || currentDepth >= maxDepth) {
      return "{ __typename }";
    }

    if (fields === true) {
      const typeFields = type.getFields();
      const selections: string[] = ["__typename"];

      for (const [fieldName, fieldDef] of Object.entries(typeFields)) {
        if (fieldName.startsWith("__")) continue;

        const fieldType = this.unwrapType(fieldDef.type);
        if (isScalarType(fieldType) || isEnumType(fieldType)) {
          selections.push(fieldName);
        }
      }

      const indentStr = "  ".repeat(indent);
      return `{\n${selections.map(s => `${indentStr}${s}`).join("\n")}\n${" ".repeat((indent - 1) * 2)}}`;
    }

    const indentStr = "  ".repeat(indent);
    const selections: string[] = ["__typename"];
    const typeFields = type.getFields();

    for (const [fieldName, fieldValue] of Object.entries(fields)) {
      const fieldDef = typeFields[fieldName];
      if (!fieldDef) continue;

      const fieldType = this.unwrapType(fieldDef.type);

      if (isScalarType(fieldType) || isEnumType(fieldType)) {
        if (fieldValue === true) {
          selections.push(fieldName);
        }
      } else if (isObjectType(fieldType) && currentDepth < maxDepth - 1) {
        const nestedSelection = this.buildSelectionFromFields(
          fieldValue,
          fieldType,
          schema,
          indent + 1,
          maxDepth,
          currentDepth + 1
        );
        selections.push(`${fieldName} ${nestedSelection}`);
      }
    }

    return `{\n${selections.map(s => `${indentStr}${s}`).join("\n")}\n${" ".repeat((indent - 1) * 2)}}`;
  }

  /**
   * Execute a tool with dynamic field selection
   */
  // In src/graphql-service.ts

  /**
   * Execute a tool with dynamic field selection
   */
  static async executeTool(
    connection: Connection,
    tool: Tool,
    args: Record<string, any>
  ): Promise<ToolExecution> {
    const metadata = tool.metadata?.graphql as any;
    if (!metadata) {
      throw new AdapterError("Tool is not a GraphQL operation", "INVALID_TOOL");
    }

    const startTime = Date.now();
    const executionId = `graphql_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    try {
      // CRITICAL: Always get the schema from cache, never from metadata
      // The metadata.schema may be serialized and not have the proper methods
      let schema = this.schemaCache.get(connection.id);

      if (!schema) {
        // If schema is not in cache, we need to introspect again
        console.log("[GraphQL] Schema not in cache, re-introspecting...");
        const introspectionResult = await this.introspectSchema(connection);
        schema = introspectionResult.schema;
        // Cache will be updated by introspectSchema
      }

      if (!schema || typeof schema.getQueryType !== "function") {
        throw new AdapterError(
          "Valid GraphQL schema not available for connection",
          "SCHEMA_NOT_AVAILABLE"
        );
      }

      // Separate _fields from operation arguments
      const { _fields, ...operationArgs } = args;

      // Get the field definition to access return type
      const operationType = metadata.operationType;
      let rootType: GraphQLObjectType | null | undefined;

      if (operationType === "query") {
        rootType = schema.getQueryType();
      } else if (operationType === "mutation") {
        rootType = schema.getMutationType();
      } else if (operationType === "subscription") {
        rootType = schema.getSubscriptionType();
      }

      if (!rootType) {
        throw new AdapterError(
          `No ${operationType} type found in schema`,
          "SCHEMA_ERROR"
        );
      }

      const field = rootType.getFields()[metadata.operationName];
      if (!field) {
        throw new AdapterError(
          `Field ${metadata.operationName} not found in ${operationType} type`,
          "FIELD_NOT_FOUND"
        );
      }

      const returnType = this.unwrapType(field.type);

      // Build selection set
      let selectionSet = "{ __typename }";
      if (_fields && isObjectType(returnType)) {
        const maxDepth = Math.min(
          connection.graphqlConfig?.maxDepth || 3,
          this.MAX_RECURSION_DEPTH
        );
        selectionSet = this.buildSelectionFromFields(
          _fields,
          returnType,
          schema,
          1,
          maxDepth,
          0
        );
      } else if (isObjectType(returnType)) {
        // Default field selection if no _fields provided
        const fields = returnType.getFields();
        const scalarFields = Object.entries(fields)
          .filter(([name, field]) => {
            if (name.startsWith("__")) return false;
            const fieldType = this.unwrapType(field.type);
            return isScalarType(fieldType) || isEnumType(fieldType);
          })
          .map(([name]) => name)
          .slice(0, 20); // Limit default fields

        selectionSet = `{\n  __typename\n  ${scalarFields.join("\n  ")}\n}`;
      }

      // Build the argument list for the GraphQL operation
      const argList =
        Object.keys(operationArgs).length > 0
          ? `(${Object.keys(operationArgs)
              .map(key => `${key}: $${key}`)
              .join(", ")})`
          : "";

      // Build the full GraphQL operation
      const fullOperation =
        `${metadata.operationType} ${metadata.operationName}${metadata.variableDefinitions} {
  ${metadata.operationName}${argList} ${selectionSet}
}`.trim();

      // Execute the GraphQL operation with the operation arguments (not _fields)
      const response = await this.executeGraphQL(
        connection,
        fullOperation,
        operationArgs, // Pass only the operation arguments, not _fields
        metadata.operationName
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      if (response.errors) {
        const errorMessages = response.errors
          .map((e: any) => e.message)
          .join(", ");
        return {
          id: executionId,
          tool: tool.name,
          status: "error",
          duration,
          timestamp: new Date().toISOString(),
          request: {
            tool: tool.name,
            arguments: args,
            timestamp: new Date(startTime).toISOString(),
          },
          error: `GraphQL errors: ${errorMessages}`,
        };
      }

      const result = response.data?.[metadata.operationName];

      return {
        id: executionId,
        tool: tool.name,
        status: "success",
        duration,
        timestamp: new Date().toISOString(),
        request: {
          tool: tool.name,
          arguments: args,
          timestamp: new Date(startTime).toISOString(),
        },
        response: {
          success: true,
          result,
          timestamp: new Date(endTime).toISOString(),
        },
      };
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      return {
        id: executionId,
        tool: tool.name,
        status: "error",
        duration,
        timestamp: new Date().toISOString(),
        request: {
          tool: tool.name,
          arguments: args,
          timestamp: new Date(startTime).toISOString(),
        },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Existing helper methods remain the same
  private static generateVariableDefinitions(args: ReadonlyArray<any>): string {
    if (args.length === 0) return "";

    const definitions = args.map(arg => {
      const typeName = this.getTypeString(arg.type);
      return `$${arg.name}: ${typeName}`;
    });

    return `(${definitions.join(", ")})`;
  }

  private static unwrapType(type: GraphQLType): GraphQLNamedType {
    let unwrapped: GraphQLType = type;
    while (isNonNullType(unwrapped) || isListType(unwrapped)) {
      if (isNonNullType(unwrapped)) {
        unwrapped = unwrapped.ofType;
      } else if (isListType(unwrapped)) {
        // @ts-ignore
        unwrapped = unwrapped.ofType;
      }
    }
    return unwrapped as GraphQLNamedType;
  }

  private static getTypeName(type: GraphQLOutputType): string {
    const unwrapped = this.unwrapType(type);
    return unwrapped.name;
  }

  private static getTypeString(type: GraphQLType): string {
    if (isNonNullType(type)) {
      return `${this.getTypeString(type.ofType)}!`;
    }
    if (isListType(type)) {
      return `[${this.getTypeString(type.ofType)}]`;
    }
    return (type as GraphQLNamedType).name;
  }

  private static scalarToJSONSchema(scalar: GraphQLScalarType): any {
    switch (scalar.name) {
      case "String":
      case "ID":
        return { type: "string" };
      case "Int":
        return { type: "integer" };
      case "Float":
        return { type: "number" };
      case "Boolean":
        return { type: "boolean" };
      default:
        return { type: "string" };
    }
  }

  private static graphQLTypeToParameterType(
    type: GraphQLInputType
  ): "string" | "number" | "boolean" | "object" | "array" {
    if (isNonNullType(type)) {
      return this.graphQLTypeToParameterType(type.ofType);
    }

    if (isListType(type)) {
      return "array";
    }

    if (isScalarType(type)) {
      switch (type.name) {
        case "String":
        case "ID":
          return "string";
        case "Int":
        case "Float":
          return "number";
        case "Boolean":
          return "boolean";
        default:
          return "string";
      }
    }

    if (isEnumType(type)) {
      return "string";
    }

    return "object";
  }

  private static filterTools(tools: Tool[], config?: any): Tool[] {
    let filtered = tools;

    if (config?.includedOperations && config.includedOperations.length > 0) {
      filtered = filtered.filter(tool =>
        config.includedOperations.includes(tool.name)
      );
    }

    if (config?.excludedOperations && config.excludedOperations.length > 0) {
      filtered = filtered.filter(
        tool => !config.excludedOperations.includes(tool.name)
      );
    }

    if (config?.excludedTypes && config.excludedTypes.length > 0) {
      filtered = filtered.filter(tool => {
        const metadata = tool.metadata?.graphql as any;
        return !config.excludedTypes.includes(metadata?.returnTypeName);
      });
    }

    return filtered;
  }

  static async executeGraphQL(
    connection: Connection,
    query: string,
    variables: Record<string, any>,
    operationName?: string
  ): Promise<any> {
    const endpoint = connection.graphqlConfig?.endpoint || connection.url;
    const fetchFn = this.fetch || fetch;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...connection.headers,
    };

    if (connection.authType === "bearer" && connection.credentials?.token) {
      headers["Authorization"] = `Bearer ${connection.credentials.token}`;
    } else if (
      connection.authType === "apiKey" &&
      connection.credentials?.apiKey
    ) {
      headers["X-API-Key"] = connection.credentials.apiKey;
      headers["apiKey"] = connection.credentials.apiKey;
    } else if (
      connection.authType === "basic" &&
      connection.credentials?.username &&
      connection.credentials?.password
    ) {
      const auth = btoa(
        `${connection.credentials.username}:${connection.credentials.password}`
      );
      headers["Authorization"] = `Basic ${auth}`;
    }

    const body = JSON.stringify({
      query,
      variables,
      operationName,
    });

    try {
      const response = await fetchFn(endpoint, {
        method: "POST",
        headers,
        body,
      });

      if (!response.ok) {
        throw new AdapterError(
          `GraphQL request failed: ${response.status} ${response.statusText}`,
          "GRAPHQL_REQUEST_FAILED"
        );
      }

      return await response.json();
    } catch (error) {
      throw new AdapterError(
        `GraphQL execution error: ${error}`,
        "GRAPHQL_EXECUTION_ERROR",
        { originalError: error }
      );
    }
  }

  static async testConnection(connection: Connection): Promise<boolean> {
    try {
      const query = `{ __schema { queryType { name } } }`;
      const response = await this.executeGraphQL(connection, query, {});
      return !response.errors && response.data?.__schema?.queryType;
    } catch {
      return false;
    }
  }

  static clearSchemaCache(connectionId: string) {
    this.schemaCache.delete(connectionId);
  }

  static getCachedSchema(connectionId: string): GraphQLSchema | undefined {
    return this.schemaCache.get(connectionId);
  }
}
