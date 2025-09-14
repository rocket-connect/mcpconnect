#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function updateVersion(filePath, newVersion) {
  const packageJson = JSON.parse(fs.readFileSync(filePath, "utf8"));
  packageJson.version = newVersion;
  fs.writeFileSync(filePath, JSON.stringify(packageJson, null, 2) + "\n");
  console.log(`Updated ${filePath} to ${newVersion}`);
}

function incrementVersion(version, type) {
  const parts = version.split(".").map(Number);

  switch (type) {
    case "patch":
      parts[2]++;
      break;
    case "minor":
      parts[1]++;
      parts[2] = 0;
      break;
    case "major":
      parts[0]++;
      parts[1] = 0;
      parts[2] = 0;
      break;
    default:
      throw new Error(`Invalid version type: ${type}`);
  }

  return parts.join(".");
}

function replaceWorkspaceDeps(packagePath, version) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const workspacePackages = [
    "@mcpconnect/schemas",
    "@mcpconnect/base-adapters",
    "@mcpconnect/adapter-localstorage",
    "@mcpconnect/adapter-ai-sdk",
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
          packageJson[depType][dep] === "workspace:*"
        ) {
          packageJson[depType][dep] = `^${version}`;
          modified = true;
          console.log(`  Replaced workspace:* with ^${version} for ${dep}`);
        }
      });
    }
  });

  if (modified) {
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + "\n");
    console.log(`Updated workspace dependencies in ${packagePath}`);
  }

  return modified;
}

function restoreWorkspaceDeps(packagePath) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const workspacePackages = [
    "@mcpconnect/schemas",
    "@mcpconnect/base-adapters",
    "@mcpconnect/adapter-localstorage",
    "@mcpconnect/adapter-ai-sdk",
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
        }
      });
    }
  });

  if (modified) {
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + "\n");
  }
}

function main() {
  const args = process.argv.slice(2);

  // Filter out flags
  const shouldPreparePublish = args.includes("--prepare-publish");
  const versionArg = args.find(arg => !arg.startsWith("--"));

  if (!versionArg) {
    console.error(
      "Usage: node version-bump.js <patch|minor|major|version> [--prepare-publish]"
    );
    console.error("Example: node version-bump.js patch");
    console.error("Example: node version-bump.js 1.2.3 --prepare-publish");
    process.exit(1);
  }

  const rootPackagePath = path.join(__dirname, "..", "package.json");
  const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, "utf8"));

  let newVersion;

  if (["patch", "minor", "major"].includes(versionArg)) {
    newVersion = incrementVersion(rootPackage.version, versionArg);
  } else {
    newVersion = versionArg;
  }

  // Validate version format
  if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9-.]+)?$/.test(newVersion)) {
    console.error(`Invalid version format: ${newVersion}`);
    process.exit(1);
  }

  console.log(`Updating all packages to version ${newVersion}`);

  // Update root package.json
  updateVersion(rootPackagePath, newVersion);

  // All publishable package paths - INCLUDING all adapters
  const packagePaths = [
    "packages/schemas/package.json",
    "packages/base-adapters/package.json",
    "packages/adapter-localstorage/package.json",
    "packages/adapter-ai-sdk/package.json",
    "packages/cli/package.json",
    "packages/components/package.json",
    "apps/server/package.json",
    "apps/ui/package.json",
  ];

  // Update all package.json files
  packagePaths.forEach(packagePath => {
    const fullPath = path.join(__dirname, "..", packagePath);
    if (fs.existsSync(fullPath)) {
      updateVersion(fullPath, newVersion);

      // Replace workspace:* with actual versions for publishing
      if (shouldPreparePublish) {
        replaceWorkspaceDeps(fullPath, newVersion);
      }
    } else {
      console.warn(`Package not found: ${fullPath}`);
    }
  });

  console.log(`\nAll packages updated to ${newVersion}`);

  if (shouldPreparePublish) {
    console.log(
      "\nWorkspace dependencies replaced with version numbers for publishing."
    );
    console.log(
      "After publishing, run 'node scripts/restore-workspace-deps.js' to restore workspace:* dependencies"
    );
  } else {
    console.log("Next steps:");
    console.log(`  git add .`);
    console.log(`  git commit -m "v${newVersion}"`);
    console.log(`  git tag v${newVersion}`);
    console.log(`  git push origin main --tags`);
  }
}

// Export functions for use in other scripts
if (require.main === module) {
  main();
} else {
  module.exports = {
    updateVersion,
    incrementVersion,
    replaceWorkspaceDeps,
    restoreWorkspaceDeps,
  };
}
