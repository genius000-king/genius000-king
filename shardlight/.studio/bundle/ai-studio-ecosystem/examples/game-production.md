# Example: a game with ambitious production quality

This is a production-plan example. It is not a promise to create a complete AAA title in days. Choose a compact playable slice that proves the desired experience and asset pipeline.

## Define the experience

Specify player fantasy, core interaction loop, perspective, camera, visual references, audio references, platform, input methods, and performance target. Use a short complete encounter or exploration sequence as the first acceptance journey.

Scope a small area, a limited character/prop set, and one polished core interaction. Include entry, tutorial cues where needed, action, feedback, failure/retry, completion, and save/resume if required. The full game roadmap remains separate.

Evaluate engine reuse versus custom technology through the product's actual differentiator. An established engine can supply editor, asset import, animation, audio, physics and packaging. A custom engine is justified when the project needs capabilities that existing options cannot reasonably provide, or engine development itself is the goal.

## One coherent direction

Before parallel asset production, record an art and technical guide:

- Scale and unit conventions, coordinate system and orientation.
- Naming, source formats, export formats, tool versions and directory ownership.
- Material/shader conventions, palette, lighting references and composition goals.
- Skeleton, rig and animation import conventions.
- Texture resolution, geometry and memory budgets tied to target hardware.
- Collision, navigation, level-streaming and LOD conventions where applicable.
- Audio event names, mix hierarchy, reference level, loop and transition behavior.

Build one representative asset end to end before producing twenty variations. A folder of individually impressive assets can still fail as a coherent game.

## Workstreams and seams

| Workstream | Coherent deliverable | Integration contract |
| --- | --- | --- |
| Gameplay | Complete player interaction with success/failure behavior. | Events, state transitions and input contract. |
| Character/animation | Rigged character and required motion set. | Skeleton, root motion, events and collision conventions. |
| Environment/lighting | A navigable area expressing the art direction. | Scale, materials, navigation and performance budgets. |
| Audio | Implemented event-driven cues, ambience and transitions. | Event names, spatial behavior, mix bus and concurrency rules. |
| Interface/accessibility | HUD/menu/input flows with relevant states. | Shared state, input mappings, focus and design references. |
| Performance/build | Profiled packaged slice on required hardware. | Workload, settings, traces and reproducible build configuration. |

Some streams can run concurrently after their seams are defined. Later feedback will still require coordinated changes. Use shared event schemas and representative fixtures rather than expecting independently created content to fit automatically.

## Useful deep work for specialists

Animation task: implement and evaluate a complete movement transition set, including starts, stops, direction changes, interruptions, contact timing and camera interaction. Deliver videos, editable source, import settings and known limitations.

Audio task: build and integrate a family of interaction sounds, including variations, spatialization, overlap rules, dynamic mixing and smooth transitions. Verify clipping, loop boundaries, loudness relationships and the actual in-game mix. Listening is needed for artistic judgment.

Performance task: profile a repeatable traversal/encounter on a named target device, identify CPU/GPU/memory or streaming bottlenecks, test one optimization hypothesis at a time, and document quality tradeoffs with before/after captures. Do not declare optimization based on source-code cleanup alone.

## Playability and taste

Use automated scenarios to expose broken state, crashes, navigation failures or performance regressions. Use competent visual/audio inspection and human playtests where needed to assess clarity, comfort, feel and enjoyment. A model with no appropriate tools cannot verify those qualities merely by reading scripts.

Freeze a few representative reference clips and a rubric for responsiveness, readability, animation continuity, sonic clarity and visual coherence. Keep at least one fresh playthrough outside the builder's own testing path.

## Illustrative 72-hour milestone cadence

This is a sequence of budgeted checkpoints, not a completion estimate. Tighten scope when evidence shows the workload does not fit.

| Checkpoint | Required outcome |
| --- | --- |
| Initial discovery | Bounded experience, target platform, references, top risks and chosen experiments. |
| First playable | Packaged path through the core interaction, even with provisional assets. |
| Production pass | Representative final-quality assets integrated under shared conventions. |
| Quality pass | Actual visual/audio/gameplay review and target-device profiling. |
| Handoff | Best verified build, evidence, remaining failures, costs and next milestone. |

Budget review and final verification from the beginning. If the complete slice is not ready, provide the functioning verified subset and a precise remaining-work register. Do not hide missing gameplay behind polished screenshots.
