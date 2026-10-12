# Delivery

Prepare a user-usable result and its editable sources. Fit the exact contents to the domain and request.

1. Freeze a specific candidate. Run the required checks on it and record unresolved gaps.
2. Create `delivery/DELIVERY.md`: what was produced, how to use/view/build it, actual checks, limitations, recorded cost or missing cost visibility, and exact continuation work if incomplete.
3. Include editable sources, assets/provenance, builds/exports, dependency/toolchain information and representative evidence as appropriate. Include the resume prompt and checkpoint for incomplete work.
4. Create `delivery/manifest.json` from `templates/delivery-manifest.json`, replacing all examples with explicit real project-relative file paths. Include the delivery report itself. Enumerate relevant source trees programmatically when large, then inspect the selected list. Do not archive the entire workstation, environment, caches or credentials.
5. Run the helper's `package` command. It adds `PACKAGE_MANIFEST.json` with file hashes and the state revision. Keep source/export files unchanged during packaging.
6. Inspect the archive listing, test archive integrity and verify that usage instructions refer to included files. If practical, open/run the exported artifact from an extracted copy.
7. Return a direct download link, a short result summary and material limitations. Include preview media where useful and actually available.

Use `status: complete` only when all mandatory requirements are supported by accepted tasks and the requested deliverable exists. Use `partial` honestly when the host or budget prevented completion. The helper rejects missing recorded mandatory coverage; it cannot detect requirements that the coordinator never recorded, so reread the user's original idea before the final claim.

The file allowlist and basic secret-name exclusions reduce accidental packaging. They are not a comprehensive secret scanner; review selected file contents when relevant. A media export alone may not reproduce an editable project, and source files alone may not provide the requested playable/viewable output.
