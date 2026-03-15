# Hex Works

Online hex editor for binary files (EEPROM dumps, firmware, etc). Two versions live in this repo:

## Architecture

### Legacy app (Angular)
- **Framework:** AngularJS 1.4.5
- **Source:** `src/` (JS) + `views/` (HTML, CSS, static assets)
- **Entry point:** `src/index.js` → `views/index.html`
- **Rendering:** Custom canvas-based hex view (`src/hexview.js`)
- **State:** Angular scopes, `localforage` for persistence via IndexedDB

### Beta app (React)
- **Framework:** React 19 + Expo 54 + TypeScript
- **Source:** `beta/src/` (components, hooks, contexts, utils)
- **Entry point:** `beta/index.ts` → `beta/App.tsx`
- **State:** Zustand store (`beta/src/contexts/hex-editor-store.ts`)
- **Rendering:** Canvas-based hex view (ported from Angular)
- **Package manager:** pnpm

### Shared persistence format
Both apps use the same IndexedDB storage (localforage-compatible):
- DB: `localforage`, store: `keyvaluepairs`
- `tabnames` key → array of UUIDs
- Each tab stored as `{ name, colors: Uint8Array, data: hexString, uuid }`
- Colors are a `Uint8Array` parallel to the data buffer (0=none, 1=red, 2=teal, 3=yellow, 4=blue, 5=purple, 6=brown, 7=grey)

## Build & Dev

### Legacy app
```bash
npm install
npm run dist          # copy views + webpack production build → dist/
npm run dev           # webpack-dev-server on port 8000
npm run build         # webpack production build only
```

### Beta app
```bash
cd beta
pnpm install
pnpm run web          # Expo dev server
pnpm run export:web   # Static export → beta/dist/
```

### Full build (both apps)
`npm run dist` builds the legacy app to `dist/` and copies `beta/dist/` into `dist/beta/` via `copy-webpack-plugin`. The beta HTML is transformed at copy time to fix absolute asset paths (`/_expo/` → `_expo/`) and inject Google Analytics.

## Deployment
- **CI:** GitHub Actions (`.github/workflows/static.yml`)
- **Host:** GitHub Pages from `dist/`
- Pushes to `master` trigger: `npm ci && npm run dist` → build beta with pnpm → copy beta into `dist/beta/` → deploy
- Legacy app served at root, beta at `/beta/`

## Key files
- `webpack.config.js` — Webpack 5 config, includes copy-webpack-plugin for views + beta
- `gulpfile.js` — Legacy, no longer used in build pipeline
- `src/binbuf.js` — Angular binary buffer (BinBuf)
- `beta/src/utils/binbuf.ts` — React binary buffer (BinaryBuffer), port of BinBuf
- `beta/src/utils/persistence.ts` — IndexedDB read/write, backward-compatible with Angular's localforage format
- `beta/src/components/hex-view/hex-view.tsx` — Canvas hex renderer (React)
- `beta/src/contexts/hex-editor-store.ts` — Zustand store with tab, selection, color, master-tab state

## Notes
- The beta banner in `views/index.html` shows on every page load (not persisted)
- "Apply colorset to all tabs" feature: `masterTabId` in the store designates a tab whose color buffer is used for rendering/editing across all tabs
- Google Analytics (G-J99PMLML6S) is in both apps — legacy via `<head>` tag, beta injected at build time
- Legacy app functionality is fixed, and should no be changed anymore.
