# Quality, decomposition, and cost protocol

These are proposed operating rules for this skill. Numerical defaults are starting heuristics to calibrate on the actual project, not experimentally proven universal settings.

## Discovery that leads to action

Start with five decisions: who uses the product, what important job it performs, what makes it preferable, which platforms it targets, and what this run must deliver. Reuse answers already given. With only an idea, draft provisional answers and proceed on reversible work.

Produce a concise initial brief, a full-vision capability map, and a milestone-specific requirement register. Separate:

| Category | Treatment |
| --- | --- |
| Explicit requirement | Preserve and trace to acceptance evidence. |
| Necessary implementation detail | Resolve through engineering judgment and record consequential choices. |
| Missing preference | Choose a reversible default, label it, and invite correction when useful. |
| Proposed expansion | Record separately; do not inflate required scope. |
| Unresolved risk | Design an experiment with a decision it will enable. |

Compare major options with a short decision record: alternatives, required capabilities, version and license, maintenance evidence, interoperability, target-device behavior, migration cost, experiment result, and reason selected. Do not rank libraries solely by popularity or model familiarity.

Use risk experiments before large commitments. Examples: a representative GPU workload, large document save/recovery, multilingual text shaping, a character animation import, controller input latency, or concurrent multiplayer state updates. Experiments need a result and a decision, not a production architecture for their own sake.

## Detail coverage

For each critical interactive component, inspect these dimensions where applicable:

| Dimension | Examples |
| --- | --- |
| States | Idle, hover, focus, pressed, selected, disabled, busy, success, error. |
| Input | Pointer, keyboard, controller, stylus, touch, alternative input. |
| Transitions | Rapid repeats, cancellation, interruption, undo, retry, focus restoration. |
| Data | Empty, normal, large, malformed, stale, offline, partially saved. |
| Presentation | Theme, scaling, localization, right-to-left text, reduced motion. |
| Accessibility | Name, role, focus visibility, contrast, reading order, non-color cues. |
| Performance | Interaction latency, frame time, memory, storage and network cost. |
| Recovery | Failure message, retained work, restart behavior, rollback. |

These become acceptance criteria within a coherent component or user journey. Do not create a separate agent for every matrix cell. Do not test the complete Cartesian product blindly: cover critical combinations explicitly, use representative combinations for the rest, and record exclusions.

A shared design system should supply consistent reusable behavior. A designer or design owner maintains global visual direction so many independently built components still belong to one product.

## Decomposition audit

Before dispatching a batch, ask:

1. Can every mandatory requirement be traced to a task and a verifier?
2. Are any tasks duplicating the same decision or modifying the same interface?
3. Can the worker make substantial progress without constant coordination?
4. Is the expected artifact independently inspectable?
5. Are dependencies real, versioned, and available?
6. Does the package fit a useful work session, with a meaningful checkpoint if it takes longer?
7. Does the worker have tools and representative data to judge its result?

If two tasks continually block one another, combine them or stabilize their interface. If a task spans unrelated outcomes, split it. Work size follows coupling and uncertainty; it does not follow UI element count.

Prioritize the critical path, high uncertainty, foundational interfaces, and high-value user outcomes. Avoid scheduling only easy tasks while the most important problem remains untouched.

## A useful twenty-slot roster

This example illustrates allocation, not a quota or a guarantee that a host provides twenty agents.

| Role | Maximum illustrative slots | Activation condition |
| --- | ---: | --- |
| Coordinator | 1 | Owns scope, priorities and cross-project decisions. |
| Architecture/domain leads | 2 | Independent design risks justify separate investigation. |
| Subsystem builders | 8 | Eight ready, independently writable work packages exist. |
| Visual/asset/audio specialists | 4 | Tools, references and asset contracts are available. |
| Verification/performance specialists | 3 | There are artifacts to inspect or workloads to measure. |
| Integration/release | 1 | The automated integration lane needs investigation or action. |
| Independent challenger | 1 | A consequential decision benefits from a second proposal. |

The coordinator, leads, reviewers and nested agents all count toward the same limit. Unused slots remain unused. For a small slice, combine responsibilities across time while keeping substantive authoring and acceptance review separate.

## Acceptance gates

Use independent gates, not a single average score that allows attractive visuals to compensate for data loss.

