# Local helper usage

Requirements: Python 3.10 or newer, standard library only. The coordinator runs this helper with its actual shell/execution tool. It makes no network requests and starts no model sessions. Keep one coordinator responsible for state.

In the examples, replace `/bundle`, `/project`, and `/work` with real paths. Quote paths with spaces. `--file` in the evidence command and manifest entries are project-relative; other file arguments are ordinary filesystem paths.

```sh
python3 /bundle/bin/studio.py init --project /project --idea-file /work/idea.txt --kind animation
python3 /bundle/bin/studio.py status --project /project
python3 /bundle/bin/studio.py context --project /project
```

Read `.studio/state.json`, add requirements and task contracts using `templates/task-contract.json`, and save the modified object to a separate candidate JSON file. Keep its `revision` unchanged. Inspect the complete user's idea before deriving requirements.

```sh
python3 /bundle/bin/studio.py validate --project /project --state-file /work/candidate.json
python3 /bundle/bin/studio.py save --project /project --state-file /work/candidate.json --expect-revision 0
python3 /bundle/bin/studio.py context --project /project --task T-001
```

Use the current revision, not always zero. `save` rejects stale writes and silently removed requirements/tasks, increments the revision, and stores a snapshot. Record legitimate scope changes explicitly; retain superseded items and their history rather than erasing them. Tasks start `planned`; a dispatchable task needs a complete contract and accepted dependencies.

Requirement object:

```json
{"id":"R-001","description":"An explicit required outcome","priority":"mandatory"}
```

Accepted task fields are illustrated in `templates/accepted-task.example.json`. This is a structural example with deliberately non-valid fixture paths/hashes; never copy it as evidence of real completion.

Generate evidence records only from files produced by actual verification:

```sh
python3 /bundle/bin/studio.py evidence --project /project --file .studio/evidence/check.log --revision integrated-v1
python3 /bundle/bin/studio.py validate --project /project
python3 /bundle/bin/studio.py checkpoint --project /project --summary-file /work/handoff.md
python3 /bundle/bin/studio.py package --project /project --manifest /project/delivery/manifest.json --output /project/delivery/result-v1.zip
```

Use immutable artifact versions or actual commit IDs consistently. Every accepted task requires recorded passing checks, a matching reviewed submission, passing integration, and at least one existing unmodified evidence file tied to the integrated revision. This verifies records and hashes; it does not establish that the recorded claims are true. Real reviewers must inspect the underlying artifact.

`status` and `context` summarize records without rehashing evidence; `validate`, `save` and `package` perform those checks. Reopen affected tasks if evidence changes. Packaging requires an explicit file allowlist and refuses overwriting an existing output archive. Output publication uses a filesystem hard link from a completed temporary file in the same output directory; use a filesystem supporting ordinary file hard links.

Costs are a ledger, not an enforced provider cap. Unknown values remain `null`; even an observed overrun is preserved for honest reporting. Use host/provider controls for actual admission limits and spending enforcement.

Tests:

```sh
python3 -m unittest discover -s /bundle/tests -v
```
