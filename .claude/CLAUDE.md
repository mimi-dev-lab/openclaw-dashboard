# openclaw-dashboard — Coding Rules

## Stack
- Next.js 16 (App Router, static export) + TypeScript
- Tailwind CSS + shadcn/ui + Radix UI
- Zustand for state management
- Recharts for charts
- react-markdown for rendering
- pnpm

## Coding Rules
- Pages: `src/app/*/page.tsx`
- Components: `src/components/`
- Stores: `src/stores/*.ts` (zustand)
- Icons: lucide-react only — no emoji in UI code
- Styling: Tailwind + `cn()` utility
- No server-side API routes — all data from OpenClaw Gateway API

## Commands
- Dev: `pnpm dev` (+ `node proxy-server.js` for API proxy)
- Build: `pnpm build` (outputs to `out/`)
- Lint: `pnpm lint`
- Docker: `docker build -t openclaw-dashboard . && docker run -p 3000:80 openclaw-dashboard`

## Deployment
- Docker (local Mac Air), port 3000
- nginx:alpine serving static export from `out/`

## Known Pitfalls
- Static export: no server-side features, everything client-side
- proxy-server.js needed for local dev CORS
- channel-labels.json maps Discord channel IDs to names

## Commits
- Follow conventional commits format
