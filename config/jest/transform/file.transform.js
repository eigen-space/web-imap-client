'use strict';

const path = require('path');

// This is a custom Jest transformer turning file imports into filenames.
// It is mock for files that do not matter during spec runs.
// https://jestjs.io/docs/en/webpack#handling-static-assets

module.exports = {
    process(src, filename) {
        return `module.exports = ${JSON.stringify(path.basename(filename))};`;
    }
};