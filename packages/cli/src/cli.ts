#!/usr/bin/env node
import { program } from "commander";
import { startServer, openBrowser } from "./index.js";

program
  .name("mcpconnect")
  .description("MCPConnect CLI tool")
  .version("0.0.0-alpha.1");

program
  .command("start")
  .description("Start MCPConnect server")
  .action(async () => {
    await startServer();
    openBrowser();
  });

program.parseAsync(process.argv);
