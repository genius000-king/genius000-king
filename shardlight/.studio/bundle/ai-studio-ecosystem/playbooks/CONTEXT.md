# Context and resumption

## What can actually be controlled

Use the host's documented context compaction, handoff, fresh-agent and resume features when available. A prompt cannot resize a model's context window or restore information that was never persisted. If the host exposes no token usage, use task-boundary checkpoints and keep context concise; do not invent remaining-token percentages.

## Canonical project memory

| Location | Contents |
| --- | --- |
| `.studio/IDEA.md` | Verbatim user idea, read in full during discovery. |
| `.studio/state.json` | Current requirements, tasks, decisions and recorded costs; one coordinator writes it. |
| `.studio/history/` | State snapshots from helper saves. |
| `.studio/docs/` | Brief, architecture/creative direction, contracts, risks and detailed decisions. |
| `.studio/CAPABILITIES.md` | Observed host capabilities and missing tools. |
| `.studio/receipts/<task>/` | Worker output summaries and attempted approaches. |
| `.studio/evidence/` | Stable logs, captures and verification records. |
| `.studio/checkpoints/` | Context handoffs and exact continuation actions. |

Large binaries and logs stay on disk; provide paths and short findings. Retrieve relevant portions as needed. Include content versions so a summary does not accidentally describe an old artifact.

## Worker context

Give a worker its task, associated requirements, interface contracts, reference media, writable scope, budget, previous failed approaches and required receipt format. Include dependency artifacts and the exact versions to consume. Do not give the whole unrelated project history.

At a meaningful milestone or before context turnover, record verified work, remaining failures, current files/revisions, uncommitted changes, previous attempts and the next action. Save the record before terminating or replacing the worker.

## Coordinator context

Use `studio.py context` for an overview, then retrieve the relevant detailed records. Review pending requirements rather than reconstructing intent from the latest chat message. Preserve new user steering without discarding earlier authorized scope.

Before compaction or ending a session, write a handoff using `templates/handoff.md` and run `studio.py checkpoint`. This creates `.studio/RESUME_PROMPT.txt` and durable checkpoint files. Use the host's actual continuation mechanism if available; the helper does not schedule it.

## Recovering from interruption

1. Read entry instructions, the complete idea, current state, capabilities and latest checkpoint.
2. Confirm project/branch/workspace identity and current artifact versions.
3. Check which workers/processes are still alive before relaunching anything.
4. Validate accepted evidence and reproduce the necessary baseline check.
5. Preserve uncommitted work; inspect it before deciding whether to integrate, repair or replace it.
6. Reconcile recorded cost with actual provider/tool reports if available.
7. Continue the next task without replaying completed external actions.

A stale `coordinator.lock` can remain after the helper is killed. Inspect the recorded process and actual host state before removing that lock. Never remove a live owner's lock merely to force a save. `state.json` is authoritative; history snapshots may include a candidate written immediately before an interrupted state replacement.
