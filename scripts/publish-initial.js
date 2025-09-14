#!/usr/bin/env node

const { execSync } = require("child_process");
const {
  replaceWorkspaceDeps,
  restoreWorkspaceDeps,
} = require("./version-bump.js");
const fs = require("fs");
const path = require("path");

function getCurrentVersion() {
  const packagePath = path.join(__dirname, "..", "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  return packageJson.version;
}

function execSyncLog(command, options = {}) {
  console.log(`> ${command}`);
  try {
    return execSync(command, { stdio: "inherit", ...options });
  } catch (error) {
    console.error(`Failed to execute: ${command}`);
    throw error;
  }
}

function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  let hasStashedChanges = false;

  console.log(`${isDryRun ? "DRY RUN: " : ""}Starting publish process...`);

  try {
    // Get current version
    const version = getCurrentVersion();
    console.log(`Current version: ${version}`);

    // Ensure we're on main branch
    const branch = execSync("git branch --show-current", {
      encoding: "utf8",
    }).trim();
    if (branch !== "main") {
      throw new Error(`Must be on main branch. Currently on: ${branch}`);
    }

    // Ensure working tree is clean
    try {
      execSync("git diff-index --quiet HEAD --", { stdio: "pipe" });
    } catch {
      throw new Error(
        "Working tree is not clean. Please commit or stash changes."
      );
    }

    // Pull latest changes
    console.log("Pulling latest changes...");
    execSyncLog("git pull origin main");

    // Install dependencies
    console.log("Installing dependencies...");
    execSyncLog("pnpm install --frozen-lockfile");

    // Run validation
    console.log("Running validation...");
    execSyncLog("pnpm validate");

    // Prepare for publishing - replace workspace:* deps
    console.log("Preparing packages for publishing...");
    const packagePaths = [
      "packages/cli/package.json",
      "packages/components/package.json",
      "apps/server/package.json",
      "apps/ui/package.json",
    ];

    packagePaths.forEach(packagePath => {
      const fullPath = path.join(__dirname, "..", packagePath);
      if (fs.existsSync(fullPath)) {
        replaceWorkspaceDeps(fullPath, version);
      }
    });

    // Build all packages
    console.log("Building all packages...");
    execSyncLog("pnpm build");

    if (isDryRun) {
      console.log("DRY RUN: Would publish packages now");
      execSyncLog("pnpm publish:dry-run");
    } else {
      // Publish all packages
      console.log("Publishing packages to NPM...");
      execSyncLog("pnpm publish:packages");

      // Create and push git tag
      const tag = `v${version}`;
      console.log(`Creating and pushing tag: ${tag}`);
      execSyncLog(`git tag ${tag}`);
      execSyncLog(`git push origin ${tag}`);
    }

    console.log(
      `${isDryRun ? "DRY RUN: " : ""}Publish completed successfully!`
    );
  } catch (error) {
    console.error("Publish failed:", error.message);
    process.exit(1);
  } finally {
    // Always restore workspace dependencies
    console.log("Restoring workspace dependencies...");
    const packagePaths = [
      "packages/cli/package.json",
      "packages/components/package.json",
      "apps/server/package.json",
      "apps/ui/package.json",
    ];

    packagePaths.forEach(packagePath => {
      const fullPath = path.join(__dirname, "..", packagePath);
      if (fs.existsSync(fullPath)) {
        restoreWorkspaceDeps(fullPath);
      }
    });

    console.log("Workspace dependencies restored.");
  }
}

main();
