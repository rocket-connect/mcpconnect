// src/mcp-service.ts - Updated with URL normalization

/* eslint-disable no-constant-condition */
/* eslint-disable no-async-promise-executor */
import {
  MCPAdapter,
  MCPConfig,
  MCPConnectionResult,
  MCPToolExecutionResult,
  MCPMessage,
  MCPServerInfo,
  MCPCapabilities,
  MCPToolDefinition,
  MCPResourceDefinition,
} from "@mcpconnect/base-adapters";
import { Connection, Tool, Resource, ToolExecution } from "@mcpconnect/schemas";
import {
  type FetchFunction,
  combineHeaders,
  withUserAgentSuffix,
  delay,
  isAbortError,
} from "@ai-sdk/provider-utils";
import { AdapterError, AdapterStatus } from "@mcpconnect/base-adapters";
import { normalizeUrl, normalizeUrlWithPath } from "./utils";

export class MCPService extends MCPAdapter {
  private static instance: MCPService | null = null;
  private static requestId = 1;
  private fetch?: FetchFunction;
  private sessionCache = new Map<string, string>();
  private connectionCache = new Map<
    string,
    {
      isConnected: boolean;
      lastUsed: number;
      sessionId?: string;
    }
  >();
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason: any) => void;
      timeout: any;
    }
  >();

  constructor(config?: Partial<MCPConfig>, fetch?: FetchFunction) {
    const defaultConfig: MCPConfig = {
      name: "mcpconnect-mcp-service",
      provider: "mcp",
      protocolVersion: "2025-06-18",
      debug: false,
      timeout: 60000,
      retries: 3,
      clientInfo: {
        name: "MCPConnect",
        version: "0.0.11",
        description: "MCPConnect browser-based MCP client",
      },
    };

    super({ ...defaultConfig, ...config });
    this.fetch = fetch;
  }

  static getInstance(
    config?: Partial<MCPConfig>,
    fetch?: FetchFunction
  ): MCPService {
    if (fetch || !MCPService.instance) {
      MCPService.instance = new MCPService(config, fetch);
    }
    return MCPService.instance;
  }

  private getNextRequestId(): string {
    return `req_${MCPService.requestId++}_${this.generateId()}`;
  }

  private prepareHeaders(connection: Connection): Record<string, string> {
    const baseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };

    const connectionHeaders = connection.headers || {};
    const authHeaders: Record<string, string> = {};

    if (connection.authType === "bearer" && connection.credentials?.token) {
      authHeaders["Authorization"] = `Bearer ${connection.credentials.token}`;
    } else if (
      connection.authType === "apiKey" &&
      connection.credentials?.apiKey
    ) {
      authHeaders["X-API-Key"] = connection.credentials.apiKey;
    } else if (
      connection.authType === "basic" &&
      connection.credentials?.username &&
      connection.credentials?.password
    ) {
      const auth = btoa(
        `${connection.credentials.username}:${connection.credentials.password}`
      );
      authHeaders["Authorization"] = `Basic ${auth}`;
    }

    return withUserAgentSuffix(
      combineHeaders(baseHeaders, connectionHeaders, authHeaders),
      "mcpconnect/0.0.11"
    );
  }

  private prepareSSEHeaders(connection: Connection): Record<string, string> {
    const headers = this.prepareHeaders(connection);
    return {
      ...headers,
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    };
  }

  private async sendSSERequest(
    connection: Connection,
    request: MCPMessage,
    abortSignal?: AbortSignal
  ): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const timeoutMs = connection.timeout || 60000;
      const timeout = setTimeout(() => {
        this.cleanupPendingRequest(request.id as string);
        reject(new AdapterError("SSE request timeout", "REQUEST_TIMEOUT"));
      }, timeoutMs);

      this.pendingRequests.set(request.id as string, {
        resolve,
        reject,
        timeout,
      });

      try {
        // Normalize URL and get or establish session
        const normalizedUrl = normalizeUrl(connection.url);
        let sessionId = this.sessionCache.get(normalizedUrl);

        if (!sessionId) {
          sessionId = await this.establishSSESession(connection, abortSignal);
          this.sessionCache.set(normalizedUrl, sessionId);
        }

        // Build message URL with normalized base URL
        const messageUrl = normalizeUrlWithPath(
          normalizedUrl.replace(/\/sse\/?$/, ""),
          `/message?sessionId=${sessionId}`
        );

        const fetchFn = this.fetch || fetch;
        const response = await fetchFn(messageUrl, {
          method: "POST",
          headers: this.prepareHeaders(connection),
          body: JSON.stringify(request),
          signal: abortSignal,
        });

        if (!response.ok) {
          this.cleanupPendingRequest(request.id as string);

          // Handle session expiry
          if (response.status === 400 || response.status === 404) {
            this.sessionCache.delete(normalizedUrl);
            this.connectionCache.delete(normalizedUrl);

            // Retry with fresh session
            try {
              sessionId = await this.establishSSESession(
                connection,
                abortSignal
              );
              this.sessionCache.set(normalizedUrl, sessionId);

              const retryUrl = normalizeUrlWithPath(
                normalizedUrl.replace(/\/sse\/?$/, ""),
                `/message?sessionId=${sessionId}`
              );

              const retryResponse = await fetchFn(retryUrl, {
                method: "POST",
                headers: this.prepareHeaders(connection),
                body: JSON.stringify(request),
                signal: abortSignal,
              });

              if (!retryResponse.ok) {
                throw new AdapterError(
                  `SSE message request failed after retry: ${retryResponse.status} ${retryResponse.statusText}`,
                  "SSE_REQUEST_FAILED"
                );
              }
            } catch (retryError) {
              throw new AdapterError(
                `SSE retry failed: ${retryError}`,
                "SSE_RETRY_FAILED"
              );
            }
          } else {
            throw new AdapterError(
              `SSE message request failed: ${response.status} ${response.statusText}`,
              "SSE_REQUEST_FAILED",
              { status: response.status, statusText: response.statusText }
            );
          }
        }
      } catch (error) {
        this.cleanupPendingRequest(request.id as string);
        console.error("[MCP SSE] Request error:", error);
        reject(error);
      }
    });
  }

  private async establishSSESession(
    connection: Connection,
    abortSignal?: AbortSignal
  ): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new AdapterError("Session establishment timeout", "SESSION_TIMEOUT")
        );
      }, connection.timeout || 30000);

      try {
        const normalizedUrl = normalizeUrl(connection.url);
        const fetchFn = this.fetch || fetch;
        const response = await fetchFn(normalizedUrl, {
          method: "GET",
          headers: this.prepareSSEHeaders(connection),
          signal: abortSignal,
        });

        if (!response.ok) {
          clearTimeout(timeout);
          throw new AdapterError(
            `SSE session failed: ${response.status} ${response.statusText}`,
            "SSE_SESSION_FAILED"
          );
        }

        if (!response.body) {
          clearTimeout(timeout);
          throw new AdapterError("No response body for session", "SSE_NO_BODY");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let sessionId: string | null = null;
        let sessionEstablished = false;

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;

              if (trimmed.includes("ping -") || trimmed.includes("pong -")) {
                console.log(`[MCP SSE] Received ping/pong: ${trimmed}`);
                continue;
              }

              if (!sessionEstablished) {
                if (trimmed.startsWith("event: endpoint")) {
                  continue;
                }

                if (
                  trimmed.startsWith("data:") &&
                  trimmed.includes("sessionId=")
                ) {
                  const data = trimmed.substring(5).trim();
                  const match = data.match(/sessionId=([^&\s]+)/);
                  if (match) {
                    sessionId = match[1];
                    clearTimeout(timeout);
                    sessionEstablished = true;
                    resolve(sessionId);

                    this.startSSEListener(reader, decoder, buffer);
                    return;
                  }
                }

                if (trimmed.includes("sessionId")) {
                  const sessionMatch = trimmed.match(
                    /sessionId[=:]\s*([a-zA-Z0-9\-_]+)/
                  );
                  if (sessionMatch) {
                    sessionId = sessionMatch[1];
                    clearTimeout(timeout);
                    sessionEstablished = true;
                    resolve(sessionId);

                    this.startSSEListener(reader, decoder, buffer);
                    return;
                  }
                }
              }
            }
          }

          if (!sessionEstablished) {
            clearTimeout(timeout);
            reader.releaseLock();
            throw new AdapterError(
              "No session ID found in SSE stream",
              "SSE_NO_SESSION_ID"
            );
          }
        } catch (streamError) {
          clearTimeout(timeout);
          reader.releaseLock();
          throw streamError;
        }
      } catch (error) {
        clearTimeout(timeout);
        console.error("[MCP SSE] Session establishment error:", error);
        reject(error);
      }
    });
  }

  private async startSSEListener(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder,
    initialBuffer: string
  ): Promise<void> {
    let buffer = initialBuffer;
    let currentMessage = "";
    let isInJsonMessage = false;
    let braceCount = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.includes("ping -") || trimmed.includes("pong -")) {
            console.log(`[MCP SSE] Received keep-alive: ${trimmed}`);
            continue;
          }

          if (trimmed.startsWith("event: endpoint")) {
            continue;
          }

          if (trimmed.startsWith("event: message")) {
            isInJsonMessage = true;
            currentMessage = "";
            braceCount = 0;
            continue;
          }

          if (trimmed.startsWith("data:")) {
            const data = trimmed.substring(5).trim();
            if (!data) continue;

            if (data.includes("ping -") || data.includes("pong -")) {
              continue;
            }

            if (isInJsonMessage) {
              currentMessage += data;

              for (const char of data) {
                if (char === "{") braceCount++;
                if (char === "}") braceCount--;
              }

              if (braceCount === 0 && currentMessage.includes('"jsonrpc"')) {
                this.handleCompleteSSEMessage(currentMessage);
                currentMessage = "";
                isInJsonMessage = false;
              }
            } else {
              this.tryParseAndHandleMessage(data);
            }
          }
        }
      }
    } catch (error) {
      console.error("[MCP SSE] Persistent listener error:", error);
    } finally {
      reader.releaseLock();
    }
  }

  private handleCompleteSSEMessage(messageData: string): void {
    try {
      const parsedData = JSON.parse(messageData);

      if (parsedData.jsonrpc === "2.0" && parsedData.id) {
        const requestId = String(parsedData.id);
        const pendingRequest = this.pendingRequests.get(requestId);

        if (pendingRequest) {
          this.cleanupPendingRequest(requestId);

          if (parsedData.error) {
            pendingRequest.reject(
              new AdapterError(
                `MCP Error ${parsedData.error.code}: ${parsedData.error.message}`,
                "MCP_ERROR",
                parsedData.error
              )
            );
          } else {
            pendingRequest.resolve(parsedData.result);
          }
        } else {
          console.log(
            `[MCP SSE] No pending request found for ID: ${requestId}`
          );
        }
      }
    } catch (parseError) {
      console.error(`[MCP SSE] Failed to parse complete message:`, parseError);
      console.log(
        `[MCP SSE] Raw message data (first 500 chars):`,
        messageData.substring(0, 500)
      );
    }
  }

  private tryParseAndHandleMessage(data: string): void {
    if (!data.trim().startsWith("{") && !data.trim().startsWith("[")) {
      console.log(
        `[MCP SSE] Ignoring non-JSON message: ${data.substring(0, 100)}...`
      );
      return;
    }

    try {
      const parsedData = JSON.parse(data);
      if (parsedData.jsonrpc === "2.0" && parsedData.id) {
        this.handleCompleteSSEMessage(data);
      }
    } catch (parseError) {
      console.log(
        `[MCP SSE] Ignoring non-JSON data: ${data.substring(0, 100)}...`
      );
    }
  }

  private cleanupPendingRequest(requestId: string): void {
    const pendingRequest = this.pendingRequests.get(requestId);
    if (pendingRequest) {
      clearTimeout(pendingRequest.timeout);
      this.pendingRequests.delete(requestId);
    }
  }

  private async sendMCPRequest(
    connection: Connection,
    method: string,
    params?: Record<string, any>,
    abortSignal?: AbortSignal
  ): Promise<any> {
    const request: MCPMessage = {
      jsonrpc: "2.0",
      id: this.getNextRequestId(),
      method,
      params: params || {},
    };

    try {
      // Normalize URL before processing
      const normalizedConnection = {
        ...connection,
        url: normalizeUrl(connection.url),
      };

      if (normalizedConnection.connectionType) {
        switch (normalizedConnection.connectionType) {
          case "sse":
            return this.sendSSERequest(
              normalizedConnection,
              request,
              abortSignal
            );
          case "http":
            return this.sendHTTPRequest(
              normalizedConnection,
              request,
              abortSignal
            );
          case "websocket":
            return this.sendWebSocketRequest(normalizedConnection, request);
        }
      }

      const url = new URL(normalizedConnection.url);

      if (url.protocol === "http:" || url.protocol === "https:") {
        try {
          return await this.sendHTTPRequest(
            normalizedConnection,
            request,
            abortSignal
          );
        } catch (error) {
          console.log(
            "[MCP] HTTP request failed, trying other methods:",
            error
          );

          if (
            url.pathname.includes("/sse") ||
            normalizedConnection.url.includes("/sse")
          ) {
            console.log("[MCP] Trying SSE mode based on URL pattern");
            return this.sendSSERequest(
              normalizedConnection,
              request,
              abortSignal
            );
          }

          throw error;
        }
      }

      if (url.protocol === "ws:" || url.protocol === "wss:") {
        return this.sendWebSocketRequest(normalizedConnection, request);
      }

      return this.sendHTTPRequest(normalizedConnection, request, abortSignal);
    } catch (error) {
      console.error(`[MCP] Request failed for ${method}:`, error);
      throw error;
    }
  }

  private parseSSEResponse(sseText: string): any {
    const lines = sseText.split("\n");
    let jsonData = "";
    let inDataSection = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith("event:")) {
        inDataSection = false;
        continue;
      }

      if (trimmed.startsWith("data:")) {
        inDataSection = true;
        const data = trimmed.substring(5).trim();
        jsonData += data;
        continue;
      }

      if (inDataSection && trimmed && !trimmed.startsWith("event:")) {
        jsonData += trimmed;
      }
    }

    if (!jsonData) {
      throw new AdapterError(
        "No JSON data found in SSE response",
        "SSE_NO_DATA"
      );
    }

    try {
      const parsedData = JSON.parse(jsonData);

      if (parsedData.error) {
        throw new AdapterError(
          `MCP Error ${parsedData.error.code}: ${parsedData.error.message}`,
          "MCP_ERROR",
          parsedData.error
        );
      }

      return parsedData.result;
    } catch (parseError) {
      console.error("[MCP] Failed to parse SSE JSON data:", parseError);
      console.error("[MCP] Raw JSON data was:", jsonData);
      throw new AdapterError(
        `Invalid JSON in SSE response: ${(parseError as Error).message}`,
        "SSE_JSON_PARSE_ERROR"
      );
    }
  }

  private async sendHTTPRequest(
    connection: Connection,
    request: MCPMessage,
    abortSignal?: AbortSignal
  ): Promise<any> {
    try {
      const normalizedUrl = normalizeUrl(connection.url);
      const fetchFn = this.fetch || fetch;
      const response = await fetchFn(normalizedUrl, {
        method: "POST",
        headers: this.prepareHeaders(connection),
        body: JSON.stringify(request),
        signal: abortSignal,
      });

      if (!response.ok) {
        throw new AdapterError(
          `HTTP ${response.status}: ${response.statusText}`,
          "HTTP_ERROR"
        );
      }

      const responseText = await response.text();

      if (!responseText || responseText.trim().length === 0) {
        console.error("[MCP] Empty response from server");
        throw new AdapterError(
          "Server returned empty response",
          "EMPTY_RESPONSE"
        );
      }

      if (responseText.includes("event:") && responseText.includes("data:")) {
        return this.parseSSEResponse(responseText);
      }

      if (
        responseText.trim().startsWith("{") ||
        responseText.trim().startsWith("[")
      ) {
        try {
          const parsedResponse = JSON.parse(responseText);
          console.log("[MCP] Parsed JSON response:", parsedResponse);

          if (parsedResponse.error) {
            throw new AdapterError(
              `MCP Error ${parsedResponse.error.code}: ${parsedResponse.error.message}`,
              "MCP_ERROR",
              parsedResponse.error
            );
          }

          return parsedResponse.result;
        } catch (parseError) {
          console.error("[MCP] Failed to parse JSON:", parseError);
          throw new AdapterError(
            `Invalid JSON response: ${(parseError as Error).message}`,
            "JSON_PARSE_ERROR"
          );
        }
      }

      if (responseText.includes("ping") || responseText.includes("pong")) {
        return {
          protocolVersion: "2025-06-18",
          serverInfo: {
            name: "MCP Server",
            version: "1.0.0",
          },
          capabilities: {},
        };
      }

      throw new AdapterError(
        `Server returned unrecognized response format: ${responseText.substring(0, 100)}`,
        "UNRECOGNIZED_RESPONSE"
      );
    } catch (error) {
      console.error("[MCP] HTTP request failed:", error);
      throw error;
    }
  }

  private async sendWebSocketRequest(
    connection: Connection,
    request: MCPMessage
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const normalizedUrl = normalizeUrl(connection.url);
      const ws = new WebSocket(normalizedUrl);
      const timeout = setTimeout(() => {
        ws.close();
        reject(
          new AdapterError("WebSocket request timeout", "REQUEST_TIMEOUT")
        );
      }, connection.timeout || 30000);

      ws.onopen = () => {
        ws.send(JSON.stringify(request));
      };

      ws.onmessage = event => {
        try {
          const response = JSON.parse(event.data);

          clearTimeout(timeout);
          ws.close();

          if (response.error) {
            reject(
              new AdapterError(
                `MCP Error ${response.error.code}: ${response.error.message}`,
                "MCP_ERROR",
                response.error
              )
            );
          } else {
            resolve(response.result);
          }
        } catch (error) {
          clearTimeout(timeout);
          ws.close();
          reject(error);
        }
      };

      ws.onerror = error => {
        clearTimeout(timeout);
        reject(
          new AdapterError(`WebSocket error: ${error}`, "WEBSOCKET_ERROR")
        );
      };

      ws.onclose = event => {
        clearTimeout(timeout);
        if (event.code !== 1000) {
          reject(
            new AdapterError(
              `WebSocket closed unexpectedly: ${event.code} ${event.reason}`,
              "WEBSOCKET_CLOSED"
            )
          );
        }
      };
    });
  }

  async initialize(): Promise<void> {
    this.status = AdapterStatus.IDLE;
  }

  async cleanup(): Promise<void> {
    for (const [, pendingRequest] of this.pendingRequests) {
      clearTimeout(pendingRequest.timeout);
      pendingRequest.reject(new AdapterError("Service cleanup", "CLEANUP"));
    }
    this.pendingRequests.clear();

    this.sessionCache.clear();
    this.connectionCache.clear();
    this.status = AdapterStatus.DISCONNECTED;
  }

  async testConnection(connection: Connection): Promise<boolean> {
    const maxRetries = 3;
    const retryDelay = 1000;
    const normalizedConnection = {
      ...connection,
      url: normalizeUrl(connection.url),
    };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.sessionCache.delete(normalizedConnection.url);
        this.connectionCache.delete(normalizedConnection.url);

        const abortController = new AbortController();
        const timeout = setTimeout(() => {
          abortController.abort();
        }, connection.timeout || 30000);

        try {
          const result = await this.sendMCPRequest(
            normalizedConnection,
            "initialize",
            {
              protocolVersion: "2025-06-18",
              capabilities: {
                sampling: {},
                elicitation: {},
                roots: { listChanged: true },
              },
              clientInfo: this.config.clientInfo,
            },
            abortController.signal
          );

          clearTimeout(timeout);

          if (result && result.protocolVersion && result.serverInfo) {
            this.connectionCache.set(normalizedConnection.url, {
              isConnected: true,
              lastUsed: Date.now(),
            });
            return true;
          }
        } catch (error) {
          clearTimeout(timeout);

          if (isAbortError(error)) {
            console.log(`[MCP] Test attempt ${attempt} aborted: timeout`);
          } else {
            console.log(`[MCP] Test attempt ${attempt} failed:`, error);
          }

          if (attempt < maxRetries) {
            console.log(
              `[MCP] Retrying in ${retryDelay}ms... (${attempt}/${maxRetries})`
            );
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
      } catch (error) {
        console.log(`[MCP] Test error on attempt ${attempt}:`, error);

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    console.log(`[MCP] All ${maxRetries} test attempts failed`);
    return false;
  }

  async connectAndIntrospect(
    connection: Connection
  ): Promise<MCPConnectionResult> {
    const maxRetries = connection.retryAttempts || 2;
    let lastError: Error | undefined;
    const normalizedConnection = {
      ...connection,
      url: normalizeUrl(connection.url),
    };

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const abortController = new AbortController();
        const timeout = setTimeout(() => {
          abortController.abort();
        }, connection.timeout || 60000);

        try {
          const initResult = await this.sendMCPRequest(
            normalizedConnection,
            "initialize",
            {
              protocolVersion: "2025-06-18",
              capabilities: {
                sampling: {},
                elicitation: {},
                roots: { listChanged: true },
              },
              clientInfo: this.config.clientInfo,
            },
            abortController.signal
          );

          if (!initResult) {
            return {
              isConnected: false,
              tools: [],
              resources: [],
              error: "Initialize returned empty response",
            };
          }

          const serverInfo: MCPServerInfo = initResult.serverInfo;
          const capabilities: MCPCapabilities = initResult.capabilities;

          let mcpTools: MCPToolDefinition[] = [];
          if (capabilities.tools) {
            try {
              console.log("[MCP] Requesting tools list...");
              const toolsResult = await this.sendMCPRequest(
                normalizedConnection,
                "tools/list",
                { _meta: { progressToken: 2 } },
                abortController.signal
              );
              mcpTools = toolsResult.tools || [];
              console.log(`[MCP] Successfully loaded ${mcpTools.length} tools`);
            } catch (error) {
              console.warn("[MCP] Tools listing failed:", error);
            }
          }

          let mcpResources: MCPResourceDefinition[] = [];
          if (capabilities.resources) {
            try {
              const resourcesResult = await this.sendMCPRequest(
                normalizedConnection,
                "resources/list",
                {},
                abortController.signal
              );
              mcpResources = resourcesResult.resources || [];
            } catch (error) {
              console.warn("[MCP] Resources listing failed:", error);
            }
          }

          clearTimeout(timeout);

          const tools: Tool[] = mcpTools.map(mcpTool =>
            this.convertMCPToolToTool(mcpTool)
          );
          const resources: Resource[] = mcpResources.map(mcpResource =>
            this.convertMCPResourceToResource(mcpResource)
          );

          this.connectionCache.set(normalizedConnection.url, {
            isConnected: true,
            lastUsed: Date.now(),
          });

          return {
            isConnected: true,
            serverInfo,
            capabilities,
            tools,
            resources,
          };
        } catch (error) {
          clearTimeout(timeout);
          throw error;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        this.sessionCache.delete(normalizedConnection.url);
        this.connectionCache.delete(normalizedConnection.url);

        if (attempt < maxRetries) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt), 5000);
          await delay(backoffMs);
        }
      }
    }

    console.error(`[MCP] All attempts failed:`, lastError);
    return {
      isConnected: false,
      tools: [],
      resources: [],
      error: lastError?.message || "Connection failed after all retries",
    };
  }

  async executeTool(
    connection: Connection,
    toolName: string,
    arguments_: Record<string, any> = {}
  ): Promise<MCPToolExecutionResult> {
    const executionId = this.generateId();
    const startTime = Date.now();
    const normalizedConnection = {
      ...connection,
      url: normalizeUrl(connection.url),
    };

    const baseExecution: ToolExecution = {
      id: executionId,
      tool: toolName,
      status: "pending",
      duration: 0,
      timestamp: new Date().toLocaleTimeString(),
      request: {
        tool: toolName,
        arguments: arguments_,
        timestamp: new Date().toISOString(),
      },
    };

    const maxRetries = Math.min(connection.retryAttempts || 2, 3);
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const abortController = new AbortController();
        const timeout = setTimeout(() => {
          abortController.abort();
        }, connection.timeout || 30000);

        try {
          const result = await this.sendMCPRequest(
            normalizedConnection,
            "tools/call",
            {
              name: toolName,
              arguments: arguments_,
            },
            abortController.signal
          );

          clearTimeout(timeout);
          const endTime = Date.now();
          const duration = endTime - startTime;

          const successExecution: ToolExecution = {
            ...baseExecution,
            status: "success",
            duration,
            response: {
              success: true,
              result,
              timestamp: new Date().toISOString(),
            },
          };

          return {
            success: true,
            result,
            execution: successExecution,
          };
        } catch (error) {
          clearTimeout(timeout);
          throw error;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (isAbortError(error)) {
          break;
        }

        if (
          lastError.message.includes("session") ||
          lastError.message.includes("404")
        ) {
          this.sessionCache.delete(normalizedConnection.url);
          this.connectionCache.delete(normalizedConnection.url);
        }

        if (attempt < maxRetries) {
          const backoffMs = Math.min(500 * Math.pow(2, attempt), 2000);
          await delay(backoffMs);
        }
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    const errorMessage =
      lastError?.message || "Tool execution failed after all retries";

    console.error(`[MCP] Tool execution failed:`, errorMessage);

    const errorExecution: ToolExecution = {
      ...baseExecution,
      status: "error",
      duration,
      error: errorMessage,
    };

    return {
      success: false,
      error: errorMessage,
      execution: errorExecution,
    };
  }

  // Static convenience methods
  static async testConnection(
    connection: Connection,
    fetch?: FetchFunction
  ): Promise<boolean> {
    const service = MCPService.getInstance(undefined, fetch);
    return service.testConnection(connection);
  }

  static async connectAndIntrospect(
    connection: Connection,
    fetch?: FetchFunction
  ) {
    const service = MCPService.getInstance(undefined, fetch);
    return service.connectAndIntrospect(connection);
  }

  static async executeTool(
    connection: Connection,
    toolName: string,
    arguments_: Record<string, any> = {},
    fetch?: FetchFunction
  ) {
    const service = MCPService.getInstance(undefined, fetch);
    return service.executeTool(connection, toolName, arguments_);
  }

  static validateConnectionUrl(url: string): boolean {
    return MCPAdapter.validateConnectionUrl(url);
  }

  static formatConnectionUrl(url: string): string {
    return normalizeUrl(MCPAdapter.formatConnectionUrl(url));
  }

  static getConnectionStatus(connection: Connection) {
    return MCPAdapter.getConnectionStatus(connection);
  }

  static createConnection(connectionData: Omit<Connection, "id">): Connection {
    return MCPAdapter.createConnection({
      ...connectionData,
      url: normalizeUrl(connectionData.url),
    });
  }
}
