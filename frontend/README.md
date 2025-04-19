# Misaki Frontend

This is the frontend for the Misaki project. It acts as a mini-IDE for interacting with repositories, editing files, and orchestrating Repomix-powered code modifications.

## Features
- **Mini-IDE UI**: File tree, CodeMirror editor, and sidebar panels.
- **Repomix Integration**: Configure and trigger Repomix context generation and code modifications from the UI.
- **Live File Tree**: Auto-refreshes to reflect Repomix and git changes.
- **Git Integration**: Version control operations from the frontend.
- **Configurable Repomix Options**: User can override Repomix config for each run (optional; defaults provided).

## Getting Started

1. `cd frontend`
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```
4. The app will open at [http://localhost:3000](http://localhost:3000)

## Configuration
- Repomix config is editable in the UI (see the Repomix Config panel).
- If not changed, backend defaults are used.

## Project Structure
- `src/` — Main source code
- `src/App.tsx` — Main app component
- `src/repomixConfigSchema.ts` — Repomix config types and defaults

## Requirements
- Node.js >= 16
- Backend server running (see backend/README.md)

## Notes
- Ensure backend is running for all features to work.
- For advanced Repomix or git features, see backend documentation.
