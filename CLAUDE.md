# Hub

Private dashboard + runtime for sites, bots and tools inside one Vercel project.
Design and rationale: `docs/ARCHITECTURE.md`. Read it before adding a feature.

## Commands

`npm run dev` · `build` · `lint` · `typecheck` · `test` (Node's built-in runner, `lib/**/*.test.ts`).
Next 16 (App Router, `proxy.ts` not `middleware.ts`), React 19, TypeScript strict, Tailwind v4, Node >= 22.
Next's bundled docs live in `node_modules/next/dist/docs/`. Prefer them over memory for Next 16 APIs.

## Rules

- **Design:** dark only, monochrome, Vercel-like. Use the tokens in `app/globals.css` (`bg-surface`, `border-line`,
  `text-muted`…). No gradients, no accent colors. `ok` / `warn` / `err` are for tiny status dots and labels only.
- **Security:** the gate in `proxy.ts` is fail closed. Only `/api/health` is public. A new public route (bot
  webhook) must verify the platform signature in the same change, be added to `isPublicPath` in `lib/auth.ts`,
  and have a test. Data-touching handlers verify the caller themselves too.
- **Secrets** live in env vars or server code only. Never in the client bundle, never in logs.
- **Bots are webhook-only.** Vercel has no long-lived processes. Long-running or native work goes to an
  external runner (see architecture doc).
- **Verify UI changes** at 1280px and 390px, and measure horizontal overflow, before calling them done.
- `README.md` at the repo root is the GitHub profile README. Do not use it for project docs.
