module.exports = {
    clearMocks: true,
    collectCoverageFrom: [
        'src/**/*.{ts,tsx}'
    ],
    coveragePathIgnorePatterns: [
        '.*\\.d\\.ts'
    ],
    testMatch: [
        '<rootDir>/src/**/*.spec.(ts|tsx)'
    ],
    setupFiles: [
        '<rootDir>/config/jest/setup/fetch.setup.js',
        '<rootDir>/config/jest/setup/console.setup.js'
    ],
    testURL: 'http://localhost',
    transform: {
        '^(?!.*\\.(js|ts|tsx|css|json)$)': '<rootDir>/config/jest/transform/file.transform.js',
        '^.+\\.tsx?$': '<rootDir>/config/jest/transform/typescript.transform.js'
    },
    moduleFileExtensions: [
        'web.ts',
        'ts',
        'tsx',
        'web.js',
        'js',
        'json',
        'node'
    ],
    globals: {
        'ts-jest': { tsConfig: './tsconfig.spec.json' }
    }
};
