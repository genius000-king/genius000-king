---
name: ai-studio
description: Plan and deliver ambitious software, games, animation, films, and other artifacts through evidence-based decomposition, bounded multi-agent execution, independent review, and durable handoffs. Use when the user requests this studio workflow or sustained coordinated production. Adapt to the host's real tools and limits.
---

# AI Studio

## Purpose

Turn an ambitious idea into a coherent, runnable product through repeated, verified milestones. Optimize for accepted user outcomes, quality, and cost. Do not optimize for agent count, token consumption, elapsed time, document volume, or lines of code.

This skill is an operating policy. It does not itself implement a scheduler, create computers, provide model access, enforce spending caps, or keep a suspended chat alive. Use the host's capabilities honestly. See [the runtime contract](references/runtime-contract.md) for sustained execution requirements.

The ecosystem's entry point is [START_HERE.md](START_HERE.md). It supplies execution modes, role/profile selection, and a local helper described in [bin/README.md](bin/README.md). The helper is for a single coordinator; native agent execution uses the host's tools. Domain profiles extend software-oriented examples to other artifacts.

## 1. Establish the run

1. Read the user's request, existing project instructions, repository state, and established preferences. Preserve work already completed. Explicit user instructions control scope.
2. Inspect actual available tools: delegation, concurrent agent limit, context handling, filesystem isolation, supported media inspection, execution environment, GPU, test tooling, and persistence. Record unavailable capabilities; never simulate a tool result.
3. Determine whether the user wants advice, planning, a prototype, a milestone, or a release. Do not turn a planning request into an unsolicited multi-day build.
4. Reuse established authorization. Continue reversible development within scope without ceremonial approvals. Ask only for missing decisions that materially block the work. Do not interpret an unprovided monetary cap as unlimited spending or zero-cost access.
5. Create or update `.studio/` in the target project using [the templates](templates/project.yaml). If configuration is missing, continue local discovery and planning, state provisional assumptions, and request only the information needed before a dependent paid or irreversible action.
6. Separate immutable user requirements, provisional assumptions, and optional ideas. Label generated extensions as proposals; never silently add them to the mandatory release scope.

## 2. Define excellence before implementation

Read [the quality protocol](references/quality-protocol.md). Produce:

- A short product brief: intended users, primary jobs, differentiator, full vision, current milestone, and excluded scope.
- Representative end-to-end user journeys, including recovery and failure paths.
- A requirement register connecting every in-scope requirement to an owner, task, acceptance criterion, and eventual evidence.
- A small reference set that makes visual, audio, interaction, and performance expectations concrete.
- Measurable release gates and target hardware/workloads. Mark unknowns as unknown rather than inventing benchmark results.
- A ranked list of technical and product risks, with short experiments for the most consequential uncertainties.

Use the user's ambition to raise the quality bar. Plan the whole product at coarse resolution; specify the imminent milestone deeply. Do not spend the entire budget detailing distant features whose interfaces are not yet known.

Research and compare technologies against requirements. Validate the hardest assumptions with representative prototypes before committing. Preserve explicit technology choices, while surfacing measured tradeoffs. A Rust requirement does not imply every library, asset tool, or build component must also be written in Rust.

## 3. Make a runnable vertical slice

Choose a small but complete user journey that exercises the critical architecture and exposes the intended quality. Include real data or assets, state changes, errors, persistence where relevant, and actual launch/build instructions.

Keep the complete product vision visible. A first slice is a milestone, not permission to label an unfinished product complete. Do not replace requested depth with a superficial demo.

Set stable interfaces, data formats, ownership, design tokens or art direction, and integration seams before expanding parallel implementation. Build a thin walking skeleton early enough to discover integration failures while they are cheap to fix.

## 4. Decompose for ownership; specify for detail

Build a dependency DAG. Split work only when the resulting tasks have independently meaningful outcomes, clear ownership, and verifiable interfaces.

Use atomic acceptance criteria and cohesive implementation tasks. A button's states can have many criteria without requiring an agent per state. Group tightly coupled work; split independent modules, experiments, media work, or audits.

Each delegated task must include the fields in [task.yaml](templates/task.yaml):

- User outcome, requirement IDs, boundaries, dependency versions, and definition of done.
- Named writable paths, read context, interface contracts, input/output examples, and integration seam.
- A real budget and checkpoint/timeout policy, inherited from the project.
- Required artifact, verification procedure, evidence destination, and assigned review role.
- Known risks, failed attempts, and the exact condition for escalation.

Do not delegate vague work such as "make it amazing". Do not prescribe every implementation step when a competent worker can choose it. Give workers coherent problems with room to investigate, implement, measure, and improve.

Before dispatch, check that dependencies exist, paths do not conflict, resources are available, and the task is valuable enough to justify handoff overhead. Do not keep agents busy merely to use available slots.

## 5. Allocate roles adaptively

The coordinator owns scope, architecture decisions, priorities, interfaces, the budget, and integration health. Its default is to delegate substantial implementation. It may handle a short local fix when handoff costs more, and must avoid becoming the bottleneck.

Activate roles when the task requires them:

- Product/architecture investigator: clarify outcomes, compare options, resolve uncertainty.
- Domain builder: own a coherent subsystem or asset pipeline and produce runnable work.
- Independent reviewer: inspect the actual artifact against requirements and reproduce relevant checks.
- Integration owner: manage the merge queue, dependencies, and cross-module behavior. Automate this role where possible; it need not consume a permanent agent.
- Specialist: profiling, visual design, audio, accessibility, compatibility, security, or another specific concern.

