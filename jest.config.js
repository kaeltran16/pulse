module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '/backend/'],
  // Per-file `@jest-environment node` docblocks let DB suites swap the
  // jest-expo default env for plain node so better-sqlite3 can load.
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
};
