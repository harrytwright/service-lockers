/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  roots: ['<rootDir>'],
  globalSetup: '<rootDir>/jest/setup.ts',
  // globalTeardown: '<rootDir>/_tests/teardown.ts',
  coverageThreshold: {
    global: {
      branches: 65,
      functions: 85,
      lines: 85,
    }
  },
  coveragePathIgnorePatterns: [
    'node_modules',
    'jest',
  ]
}
