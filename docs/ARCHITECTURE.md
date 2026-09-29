# Hub — architecture

One private dashboard, deployed as a single Vercel project, that manages and runs **sites**, **bots** and **tools**
(any library or service, in any language). No VPS: compute goes to the cheapest runner that can actually do the job.

## Principles

1. **Control plane vs. runners.** The dashboard (Next.js + a database) only knows *what* exists and *where* it runs.
   The work itself is done by a runner chosen per tool.
2. **Logical isolation, not containers.** Every project is a row with its own config, secrets, quota and logs,
   all keyed by `project_id`. Failure isolation is weak by design (one deployment), so quotas and per-project
   limits come first, not later.
3. **Fail closed.** Nothing is reachable without the admin password except `/api/health`.
4. **Honest about Vercel.** There are no long-lived processes and no local disk. Anything that needs one is not
   run on Vercel; it is registered here and run elsewhere.

## Project kinds

| Kind | What it is | Runs where |
|---|---|---|
| **site** | Rendered from the database by one multi-tenant app, routed by the `Host` header. New site = new row + domain, no deploy. | Vercel |
| **bot** | Webhook-driven only (Telegram, Discord Interactions, WhatsApp Cloud API…). | Vercel |
| **tool** | Any library / service, called as `run(toolId, input)`. | Picked by the runner table below |

Bots that need a persistent connection (Discord Gateway, unofficial WhatsApp clients, long polling) cannot run on
Vercel. They need a real always-on machine.

## Where a tool runs (capability filter)

Ask four questions about the library: how long does it take, does it need a native binary or C extension,
does it need a persistent connection, does customer data pass through it?

| The tool needs | Runner |
|---|---|
| Pure computation, seconds, no binaries | `inline`: JS / WASM inside the function |
| Python libraries, seconds | `python`: Vercel Python function |
| Heavy work you trigger yourself | `device`: your own browser or machine (WASM) |
| Minutes to hours, any language, not instant | `external`: a Docker service (e.g. a Hugging Face Space) called over HTTP, async with a callback |
| Persistent connection, open ports, state | `device`: an always-on box (old phone with Termux, free-tier VM) |

The router stores a definition per tool (`id`, `runner`, `entry`, `inputSchema`, `timeout`) and a `Job`
(status, output, logs) per run. Async runners return a job id and deliver the result by callback.

Build order: `inline` and `python` first. Add the others only when a real tool does not fit.

### Example: LiteLLM

LiteLLM is a long-running FastAPI proxy with a large dependency tree. It will almost certainly not fit a
serverless function bundle. It is an `external` tool: run it as a container elsewhere; the hub stores its
endpoint and key, and proxies and monitors it.

## Security notes

- Admin gate is HTTP Basic in `proxy.ts` (constant-time compare, fail closed). Replace with a real login + 2FA
  before this holds anything sensitive. `proxy.ts` is the first gate, not the only one: data-touching route
  handlers and server actions must verify the caller again.
- Webhook routes must be public and therefore must verify the platform's signature themselves
  (Telegram `secret_token`, Discord Ed25519). Add the path to `isPublicPath` in the same change, with a test.
- Bot tokens and API keys are stored encrypted and only ever used server-side. Never log them.
- Running code submitted by other people (customers) is a separate, much riskier product. Out of scope until
  there is a sandbox story (e.g. QuickJS in WASM with an injected, minimal API).

## Constraints to re-check before relying on them

Free-tier limits change. Verify the current terms before building on them:

- Vercel Hobby: non-commercial use only, function duration / bundle size caps, very limited cron.
- GitHub Actions as a general compute backend: its terms restrict serverless-style use. Treat it as personal
  batch work, never as a service for customers.
- Any external runner is a third party that sees the data sent to it. Mark tools that receive sensitive data.

## Roadmap

1. **Now:** scaffold, dark monochrome UI, fail-closed gate. *(this commit)*
2. Database + project registry (which one is open: Supabase Postgres is the default candidate).
3. First vertical slice: register a Telegram bot (paste token → webhook set up automatically → logs).
4. `inline` and `python` runners + `run()` API.
5. Sites from the database + domain routing.
6. `external` runner (LiteLLM as the first real case).
