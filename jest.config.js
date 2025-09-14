module.exports = {
  projects: [
    {
      displayName: "cli",
      testMatch: ["<rootDir>/packages/cli/**/*.test.ts"],
      preset: "ts-jest",
      testEnvironment: "node",
      rootDir: ".",
    },
    {
      displayName: "components",
      testMatch: ["<rootDir>/packages/components/**/*.test.{ts,tsx}"],
      preset: "ts-jest",
      testEnvironment: "jsdom",
      setupFilesAfterEnv: ["<rootDir>/packages/components/jest.setup.js"],
      moduleNameMapping: {
        "^@/(.*)$": "<rootDir>/packages/components/src/$1",
      },
      rootDir: ".",
    },
    {
      displayName: "ui",
      testMatch: ["<rootDir>/apps/ui/**/*.test.{ts,tsx}"],
      preset: "ts-jest",
      testEnvironment: "jsdom",
      setupFilesAfterEnv: ["<rootDir>/apps/ui/jest.setup.js"],
      moduleNameMapping: {
        "^@/(.*)$": "<rootDir>/apps/ui/src/$1",
      },
      rootDir: ".",
    },
    {
      displayName: "server",
      testMatch: ["<rootDir>/apps/server/**/*.test.ts"],
      preset: "ts-jest",
      testEnvironment: "node",
      rootDir: ".",
    },
  ],
  collectCoverageFrom: [
    "packages/*/src/**/*.{ts,tsx}",
    "apps/*/src/**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!**/*.stories.{ts,tsx}",
    "!**/node_modules/**",
  ],
};
