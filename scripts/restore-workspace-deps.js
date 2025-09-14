#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function restoreWorkspaceDeps(packagePath) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const workspacePackages = [
    "@mcpconnect/components",
    "@mcpconnect/server",
    "@mcpconnect/ui",
    "mcpconnect",
  ];

  let modified = false;

  ["dependencies", "devDependencies", "peerDependencies"].forEach(depType => {
    if (packageJson[depType]) {
      Object.keys(packageJson[depType]).forEach(dep => {
        if (
          workspacePackages.includes(dep) &&
          packageJson[depType][dep].startsWith("^")
        ) {
          packageJson[depType][dep] = "workspace:*";
          modified = true;
          console.log(`  Restored workspace:* for ${dep}`);
        }
      });
    }
  });

  if (modified) {
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + "\n");
    console.log(`Restored workspace dependencies in ${packagePath}`);
  }

  return modified;
}

function main() {
  console.log("Restoring workspace:* dependencies...");

  // All publishable package paths
  const packagePaths = [
    "packages/cli/package.json",
    "packages/components/package.json",
    "apps/server/package.json",
    "apps/ui/package.json",
  ];

  let totalRestored = 0;

  // Restore workspace deps in all packages
  packagePaths.forEach(packagePath => {
    const fullPath = path.join(__dirname, "..", packagePath);
    if (fs.existsSync(fullPath)) {
      if (restoreWorkspaceDeps(fullPath)) {
        totalRestored++;
      }
    } else {
      console.warn(`Package not found: ${fullPath}`);
    }
  });

  console.log(
    `\nRestored workspace dependencies in ${totalRestored} package(s)`
  );
  console.log("Ready for local development!");
}

main();
