#!/usr/bin/env node

import { program } from "commander";
import { startServer } from "@mcpconnect/server";
import chalk from "chalk";
import ora from "ora";
import open from "open";

program.name("mcpconnect").description("MCPConnect CLI tool").version("0.0.0");

program
  .command("start")
  .description("Start MCPConnect server")
  .option("-p, --port <port>", "Port to run server on", "3001")
  .option("-h, --host <host>", "Host to bind server to", "localhost")
  .option("--no-open", "Don't automatically open browser")
  .option("--no-cors", "Disable CORS")
  .option("--no-helmet", "Disable security headers")
  .action(async options => {
    const spinner = ora("Starting MCPConnect server...").start();

    try {
      const { url } = await startServer({
        port: parseInt(options.port),
        host: options.host,
        cors: options.cors,
        helmet: options.helmet,
      });

      spinner.succeed(chalk.green(`MCPConnect server started successfully!`));
      console.log(
        `\n${chalk.blue("🚀 Server running at:")} ${chalk.cyan(url)}`
      );
      console.log(`${chalk.blue("📱 UI available at:")} ${chalk.cyan(url)}\n`);

      if (options.open) {
        console.log(chalk.gray("Opening browser..."));
        await open(url);
      }

      // Keep the process running
      process.on("SIGINT", () => {
        console.log(chalk.yellow("\n🛑 Shutting down MCPConnect server..."));
        process.exit(0);
      });
    } catch (error) {
      spinner.fail(chalk.red("Failed to start server"));
      console.error(
        chalk.red(error instanceof Error ? error.message : String(error))
      );
      process.exit(1);
    }
  });

// Default command - start server
program
  .argument("[port]", "Port to run server on (default: 3001)")
  .option("-h, --host <host>", "Host to bind server to", "localhost")
  .option("--no-open", "Don't automatically open browser")
  .option("--no-cors", "Disable CORS")
  .option("--no-helmet", "Disable security headers")
  .action(async (port, options) => {
    const spinner = ora("Starting MCPConnect server...").start();

    try {
      const serverPort = port ? parseInt(port) : 3001;
      const { url } = await startServer({
        port: serverPort,
        host: options.host,
        cors: options.cors,
        helmet: options.helmet,
      });

      spinner.succeed(chalk.green(`MCPConnect server started successfully!`));
      console.log(
        `\n${chalk.blue("🚀 Server running at:")} ${chalk.cyan(url)}`
      );
      console.log(`${chalk.blue("📱 UI available at:")} ${chalk.cyan(url)}\n`);

      if (options.open) {
        console.log(chalk.gray("Opening browser..."));
        await open(url);
      }

      // Keep the process running
      process.on("SIGINT", () => {
        console.log(chalk.yellow("\n🛑 Shutting down MCPConnect server..."));
        process.exit(0);
      });
    } catch (error) {
      spinner.fail(chalk.red("Failed to start server"));
      console.error(
        chalk.red(error instanceof Error ? error.message : String(error))
      );
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
