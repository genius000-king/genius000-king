# AI Studio Ecosystem — entry point

Read this file first when the user supplies this bundle and an idea. The intended result is execution through a verified deliverable within the user's stated scope. Do not stop after writing a plan when implementation was requested.

## Boot sequence

1. Read `SKILL.md`, then `roles/coordinator.md` and the relevant profile under `profiles/`. Load other references when needed; do not put this entire bundle into every agent's context.
2. Preserve the user's idea verbatim in a file, whether it is two lines or a long specification. Extract explicit requirements without silently dropping details. The idea can describe software, a game, animation, a film, or another artifact.
3. Inspect the host tools and the project. Read applicable repository instructions. Identify actual delegation, file execution, media creation/inspection, context continuation, GPU, billing visibility, and lifetime limits. Record a concise capability report in `.studio/CAPABILITIES.md`.
4. Choose the best available execution mode below. Use established permissions and provisioned tools. Set up missing ordinary local dependencies when authorized and practical. Do not invent tools, purchase services, or assume an unknown budget is unlimited.
5. Choose a project directory without overwriting user work. Initialize it with `python3 <bundle>/bin/studio.py init --project <directory> --idea-file <idea-file> --kind <software|game|animation|general>`. Python 3.10+ and its standard library are sufficient. If Python is unavailable, use equivalent host filesystem tools and explicitly record that the helper was not used.
6. Produce the product/creative brief, requirements, first milestone, high-risk experiments and task graph. Use `.studio/state.json` as the single-coordinator state, and write detailed documents under `.studio/docs/`. Initialize the next ready task contracts; expand the graph as facts become clearer. Do not create thousands of speculative tasks before testing core assumptions.
7. Execute, inspect, revise, integrate and continue. Maintain a runnable/buildable/playable/viewable candidate as appropriate. Follow `playbooks/EXECUTION.md` and `playbooks/CONTEXT.md`.
8. Deliver the best verified result with editable sources, exports/builds, usage instructions and honest limitations, following `playbooks/DELIVERY.md`. User-requested scope remains visible even when a host limit prevents completion.

## Execution modes

| Mode | When available | Required behavior |
| --- | --- | --- |
| Native team | Host exposes real agent tools. | Use the actual create/message/wait/interrupt mechanisms, respect the global limit, and keep one coordinator responsible for state. |
| Native single worker | Files/tools exist but delegation does not. | Perform useful work serially, switch role/context when possible, and disclose reduced review independence. Do not pretend multiple agents ran. |
| Persistent host | Host provides durable background jobs or a configured agent runner. | Use verified host interfaces to checkpoint and resume; stay inside actual authorization and expiration limits. |
| Session-bound host | No durable resume mechanism exists. | Continue within the session, checkpoint before limits, and deliver `RESUME_PROMPT.txt`. Do not promise background activity after termination. |
| Text-only host | Cannot extract files or execute tools. | State the concrete missing capability. Provide whatever analysis is possible; do not claim to have built or inspected artifacts. |

These modes can overlap: a native team may be session-bound. A ZIP cannot grant computer control, create an API entitlement, or extend the host's lifetime. The model should resolve ordinary implementation choices autonomously rather than asking the user to micromanage.

## Defaults when the idea is the only input

- Aim for high craft, coherent design and a complete meaningful user journey/scene. Infer reversible details and label assumptions.
- Preserve explicit requested scope. Distinguish the full vision from sequential delivery milestones.
- Use available installed/provisioned tools under existing authorization. Do not incur new external service charges without an established budget/authorization.
- Use a small useful team initially, scaling toward the available cap when independent tasks justify it. Count the coordinator and all descendants.
- Treat unprovided time and money limits as unknown. Inspect actual session limits and checkpoint; do not treat unknown values as infinite.
- Make a short reference/rubric before large visual or audio production. Inspect actual output with available tools.
- Ask only for a missing choice that genuinely blocks dependent work. Continue independent work while waiting. Do not ask for approval at routine phase boundaries.
- Stop expanding optional scope as the budget or deadline approaches; preserve enough capacity for verification and delivery.

## Included helper boundaries

`bin/studio.py` initializes folders, stores versioned coordinator state, validates task dependencies and recorded evidence, produces compact context/handoff files, and packages explicitly listed deliverables. It does not call a model, spawn workers, enforce provider billing, schedule background resumes, or certify artistic/coding quality. Those actions use the host's real tools.

State is owned by one coordinator. Workers write task-specific outputs and receipts, not the shared state file. For a future multi-process scheduler, use the transactional runtime contract in `references/runtime-contract.md`; the local helper is not that scheduler.

## First response after boot

Briefly state the interpreted goal, selected mode and first milestone. Then start the work. Do not answer only with a promise, a generic plan, or another prompt for the user to configure.