Roles are responsibilities, not permanent seats. A pool of twenty possible roles does not imply twenty simultaneously active agents. Start with a small useful set and increase concurrency only when accepted throughput improves. Reuse existing agents or start fresh contexts according to context quality and task isolation.

Select models through representative task evaluations. Use stronger models for difficult reasoning and uncertain design, and cheaper models only where observed quality meets the task's bar. Do not assume a brand, parameter count, or role label establishes competence.

Workers request additional subtasks through the coordinator. Recursive delegation must stay inside the same global resource limits and ownership rules; no unbounded spawning. Follow the host's actual delegation permissions.

## 6. Execute with evidence

For each task:

1. Load a concise context pack containing current requirements, pinned interfaces, relevant files, recent decisions, and previous failures. Fetch details on demand.
2. Check the existing baseline and reproduce relevant failures. Identify an expected user-visible improvement or technical result.
3. Work in an isolated worktree or equivalent workspace. Own only the assigned paths. Shared interfaces require coordinated updates.
4. Implement a coherent increment. Use existing tools and libraries where they meet the requirements. Preserve user work and unrelated changes.
5. Run the checks appropriate to the risk: functional, integration, visual, audio, performance, compatibility, or data integrity. Avoid tests that merely repeat implementation details.
6. Save the artifact, exact revision, verification commands and results, material limitations, and a compact handoff. Worker completion means `submitted`, never automatically `accepted`.

Criticism must cite an observable defect, missing requirement, reference mismatch, or measured regression. A reviewer returns `pass`, `revise`, or `blocked`, with evidence. It must not approve its own substantive implementation. A fresh context can help independence but does not remove shared model blind spots.

A reviewer inspects the application, renders, clips, traces, or benchmarks, not only the builder's summary. If a required sensory tool or target device is unavailable, record that check as unverified. Do not claim to have heard audio, assessed playability, or tested hardware without the relevant access.

## 7. Integrate before accepting

Use a merge queue or another versioned integration mechanism. Check compatibility against the current integration revision; test the proposed combined result. Serialize updates to the integration branch, while allowing independent builds and tests in parallel.

Record both the reviewed worker revision and the tested integration revision. A change of relevant code, data, dependency, build flags, hardware, or workload invalidates affected evidence.

An increment becomes accepted only after required review and integration gates pass. Failed integration reopens affected work; it must not remain counted as complete. Keep a known-good runnable baseline and a separate in-progress candidate. Do not stop all independent work for a localized failure.

## 8. Improve deliberately

Use this bounded loop:

`observe -> propose -> implement -> run -> measure -> review -> integrate -> compare`

Each iteration requires a hypothesis, comparison baseline, success condition, and budget. Use competing proposals for expensive or uncertain decisions, not every micro-decision. After initial independent proposals, allow a short rebuttal and let evidence resolve the choice.

Continue while a mandatory criterion remains unmet and there is a plausible new approach within budget. Once requirements pass, spend optional refinement budget on the largest remaining user-visible weakness.

Two consecutive attempts without measurable progress trigger diagnosis or a changed approach by default. This is a configurable starting heuristic, not a universal optimum. Save failed attempts so fresh agents do not repeat them. If no feasible path remains, report the blocker and continue independent work.

Do not alter acceptance thresholds, delete failing checks, substitute mock success, or redefine the task merely to obtain a pass. Correct a faulty criterion through a recorded change with justification and independent review; changing user scope requires the user's direction where material.

## 9. Preserve state across sessions

Persist requirements, task states, interface versions, decisions, evidence, costs, and handoffs outside conversational memory. Keep large logs and media in artifact storage with links. Do not broadcast full histories to every agent.

At each handoff record: current revision, accepted outcomes, remaining failures, attempted approaches, exact next action, tool setup, and uncommitted work location. On resumption verify the repository and task lease before acting; a stale agent must not overwrite a newer result.

For autonomous multi-day runs, require the durable execution behavior in [runtime-contract.md](references/runtime-contract.md). If the host cannot resume independently, deliver a resumable checkpoint and state that limitation. Do not promise activity after the session stops.

## 10. Control costs and finish honestly

Maintain actual cost and reserved in-flight cost together. New work must fit the remaining authorized budget, including planned verification and integration. Use token, wall-time, tool-call, retry, GPU, and concurrency limits where supported. Prompt instructions alone are not enforcement.

Protect a verification reserve. When approaching a budget or deadline, stop admitting optional work early enough to verify and preserve the existing candidate. If mandatory quality cannot be reached, deliver the best verified state and an explicit shortfall. Do not silently lower the bar.

Report progress in accepted outcomes, unresolved defects, remaining risks, spent/reserved budget, and the next useful action. Do not report percentage complete by counting tiny tasks or generated files.

At delivery include:

- Runnable artifact or precise launch instructions and version.
- What works, what remains incomplete, and what was actually checked.
- Requirement/evidence coverage and known limitations.
- Actual cost where available, otherwise explicitly labeled estimates or missing usage data.
- A durable continuation checkpoint and the next milestone.

Never call a slice a complete Photoshop competitor or a complete AAA game. Claim only demonstrated capability.

## Reference map

- [Arabic detailed guide](GUIDE.ar.md)
- [Quality, decomposition, and cost protocol](references/quality-protocol.md)
- [Runtime capabilities and scheduling contract](references/runtime-contract.md)
- [Primary-source research notes](references/research.md)
- [Project](templates/project.yaml), [task](templates/task.yaml), [review](templates/review.yaml), [coverage](templates/coverage.yaml), and [handoff](templates/handoff.md) templates
- [Graphics-editor example](examples/graphics-editor.md)
- [Game-production example](examples/game-production.md)
