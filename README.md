# About

This is email adapter service.

# Getting started

1. `yarn install` - install the dependencies.
2. `yarn dev` - start on the localhost at 3230 port.

# Why do we have that dependencies?

* `@eigenspace/utils` - used for logging.
* `nodemailer` - to send emails.
* `tmp` - to temporary create files to upload them to enabler.
* `imap-simple` - wrapper for imap protocol to fetch emails.
* `mailparser` - to parse emails.

# Why do we have that dev dependencies?

* `@eigenspace/codestyle` - includes lint rules, config for typescript.
* `@eigenspace/common-types` - includes common types.
* `@eigenspace/helper-scripts` - helps us copy files.
* `@eigenspace/commit-linter` - linter for commit messages.
* `eslint-plugin-eigenspace-script` - includes set of script linting rules and configuration for them.
* `@types/*` - contains type definitions for specific library.
* `jest` - testing framework to write unit specs (including snapshots).
* `ts-node` - to run without build typescript.
* `ts-jest` - it lets you use Jest to test projects written in TypeScript.
* `typescript` - is a superset of JavaScript that have static type-checking and ECMAScript features.
* `husky` - used for configure git hooks.
* `lint-staged` - used for configure linters against staged git files.
* `eslint` - it checks code for readability, maintainability, and functionality errors.
* `ts-jest` - *
* `jest` - *
* `ts-loader` - *
