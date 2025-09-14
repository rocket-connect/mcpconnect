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

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: node version-bump.js <patch|minor|major|version>");
    process.exit(1);
  }

  const rootPackagePath = path.join(__dirname, "..", "package.json");
  const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, "utf8"));

  let newVersion;

  if (["patch", "minor", "major"].includes(args[0])) {
    newVersion = incrementVersion(rootPackage.version, args[0]);
  } else {
    newVersion = args[0];
  }

  // Validate version format
  if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9-.]+)?$/.test(newVersion)) {
    console.error(`Invalid version format: ${newVersion}`);
    process.exit(1);
  }

  console.log(`Updating all packages to version ${newVersion}`);

  // Update root package.json
  updateVersion(rootPackagePath, newVersion);

  // All publishable package paths
  const packagePaths = [
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
    } else {
      console.warn(`Package not found: ${fullPath}`);
    }
  });

  console.log(`\nAll packages updated to ${newVersion}`);
  console.log("Next steps:");
  console.log(`  git add .`);
  console.log(`  git commit -m "v${newVersion}"`);
  console.log(`  git tag v${newVersion}`);
  console.log(`  git push origin main --tags`);
}

main();
