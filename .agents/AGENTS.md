# Project Rules - Social Content Platform

## Dependencies & Setup

### Google GenAI SDK Versioning
- When referencing the Google GenAI SDK, use the modern package name `@google/genai` (not the EOL `@google/generative-ai`).
- Always target stable GA version ranges (`^1.x.x` or `^2.x.x`) for `@google/genai`. Never use `0.x.x` versions, as they do not exist in the public npm registry for this package.

### Peer Dependency Resolution
- In projects using React 19 RC, use a `.npmrc` containing `legacy-peer-deps=true` to automatically bypass strict peer dependency verification errors during `npm install`.
