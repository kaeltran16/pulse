module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '/backend/'],
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  // Per-file `@jest-environment node` docblocks let DB suites swap the
  // jest-expo default env for plain node so better-sqlite3 can load.
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
};
