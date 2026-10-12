# Example: a professional graphics editor

This is an illustrative milestone design, not a built application or a benchmark. The full ambition can be a broad professional editor. Select a first differentiated workflow and prove it at a high quality bar before multiplying features.

## First coherent journey

Open a representative image, add and transform layers, paint or erase on a layer, undo and redo the operations, save the document, reopen it, and export the expected result. Include cancellation, failed save, and recovery. Choose the exact subset around the intended user rather than copying every feature of an incumbent product.

This journey forces meaningful integration among document state, rendering, input, history, persistence, and UI. A beautiful toolbar alone cannot demonstrate it.

## Candidate architecture

| Area | Decision to resolve | Evidence before committing |
| --- | --- | --- |
| Document core | Layer/tree representation, tile storage, IDs and ownership. | Representative editing and memory workload. |
| Renderer | GPU/CPU division, composition order, texture lifetime, fallback strategy. | Correctness fixtures and target-device profiling. |
| Color | Working space, transfer functions, alpha convention, profile handling. | Trusted reference images and known mathematical cases. |
| History | Commands, snapshots or hybrid storage, coalescing rules. | Undo/redo invariants and bounded memory tests. |
| Persistence | Versioned file format, atomic save and recovery semantics. | Round-trip and interrupted-save experiments. |
| UI/tooling | Native/widget/web options, text and input requirements. | Stylus, keyboard, scaling, localization and latency prototype. |

Rust can be a constraint for the core. A GPU abstraction such as wgpu is a candidate to investigate, not a verified recommendation for every target. Compare current versions, feature support, licenses and representative performance. Do not rewrite mature image codecs or platform text stacks merely to claim everything was built from scratch.

## Cohesive work packages

```text
T01: representative workloads + required outcomes
  -> T02: document/render/history/save interface contracts
      -> T03: document state + history implementation
      -> T04: composition renderer + color correctness
      -> T05: input/tool interaction + shared UI component states
      -> T06: document persistence + recovery
T03 + T04 + T05 + T06 -> T07: integrated editing journey
T07 -> T08: independent correctness/UX review and target-device profile
T08 -> targeted fixes -> verified milestone
```

Parallel work starts after usable interfaces exist, with small runnable increments to uncover wrong assumptions early. Mocks may support unit development but cannot satisfy integrated acceptance.

## A worker contract with real depth

Task: implement composition for a declared subset of layer blending.

- Own the rendering module and its test fixtures; consume the pinned document contract.
- Implement only the declared blend modes, with explicit working color space, premultiplied-alpha rules, and clipping behavior.
- Check tiny known fixtures, transparent edges, low-opacity combinations, high dynamic range if required, reordered layers, and representative large documents.
- Use a trusted oracle or specified reference math. Preserve reference fixture provenance.
- Benchmark the required workloads on named hardware; record resolution, layer count, build mode, memory, timing distribution, and variability.
- Document unsupported cases and produce a reproducible demo plus evidence.

This gives a strong model a complete engineering problem. It can investigate algorithms, compare approaches, optimize the bottleneck, and substantiate the result without owning the entire application.

## One button, many acceptance details

For a layer visibility toggle, one coherent component task covers:

- Icon and accessible name reflect the actual state.
- Pointer and keyboard interaction trigger the same document command.
- Focus remains visible and stable after activation.
- Hover, pressed, disabled and selected states match the design system.
- Undo/redo restores visibility and the corresponding UI state.
- Rapid toggles do not desynchronize the renderer and document.
- The control remains legible at required scaling factors and in required themes.
- A screen reader can identify the control and state if that platform supports it.

These checks belong to a shared interaction design; they do not require eight independent implementations.

## Definition of professional progress

Record requirement-level evidence for color correctness, data integrity, input quality, recovery, performance and coherence. Treat pixel tolerances and performance targets as project-specific decisions established before testing.

For example, a target of 60 frames per second implies a nominal frame interval near 16.7 ms. That calculation does not prove the editor meets the target, define input-to-display latency, or account for stutters. Measure the actual workload and choose suitable percentile thresholds.

The next milestone expands a proven workflow: masks, text, vector paths, additional blend modes, or file compatibility. Preserve full-vision coverage so omitted features remain visible rather than silently disappearing.