| Gate | Evidence |
| --- | --- |
| Functional correctness | User journeys, invariants, meaningful tests with observed results. |
| Data integrity and recovery | Round trips, interruption handling, migration/recovery checks where relevant. |
| Integration | Exact combined revision, reproducible build, cross-module scenarios. |
| Performance | Target device, workload, build flags, sample method, distributions and baseline. |
| Visual/interaction quality | Inspected renders or recordings against a fixed reference rubric. |
| Audio quality | Listening with supported tools or human review, plus appropriate signal measurements. |
| Accessibility/compatibility | Checks on specified input methods and platforms. |
| Delivery | Launch/install instructions, packaged artifact, known limitations. |

For performance, establish the benchmark before optimizing. Record warm/cold state, representative input sizes, number of runs, variability, and the bottleneck. Report percentile timings rather than only averages. CPU, GPU and I/O work may overlap; measure the actual critical path.

Visual judgment needs reference images, composition goals, contrast/readability criteria, motion examples, and a stable review method. Audio judgment needs reference clips, intended mix context, transition examples, and listening capability. Numerical signal checks cannot establish artistic quality. User-calibrated examples help evaluators but do not make aesthetic scores objective.

Keep a small acceptance set independent of the worker's implementation choices. For high-impact algorithms, use differential checks against a trusted implementation, properties, representative regressions, or held-out cases. Change a faulty oracle transparently; never reward a worker for bypassing it.

## Controlled improvement

A proposal states: "Observed defect X matters for user outcome Y; change Z should improve metric or rubric item M without regressing N."

For a consequential architecture choice, commission at most a small number of genuinely different proposals at first. Give them the same workload and budget. Compare runnable evidence, complexity, and maintenance implications. More debate is useful only if it can change the decision.

For refinement, keep the best verified candidate. Stop or redirect when:

- Mandatory criteria are satisfied and no funded refinement remains.
- Consecutive attempts repeat the same failure without new evidence.
- Improvement falls below the project's declared meaningful threshold.
- The deadline or remaining budget requires preserving the current result.
- An unavailable capability prevents valid evaluation.

Maintain a failure register: attempted change, observed result, likely reason, and condition under which retrying would be sensible. Prompt changes or changes to the studio workflow should be versioned and evaluated on representative tasks before broad adoption.

## Cost accounting

For each provider/model, count uncached input, cache reads, cache writes if billed separately, and output using that provider's actual billing rules. Reasoning tokens may already be part of billed output; avoid double counting.

```text
model_cost = sum_over_requests(
    uncached_input_tokens * input_price_per_million / 1_000_000
  + cache_read_tokens     * cache_read_price_per_million / 1_000_000
  + cache_write_tokens    * cache_write_price_per_million / 1_000_000
  + billed_output_tokens  * output_price_per_million / 1_000_000
)

total_run_cost = model_cost + separately_billed_tools
               + compute + GPU + storage + network + purchased_assets

admissible_new_work = authorized_cap - actual_cost
                    - outstanding_reservations - protected_verification_reserve
```

Use cache categories according to the provider; some categories are included in others. Track pricing source, currency, tax treatment if relevant, and verification date. Subscription seats and usage limits are a different accounting model from API token billing. Do not infer API credit from a subscription.

Arithmetic illustration only: twenty workers each consume 100,000 uncached input tokens and 20,000 output tokens in one round. At hypothetical prices of $5 per million input and $25 per million output, the round costs $20. One hundred identical rounds cost $2,000 before the coordinator, reviewers, retries, tools, or compute. These numbers are not a quote or an expected project cost.

Spend on the bottleneck. A stronger model that solves a difficult issue once can be cheaper than repeated weak attempts. Reuse immutable context prefixes when supported, retrieve relevant files, summarize tool output, and cache builds/assets. Do not sacrifice necessary verification to reduce token use.

Example initial budget allocation: 10% discovery and risk experiments, 50% construction, 25% independent verification/integration, and 15% recovery/refinement. Change it when the task justifies a different mix; do not present it as optimal.

Measure cost per accepted comparable user outcome, rework rate, integration delay, escaped defects, and elapsed time. Evaluate one capable worker against a small team on representative tasks before committing to a larger pool. Keep acceptance standards and workloads comparable so tiny task splitting cannot inflate apparent productivity.

## Making the resulting product free

Development cost and operating cost are separate. Forecast storage, bandwidth, server work, paid inference, asset distribution, maintenance and support per active user. Free distribution does not eliminate these costs.

Where compatible with the product, consider local execution, local models, optional user-supplied API credentials, quotas, sponsorship, donations, or paid hosted services. Select the model around the desired user experience. Track licenses and provenance for dependencies and distributed assets as normal release inputs.
