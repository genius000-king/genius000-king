# Execution loop

## Establish a verifiable target

Read the full idea and write the explicit requirements. Select the relevant profile and a concrete reference/rubric. Identify what the current run can verify. Design the first complete user journey, playable sequence or finished shot so that it tests the hard interfaces early.

Preserve full scope while scheduling milestones. Treat unrequested expansions as optional proposals. Record technical/creative decisions with alternatives, observed evidence and consequences.

## Prepare the next batch

Keep enough well-defined work ready for available workers. Each task has an outcome, requirement IDs, dependencies, writable paths, acceptance criteria, input versions, tools, limits and deliverables. Use `templates/task-contract.json` with the local helper; the older YAML templates provide additional planning fields.

The coordinator may use `bin/studio.py context --project ... --task T-001` to create a compact context pack. Add the selected role/profile and relevant source/reference paths. Avoid copying all transcripts into every context.

Only start dependent tasks after dependencies are accepted, or explicitly split a preliminary task that can proceed on a stable interface without that dependency. Do not pretend a dependency passed to unlock a task.

## Delegate and build

Use actual host agent tools with isolated workspaces or assigned non-overlapping files. Workers save artifacts and a receipt under `.studio/receipts/<task-id>/`. The coordinator saves shared state; workers never mutate it.

There is no mandatory percentage of work the coordinator must perform. Keep it available for cross-project decisions, integration and scheduling. Use specialists for difficult coherent problems, not decorative role names.

Check progress from observed artifacts and changes. If a worker is stuck, identify missing information/tools, invalid assumptions or a badly sized task. After repeated unsuccessful attempts, change the approach or report a bounded blocker while continuing useful independent work.

## Review and accept

Use `roles/reviewer.md`. Record each criterion's observed result and the exact reviewed submission. Test the combined candidate under `roles/integrator.md`. Save evidence as stable files and hash it with the helper's `evidence` command.

An accepted task records `submission.revision`, `review.target_revision`, passing criterion IDs, reviewer identity/independence, `integration.revision`, and evidence linked to that integration revision. These may be Git revisions or explicit immutable artifact versions.

The helper checks recorded consistency and file hashes. It cannot prove that a reviewer ran an experiment or that a clip looks good. The coordinator is responsible for actual tool-backed verification.

If native delegation is unavailable, document that limitation. A task requiring independent review must stay unverified until it receives it. If independent review is not part of a task's required gate, explicitly set `requires_independent_review: false`, report self-review honestly, and do not describe it as independent. Never relax a user-required gate solely to finish.

## Continue without unnecessary interaction

After acceptance, schedule the next valuable work. Send concise updates when meaningful or required by the host. Do not stop at planning, a checklist, a screenshot, or the first draft when the user requested a finished artifact and useful authorized work remains.

At the end of a funded milestone, reassess scope and remaining budget. Continue through further in-scope milestones if authorization and capacity remain. When optional improvements stop producing meaningful value, direct effort to remaining required outcomes and delivery.

## Stop conditions

Stop or checkpoint when the requested scope is verified, a real deadline/resource cap is reached, the host cannot continue, or a necessary external decision/access is unavailable. Preserve the best verified candidate and describe remaining work precisely. Never fill unknown evidence with invented passes.
