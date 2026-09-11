#!/usr/bin/env python3
"""Fail if the shipped native binaries drift from the lockfile.

Two checks, both of which have caught real problems: the bytes must match the
hashes recorded when fetch.py produced them, and every DT_NEEDED must name
either a file sitting next to it or a library Android itself provides.
"""
import hashlib, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.abspath(os.path.join(ROOT, "..", ".."))
SYSTEM_LIBS = {
    "libc.so", "libdl.so", "libm.so", "liblog.so", "libz.so",
    "libandroid.so", "libstdc++.so", "libEGL.so", "libGLESv2.so",
}

def needed_of(path):
    try:
        return subprocess.run(
            ["patchelf", "--print-needed", path],
            check=True, capture_output=True, text=True,
        ).stdout.split()
    except subprocess.CalledProcessError:
        return None  # statically linked

def main():
    lock = json.load(open(os.path.join(ROOT, "native.lock.json")))
    produced = lock.get("produced")
    if not produced:
        sys.exit("native.lock.json has no 'produced' section; run fetch.py")

    failures = []
    for abi, files in produced.items():
        out = os.path.join(PROJECT, "app", "src", "main", "jniLibs", abi)
        present = set(os.listdir(out)) if os.path.isdir(out) else set()
        for name, expected in files.items():
            path = os.path.join(out, name)
            if not os.path.isfile(path):
                failures.append(f"{abi}/{name}: missing")
                continue
            got = hashlib.sha256(open(path, "rb").read()).hexdigest()
            if got != expected:
                failures.append(f"{abi}/{name}: sha256 {got} != {expected}")
            for dep in needed_of(path) or []:
                if dep not in present and dep not in SYSTEM_LIBS:
                    failures.append(f"{abi}/{name}: unresolved dependency {dep}")
        for extra in sorted(present - set(files)):
            failures.append(f"{abi}/{extra}: not in lockfile")

    if failures:
        print("\n".join(failures))
        sys.exit(1)
    total = sum(len(f) for f in produced.values())
    print(f"native binaries verified ({total} files)")

main()
