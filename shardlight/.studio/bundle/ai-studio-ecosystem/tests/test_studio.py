import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location("studio", Path(__file__).resolve().parents[1] / "bin/studio.py")
studio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(studio)


class StudioTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name).resolve()
        self.root = self.base / "project"
        self.idea = self.base / "idea.txt"
        self.idea.write_text("فيلم تحريك قصير\nمع تفاصيل كثيرة\n", encoding="utf-8")
        studio.initialize(self.root, self.idea, "animation")

    def candidate(self):
        value = studio.load(self.root)
        value["requirements"] = [{"id": "R-1", "description": "A coherent exported scene", "priority": "mandatory"}]
        value["tasks"] = [{"id": "T-1", "title": "Create a scene", "outcome": "A viewable scene",
                           "status": "ready", "owner": "worker-1", "depends_on": [],
                           "requirement_ids": ["R-1"], "writable_paths": ["exports/"],
                           "acceptance": [{"id": "AC-1", "description": "The exported scene can be inspected"}]}]
        return value

    def accepted(self):
        value = self.candidate()
        evidence = self.root / ".studio/evidence/check.txt"
        evidence.write_text("Synthetic fixture: verification result", encoding="utf-8")
        task = value["tasks"][0]
        task.update(status="accepted", submission={"revision": "worker-v1"},
                    review={"decision": "pass", "reviewer": "reviewer-1", "independent": True,
                            "target_revision": "worker-v1", "checks": {"AC-1": "pass"}},
                    integration={"status": "pass", "revision": "integrated-v1"},
                    evidence=[{"path": ".studio/evidence/check.txt", "revision": "integrated-v1",
                               "sha256": studio.digest(evidence)}])
        return value

    def save_value(self, value):
        target = self.base / "candidate.json"
        studio.write_json(target, value)
        return studio.save(self.root, target, value["revision"])

    def manifest(self, paths, status="partial"):
        target = self.base / "delivery.json"
        studio.write_json(target, {"status": status, "files": paths})
        return target

    def test_initialization_preserves_idea_and_is_idempotent(self):
        self.assertEqual((self.root / ".studio/IDEA.md").read_text(), self.idea.read_text())
        self.assertEqual(studio.initialize(self.root, self.idea, "animation")["revision"], 0)
        self.idea.write_text("different")
        with self.assertRaisesRegex(ValueError, "different idea"):
            studio.initialize(self.root, self.idea, "animation")

    def test_stale_save_rejected_and_history_preserved(self):
        value = self.candidate()
        self.assertEqual(self.save_value(value)["revision"], 1)
        with self.assertRaisesRegex(ValueError, "Stale revision"):
            self.save_value(value)
        self.assertEqual(studio.load(self.root)["revision"], 1)
        self.assertTrue((self.root / ".studio/history/000000.json").is_file())
        self.assertTrue((self.root / ".studio/history/000001.json").is_file())

    def test_cycles_rejected(self):
        value = self.candidate()
        first = value["tasks"][0]
        first["status"] = "planned"
        first["depends_on"] = ["T-2"]
        second = copy.deepcopy(first)
        second.update(id="T-2", depends_on=["T-1"])
        value["tasks"].append(second)
        with self.assertRaisesRegex(ValueError, "cycle"):
            studio.check(value, self.root)

    def test_dispatch_waits_for_dependency(self):
        value = self.candidate()
        second = copy.deepcopy(value["tasks"][0])
        second.update(id="T-2", depends_on=["T-1"])
        value["tasks"].append(second)
        with self.assertRaisesRegex(ValueError, "not accepted"):
            studio.check(value, self.root)

    def test_accepted_requires_real_matching_evidence_file(self):
        value = self.accepted()
        studio.check(value, self.root)
        (self.root / ".studio/evidence/check.txt").write_text("changed result")
        with self.assertRaisesRegex(ValueError, "changed evidence"):
            studio.check(value, self.root)

    def test_acceptance_requires_independent_review_and_matching_revision(self):
        value = self.accepted()
        value["tasks"][0]["review"]["reviewer"] = "worker-1"
        with self.assertRaisesRegex(ValueError, "independent review"):
            studio.check(value, self.root)
        value = self.accepted()
        value["tasks"][0]["evidence"][0]["revision"] = "old-integration"
        with self.assertRaisesRegex(ValueError, "revision does not match"):
            studio.check(value, self.root)

    def test_missing_acceptance_check_rejected(self):
        value = self.accepted()
        value["tasks"][0]["review"]["checks"] = {}
        with self.assertRaisesRegex(ValueError, "unverified"):
            studio.check(value, self.root)

    def test_scope_items_cannot_silently_disappear(self):
        self.save_value(self.candidate())
        value = studio.load(self.root)
        value["tasks"] = []
        with self.assertRaisesRegex(ValueError, "silently remove"):
            self.save_value(value)

    def test_checkpoint_and_task_context(self):
        self.save_value(self.candidate())
        summary = self.base / "handoff.md"
        summary.write_text("Next: inspect the rendered scene. Preserve existing source.")
        result = studio.checkpoint(self.root, summary)
        self.assertTrue((self.root / result["resume_prompt"]).is_file())
        self.assertIn("Next: inspect", (self.root / result["checkpoint"]).read_text())
        self.assertEqual(studio.context(self.root, "T-1")["task"]["id"], "T-1")
        self.assertEqual(studio.load(self.root)["revision"], 1)

    def test_complete_delivery_rejects_unmet_scope(self):
        (self.root / "exports/preview.txt").write_text("preview")
        with self.assertRaisesRegex(ValueError, "mandatory requirements"):
            studio.package(self.root, self.manifest(["exports/preview.txt"], "complete"), self.base / "out.zip")

    def test_verified_delivery_and_no_overwrite(self):
        self.save_value(self.accepted())
        (self.root / "exports/result.txt").write_text("synthetic result")
        manifest = self.manifest(["exports/result.txt"], "complete")
        output = self.base / "out.zip"
        studio.package(self.root, manifest, output)
        with zipfile.ZipFile(output) as archive:
            self.assertIsNone(archive.testzip())
            record = json.loads(archive.read("PACKAGE_MANIFEST.json"))
            self.assertEqual(record["state_revision"], 1)
            self.assertEqual(record["files"][0]["sha256"], studio.digest(self.root / "exports/result.txt"))
        before = studio.digest(output)
        with self.assertRaisesRegex(ValueError, "already exists"):
            studio.package(self.root, manifest, output)
        self.assertEqual(studio.digest(output), before)

    def test_package_rejects_traversal_secret_files_and_normalized_duplicates(self):
        (self.root / ".env").write_text("EXAMPLE_ONLY=1")
        (self.root / "exports/result.txt").write_text("fixture")
        for paths in (["../idea.txt"], [".env"], ["exports/result.txt", "exports/./result.txt"]):
            with self.subTest(paths=paths), self.assertRaises(ValueError):
                studio.package(self.root, self.manifest(paths), self.base / "out.zip")
        self.assertFalse((self.base / "out.zip").exists())

    def test_symlink_escape_rejected(self):
        link = self.root / "exports/link.txt"
        try:
            link.symlink_to(self.idea)
        except OSError:
            self.skipTest("OS does not permit symlink creation")
        with self.assertRaises(ValueError):
            studio.local_path(self.root, "exports/link.txt")

    def test_existing_lock_is_not_removed(self):
        lock = self.root / ".studio/coordinator.lock"
        lock.write_text("existing owner")
        with self.assertRaisesRegex(ValueError, "lock exists"):
            with studio.state_lock(self.root):
                self.fail("lock should not be acquired")
        self.assertEqual(lock.read_text(), "existing owner")

    def test_recorded_cost_overrun_is_preserved_for_honest_reporting(self):
        value = self.candidate()
        value["budget"].update(authorized_cap=10, actual_spent=12, outstanding_reserved=0)
        self.save_value(value)
        self.assertEqual(studio.load(self.root)["budget"]["actual_spent"], 12)


if __name__ == "__main__":
    unittest.main()
