module.exports = {
  preset: 'jest-expo/web',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  setupFiles: ['./jest.setup.js'],
  collectCoverageFrom: [
    'src/utils/**/*.ts',
    'src/contexts/**/*.ts',
    'src/hooks/**/*.ts',
    'src/components/script-panel/script-engine.ts',
    '!src/**/*.d.ts',
  ],
};
