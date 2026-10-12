# Primary-source research notes

Reviewed 2026-10-09. These sources inform the design; the operational contracts, thresholds, budget allocations, and templates in this package are proposed engineering choices. The sources do not establish that this skill has been benchmarked or that any agent count guarantees product quality.

## Multi-agent research

[Anthropic: How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system), June 2025.

Reports benefits on decomposable research, along with increased token use and coordination difficulties. Its research results are not evidence of equivalent speedups for tightly coupled software work. This motivates explicit task boundaries and evaluating whether a task actually benefits from parallel execution.

## Work across context windows

[Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents), November 2025.

Describes failures such as premature completion and incomplete handoffs. Its approach uses persisted progress, incremental work, and end-to-end checks. It motivates separating durable project state from conversational memory. The described experiments focus on web applications, so other domains need their own verifiers.

## Generator and evaluator

[Anthropic: Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps), March 2026.

Investigates separate generation and evaluation, concrete design criteria, and structured handoffs. Evaluators still need calibration; separation alone does not guarantee sound judgment. This motivates artifact-based reviews and explicit limitations when required sensory tools are unavailable.

## Long-running coding teams

[Cursor: Scaling long-running autonomous coding](https://cursor.com/blog/scaling-agents), January 2026.

Describes coordination failures in a flat team and experiments with separate planning and execution. It also reports that an integrator role became a bottleneck in its setting. Accordingly, this package treats integration as an accountable, automatable function; it does not require a permanently occupied manager agent for every role.

## Agent-readable development environments

[OpenAI: Harness engineering](https://openai.com/index/harness-engineering/), February 2026.

Describes an internal product effort emphasizing development environments, repository knowledge, and feedback mechanisms. It motivates making requirements, diagnostics, and verification accessible to agents. This is an engineering case study, not a general estimate of what a solo developer can finish in several days.

## A large concrete experiment

[Anthropic: Building a C compiler with a team of parallel Claudes](https://www.anthropic.com/engineering/building-c-compiler), February 2026.

Reports sixteen agents, roughly two weeks, nearly two thousand sessions, and API cost just below $20,000 for a Rust-based C compiler. The author describes significant remaining performance, completeness, and code-quality limitations. This demonstrates substantial capability alongside the importance of independent validation; it is not a cost estimate for another project.

## Architecture depends on task structure

[Kim et al.: Towards a Science of Scaling Agent Systems, v3](https://arxiv.org/abs/2512.08296v3), revised April 2026.

The abstract reports controlled comparisons across agent architectures and benchmarks, with gains or losses depending on task structure. We use the limited conclusion that more agents are not uniformly better. Its benchmark results should not be extrapolated into a guarantee about game production, graphics software, or a particular commercial model.

## What remains to be tested

This package has no measured productivity multiplier. Before trusting it for a large build, compare a capable single-worker baseline with a small coordinated team on representative work, keeping acceptance standards and budgets comparable. Measure accepted outcomes, rework, defects, cost and elapsed time. Tune the workflow from those results.
