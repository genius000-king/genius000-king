#!/usr/bin/env python3
"""Local, single-coordinator project helpers. No model calls or background loop."""
from __future__ import annotations

import argparse
from collections import Counter, deque
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import tempfile
import time
import zipfile


STATES = {"planned", "ready", "running", "submitted", "reviewing", "approved",
          "integrating", "accepted", "needs_revision", "blocked", "cancelled"}
ACTIVE = {"ready", "running", "submitted", "reviewing", "approved", "integrating", "accepted"}


def utc():
    return datetime.now(timezone.utc).isoformat()


def read_json(path):
    def invalid(value):
        raise ValueError(f"Non-finite JSON value: {value}")
    return json.loads(Path(path).read_text(encoding="utf-8"), parse_constant=invalid)


def atomic_write(path, text):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".studio-write-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            stream.write(text)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def write_json(path, value):
    atomic_write(path, json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n")


def local_path(root, relative):
    if not isinstance(relative, str) or not relative or "\\" in relative:
        raise ValueError("Use a nonempty project-relative path with forward slashes")
    part = Path(relative)
    if part.is_absolute() or ".." in part.parts or ":" in relative:
        raise ValueError(f"Unsafe project path: {relative}")
    result = root / part
    if not result.resolve().is_relative_to(root.resolve()):
        raise ValueError(f"Path escapes project: {relative}")
    cursor = result
    while cursor != root:
        if cursor.is_symlink():
            raise ValueError(f"Symlinks are not accepted: {relative}")
        cursor = cursor.parent
    return result


def digest(path):
    result = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


@contextmanager
def state_lock(root):
    lock = local_path(root, ".studio/coordinator.lock")
    lock.parent.mkdir(parents=True, exist_ok=True)
    try:
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        raise ValueError("Coordinator lock exists. Check its process before removing a stale lock.") from None
    try:
        with os.fdopen(fd, "w") as stream:
            stream.write(json.dumps({"pid": os.getpid(), "created": utc()}))
        yield
    finally:
        lock.unlink(missing_ok=True)


def indexed(items, label):
    if not isinstance(items, list):
        raise ValueError(f"{label} must be a list")
    result = {}
    for item in items:
        if not isinstance(item, dict) or not isinstance(item.get("id"), str) or not item["id"].strip():
            raise ValueError(f"Every {label} item needs a nonempty string id")
        if item["id"] in result:
            raise ValueError(f"Duplicate {label} id: {item['id']}")
        result[item["id"]] = item
    return result


def check(state, root):
    if not isinstance(state, dict) or state.get("schema_version") != 1:
        raise ValueError("Unsupported state schema")
    if type(state.get("revision")) is not int or state["revision"] < 0:
        raise ValueError("revision must be a nonnegative integer")
    if not isinstance(state.get("project"), dict):
        raise ValueError("project must be an object")
    requirements = indexed(state.get("requirements"), "requirements")
    tasks = indexed(state.get("tasks"), "tasks")
    for req in requirements.values():
        if not isinstance(req.get("description"), str) or not req["description"].strip():
            raise ValueError(f"Requirement {req['id']} needs a description")
        if req.get("priority") not in {"mandatory", "optional"}:
            raise ValueError(f"Requirement {req['id']} has invalid priority")
    edges = {key: [] for key in tasks}
    degrees = {}
    for task_id, task in tasks.items():
        status = task.get("status")
        if status not in STATES:
            raise ValueError(f"{task_id}: unknown status")
        deps = task.get("depends_on", [])
        reqs = task.get("requirement_ids", [])
        if not isinstance(deps, list) or any(not isinstance(x, str) for x in deps):
            raise ValueError(f"{task_id}: depends_on must be a list of IDs")
        if len(set(deps)) != len(deps):
            raise ValueError(f"{task_id}: duplicate dependency")
        if not isinstance(reqs, list) or any(not isinstance(x, str) or x not in requirements for x in reqs):
            raise ValueError(f"{task_id}: unknown requirement")
        for dep in deps:
            if dep not in tasks:
                raise ValueError(f"{task_id}: unknown dependency {dep}")
            edges[dep].append(task_id)
            if status in ACTIVE and tasks[dep].get("status") != "accepted":
                raise ValueError(f"{task_id}: dependency {dep} is not accepted")
        degrees[task_id] = len(deps)
        criteria = indexed(task.get("acceptance", []), f"{task_id} acceptance")
        if status in ACTIVE:
            if not task.get("title") or not task.get("outcome") or not reqs or not criteria:
                raise ValueError(f"{task_id}: incomplete dispatch contract")
            if any(not isinstance(c.get("description"), str) or not c["description"].strip() for c in criteria.values()):
                raise ValueError(f"{task_id}: acceptance descriptions are required")
        for path in task.get("writable_paths", []):
            local_path(root, path)
        if status == "accepted":
            owner = task.get("owner")
            review = task.get("review", {})
            submission = task.get("submission", {})
            integration = task.get("integration", {})
            if not owner or review.get("decision") != "pass" or not review.get("reviewer"):
                raise ValueError(f"{task_id}: accepted work needs author and passing review")
            if task.get("requires_independent_review", True):
                if review.get("independent") is not True or review["reviewer"] == owner:
                    raise ValueError(f"{task_id}: independent review is missing")
            if not submission.get("revision") or review.get("target_revision") != submission["revision"]:
                raise ValueError(f"{task_id}: review targets a different or missing submission")
            if integration.get("status") != "pass" or not integration.get("revision"):
                raise ValueError(f"{task_id}: passing integration is missing")
            if any(review.get("checks", {}).get(key) != "pass" for key in criteria):
                raise ValueError(f"{task_id}: an acceptance criterion is unverified")
            evidence = task.get("evidence", [])
            if not isinstance(evidence, list) or not evidence:
                raise ValueError(f"{task_id}: evidence is missing")
            for item in evidence:
                if item.get("revision") != integration["revision"]:
                    raise ValueError(f"{task_id}: evidence revision does not match integration")
                path = local_path(root, item.get("path"))
                if not path.is_file() or digest(path) != item.get("sha256"):
                    raise ValueError(f"{task_id}: missing or changed evidence {item.get('path')}")
    queue = deque(key for key, count in degrees.items() if count == 0)
    visited = 0
    while queue:
        current = queue.popleft()
        visited += 1
        for target in edges[current]:
            degrees[target] -= 1
            if degrees[target] == 0:
                queue.append(target)
    if visited != len(tasks):
        raise ValueError("Task dependencies contain a cycle")
    budget = state.get("budget", {})
    for key in ("authorized_cap", "actual_spent", "outstanding_reserved"):
        value = budget.get(key)
        if value is not None and (type(value) not in (int, float) or not math.isfinite(value) or value < 0):
            raise ValueError(f"Invalid budget value: {key}")
    return tasks, requirements


def state_path(root):
    return root / ".studio" / "state.json"


def load(root):
    return read_json(state_path(root))


def overview(state):
    tasks = state["tasks"]
    covered = []
    pending = []
    for req in state["requirements"]:
        linked = [t for t in tasks if req["id"] in t.get("requirement_ids", [])]
        complete = bool(linked) and all(t["status"] == "accepted" for t in linked)
        (covered if complete else pending).append(req["id"])
    return {"revision": state["revision"], "project": state["project"],
            "task_counts": dict(Counter(t["status"] for t in tasks)),
            "covered_requirements": covered, "pending_requirements": pending,
            "budget": state.get("budget", {}),
            "evidence_note": "Recorded evidence checked by validate; its meaning is assessed by real reviewers."}


def initialize(root, idea_file, kind):
    idea = Path(idea_file).read_text(encoding="utf-8")
    if not idea.strip():
        raise ValueError("The idea file is empty")
    root.mkdir(parents=True, exist_ok=True)
    with state_lock(root):
        idea_target = root / ".studio" / "IDEA.md"
        if state_path(root).exists():
            if idea_target.read_text(encoding="utf-8") != idea:
                raise ValueError("An existing project has a different idea; preserve it and record a scope change")
            return overview(load(root))
        if idea_target.exists() and idea_target.read_text(encoding="utf-8") != idea:
            raise ValueError("Existing idea file would be overwritten")
        for directory in (".studio/docs", ".studio/evidence", ".studio/receipts", ".studio/checkpoints",
                          ".studio/history", "source", "assets", "exports", "delivery"):
            (root / directory).mkdir(parents=True, exist_ok=True)
        atomic_write(idea_target, idea)
        state = {"schema_version": 1, "revision": 0, "updated_at": utc(),
                 "project": {"name": root.name, "kind": kind, "idea_file": ".studio/IDEA.md",
                             "execution_mode": "unselected", "status": "planning"},
                 "requirements": [], "tasks": [], "decisions": [], "capabilities": {},
                 "budget": {"currency": None, "authorized_cap": None, "actual_spent": None,
                            "outstanding_reserved": None, "enforcement": "not_implemented_by_helper"}}
        write_json(state_path(root), state)
        write_json(root / ".studio/history/000000.json", state)
        return overview(state)


def save(root, candidate_file, expected_revision):
    candidate = read_json(candidate_file)
    with state_lock(root):
        current = load(root)
        if current["revision"] != expected_revision or candidate.get("revision") != expected_revision:
            raise ValueError("Stale revision; reread current state before applying changes")
        check(candidate, root)
        for collection in ("requirements", "tasks"):
            old_ids = {item["id"] for item in current[collection]}
            new_ids = {item["id"] for item in candidate[collection]}
            if not old_ids.issubset(new_ids):
                raise ValueError(f"Do not silently remove {collection}; preserve history and record scope changes")
        candidate["revision"] = expected_revision + 1
        candidate["updated_at"] = utc()
        # Authoritative state is replaced atomically; historical snapshots aid recovery.
        write_json(root / ".studio/history" / f"{candidate['revision']:06d}.json", candidate)
        write_json(state_path(root), candidate)
    return overview(candidate)


def context(root, task_id=None):
    state = load(root)
    result = overview(state)
    result["read_first"] = [".studio/IDEA.md", ".studio/CAPABILITIES.md", ".studio/checkpoints/LATEST.md"]
    result["decisions"] = state.get("decisions", [])[-10:]
    if task_id:
        task = next((t for t in state["tasks"] if t["id"] == task_id), None)
        if task is None:
            raise ValueError(f"Unknown task: {task_id}")
        result["task"] = task
        result["requirements"] = [r for r in state["requirements"] if r["id"] in task.get("requirement_ids", [])]
        result["dependencies"] = [t for t in state["tasks"] if t["id"] in task.get("depends_on", [])]
    else:
        result["next_tasks"] = [{"id": t["id"], "title": t.get("title"), "status": t["status"]}
                                for t in state["tasks"] if t["status"] not in {"accepted", "cancelled"}][:25]
        result["full_state_path"] = ".studio/state.json"
    return result


def checkpoint(root, summary_file):
    summary = Path(summary_file).read_text(encoding="utf-8")
    if not summary.strip():
        raise ValueError("A meaningful checkpoint summary is required")
    with state_lock(root):
        state = load(root)
        name = f"{time.time_ns()}-r{state['revision']}.md"
        text = f"# Checkpoint\n\nUTC: {utc()}\nState revision: {state['revision']}\n\n{summary}\n"
        atomic_write(root / ".studio/checkpoints" / name, text)
        atomic_write(root / ".studio/checkpoints/LATEST.md", text)
        prompt = ("Resume this project using the supplied AI Studio Ecosystem. Read START_HERE.md, "
                  "the project's .studio/IDEA.md, .studio/state.json, .studio/CAPABILITIES.md and "
                  ".studio/checkpoints/LATEST.md. Verify current files, revisions, evidence and live "
                  "agent ownership before continuing. Preserve completed work. Continue the exact "
                  "next authorized action from the checkpoint; do not restart the project.\n")
        atomic_write(root / ".studio/RESUME_PROMPT.txt", prompt)
    return {"checkpoint": f".studio/checkpoints/{name}", "resume_prompt": ".studio/RESUME_PROMPT.txt"}


def package(root, manifest_file, output):
    manifest = read_json(manifest_file)
    state = load(root)
    check(state, root)
    if manifest.get("status") not in {"complete", "partial"}:
        raise ValueError("Delivery status must be complete or partial")
    if manifest["status"] == "complete":
        mandatory = {r["id"] for r in state["requirements"] if r["priority"] == "mandatory"}
        covered = set(overview(state)["covered_requirements"])
        if not mandatory or not mandatory.issubset(covered):
            raise ValueError("Complete delivery requires evidence-backed coverage of all mandatory requirements")
    files = manifest.get("files")
    if not isinstance(files, list) or not files or any(not isinstance(p, str) for p in files):
        raise ValueError("Manifest needs an explicit nonempty list of file paths")
    if len(files) != len(set(files)):
        raise ValueError("Duplicate delivery paths")
    output = Path(output).resolve()
    if output.exists():
        raise ValueError("Output already exists; choose a new versioned filename")
    selected = []
    canonical_paths = set()
    for relative in files:
        path = local_path(root, relative)
        relative = path.relative_to(root).as_posix()
        if relative in canonical_paths:
            raise ValueError("Duplicate normalized delivery paths")
        canonical_paths.add(relative)
        lowered = [part.lower() for part in Path(relative).parts]
        if any(part in {".git", ".ssh", ".aws", ".azure", "__pycache__"} for part in lowered):
            raise ValueError(f"Private/internal directory is not a deliverable: {relative}")
        filename = path.name.lower()
        if filename in {".env", "credentials.json", "id_rsa", "id_ed25519"} or filename.endswith((".pem", ".key")):
            raise ValueError(f"Potential credential file is not a deliverable: {relative}")
        if filename.startswith(".env.") and filename not in {".env.example", ".env.template"}:
            raise ValueError(f"Potential environment secrets: {relative}")
        if relative == "PACKAGE_MANIFEST.json" or path.resolve() == output or not path.is_file():
            raise ValueError(f"Invalid delivery file: {relative}")
        selected.append((relative, path))
    output.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".studio-package-", suffix=".zip", dir=output.parent)
    os.close(fd)
    receipts = []
    try:
        with zipfile.ZipFile(temporary, "w", zipfile.ZIP_DEFLATED) as archive:
            for relative, path in selected:
                before = digest(path)
                archive.write(path, relative)
                if digest(path) != before:
                    raise ValueError(f"File changed during packaging: {relative}")
                receipts.append({"path": relative, "sha256": before, "bytes": path.stat().st_size})
            record = {**manifest, "created_at": utc(), "state_revision": state["revision"], "files": receipts}
            archive.writestr("PACKAGE_MANIFEST.json", json.dumps(record, indent=2, ensure_ascii=False))
        # Link atomically without replacing an existing destination.
        os.link(temporary, output)
    finally:
        Path(temporary).unlink(missing_ok=True)
    return {"archive": str(output), "files": len(receipts), "sha256": digest(output), "status": manifest["status"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("init", "save", "validate", "status", "context", "checkpoint", "evidence", "package"):
        sub = commands.add_parser(name)
        sub.add_argument("--project", required=True)
        if name == "init":
            sub.add_argument("--idea-file", required=True)
            sub.add_argument("--kind", choices=("software", "game", "animation", "general"), default="general")
        elif name == "save":
            sub.add_argument("--state-file", required=True)
            sub.add_argument("--expect-revision", type=int, required=True)
        elif name == "validate":
            sub.add_argument("--state-file")
        elif name == "context":
            sub.add_argument("--task")
        elif name == "checkpoint":
            sub.add_argument("--summary-file", required=True)
        elif name == "evidence":
            sub.add_argument("--file", required=True, help="Project-relative evidence file")
            sub.add_argument("--revision", required=True)
        elif name == "package":
            sub.add_argument("--manifest", required=True)
            sub.add_argument("--output", required=True)
    args = parser.parse_args()
    root = Path(args.project).resolve()
    try:
        if args.command == "init":
            result = initialize(root, args.idea_file, args.kind)
        elif args.command == "save":
            result = save(root, args.state_file, args.expect_revision)
        elif args.command == "validate":
            state = read_json(args.state_file) if args.state_file else load(root)
            check(state, root)
            result = {"valid": True, **overview(state)}
        elif args.command == "status":
            result = overview(load(root))
            result["validation_performed"] = False
        elif args.command == "context":
            result = context(root, args.task)
        elif args.command == "checkpoint":
            result = checkpoint(root, args.summary_file)
        elif args.command == "evidence":
            result = {"path": args.file, "revision": args.revision, "sha256": digest(local_path(root, args.file))}
        else:
            result = package(root, args.manifest, args.output)
        print(json.dumps(result, indent=2, ensure_ascii=False))
    except (ValueError, OSError, KeyError, TypeError, AttributeError) as error:
        parser.exit(2, f"Error: {error}\n")


if __name__ == "__main__":
    main()
