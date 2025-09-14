# Publishing Setup Guide

This guide explains how to set up automated publishing for your MCPConnect monorepo.

## Prerequisites

1. **NPM Account & Token**
   - Create an NPM account at https://www.npmjs.com
   - Generate an automation token: Profile → Access Tokens → Generate New Token → Automation
   - Copy the token for GitHub secrets

2. **GitHub Repository Setup**
   - Push your code to GitHub
   - Go to Settings → Secrets and Variables → Actions
   - Add secret: `NPM_TOKEN` with your NPM automation token

## File Setup

Create these files in your repository:

1. **scripts/version-bump.js** - Enhanced version bumping with workspace dependency handling
2. **scripts/restore-workspace-deps.js** - Restores workspace:\* after publishing
3. **scripts/publish-initial.js** - Initial deployment script
4. **CHANGELOG.md** - Track changes between versions

Update these existing files:

- **package.json** - Add new publishing scripts
- **.github/workflows/publish.yml** - Enhanced publish workflow

## Publishing Workflow

### Initial Setup (One Time)

```bash
# 1. Set your first version
pnpm version:set 0.1.0

# 2. Test the build locally
pnpm validate

# 3. Do a dry run of the publish process
pnpm publish:initial:dry

# 4. If everything looks good, do the initial publish
pnpm publish:initial
```

### Subsequent Releases

For each new release:

```bash
# 1. Make your changes and commit them
git add .
git commit -m "feat: add new features"

# 2. Bump version (patch/minor/major)
pnpm version:patch  # or version:minor, version:major

# 3. Push the tag to trigger automated publishing
git push origin main --tags
```

## What Happens During Publishing

### Local Publishing (`pnpm publish:initial`)

1. Validates you're on main branch with clean working tree
2. Pulls latest changes
3. Installs dependencies and runs validation
4. Temporarily replaces `workspace:*` with actual version numbers
5. Builds all packages
6. Publishes to NPM
7. Creates and pushes git tag
8. Restores `workspace:*` dependencies for local development

### GitHub Actions Publishing (on tag push)

1. Checks out code and sets up Node.js/pnpm
2. Runs linting and type checking
3. Replaces `workspace:*` with version numbers
4. Builds all packages
5. Publishes to NPM
6. Creates GitHub release with changelog

## Important Notes

### Workspace Dependencies

- **Development**: Uses `workspace:*` for internal dependencies
- **Publishing**: Automatically converts to `^X.Y.Z` format
- **After Publishing**: Local workspace deps are restored automatically

### Version Synchronization

All packages are published with the same version number to ensure compatibility.

### Package Publishing Order

Dependencies are handled automatically by pnpm, but the logical order is:

1. `@mcpconnect/components` (no internal deps)
2. `@mcpconnect/ui` (depends on components)
3. `@mcpconnect/server` (depends on ui)
4. `@mcpconnect/cli` (depends on server)

## Scripts Reference

```bash
# Version Management
pnpm version:patch              # Bump patch version (0.1.0 → 0.1.1)
pnpm version:minor              # Bump minor version (0.1.0 → 0.2.0)
pnpm version:major              # Bump major version (0.1.0 → 1.0.0)
pnpm version:set 1.2.3          # Set specific version

# Publishing
pnpm publish:initial            # Initial publish (local)
pnpm publish:initial:dry        # Dry run of initial publish
pnpm publish:dry-run            # Test package creation

# Development
pnpm restore-workspace-deps     # Restore workspace:* (if needed)
pnpm validate                   # Run all checks before publish
```

## Troubleshooting

### "Package already exists" Error

- Check if version was already published
- Bump version and try again

### Workspace Dependencies Not Resolved

- Run `pnpm restore-workspace-deps` to fix local development
- Check that all internal packages use `workspace:*` format

### GitHub Actions Failing

- Verify NPM_TOKEN secret is set correctly
- Check that all validation steps pass locally first

### Local Publish Failing

- Ensure you're logged into NPM: `npm login`
- Check NPM token has correct permissions
- Verify all packages build successfully

## Security Considerations

- NPM tokens should be automation tokens (not classic tokens)
- Never commit tokens to the repository
- Use GitHub secrets for CI/CD
- Regularly rotate NPM tokens
