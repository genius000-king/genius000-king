#!/usr/bin/env python3
"""Resolve the pinned Termux packages against the live repository index.

Writes tools/native/native.lock.json. Run this to move the pin deliberately;
fetch.sh never resolves anything by itself, so an upstream change can never
silently alter what ships in the APK.
"""
import hashlib, json, os, sys, urllib.request

REPO = "https://packages.termux.dev/apt/termux-main"
ABIS = {"arm64-v8a": "aarch64"}
WANT = ["proot", "libtalloc", "libandroid-shmem", "busybox", "libandroid-selinux", "pcre2"]
LICENSES = {
    "proot": ("GPL-2.0", "https://github.com/termux/proot"),
    "libtalloc": ("LGPL-3.0", "https://gitlab.com/samba-team/samba"),
    "libandroid-shmem": ("MIT", "https://github.com/termux/libandroid-shmem"),
    "busybox": ("GPL-2.0", "https://git.busybox.net/busybox"),
    "libandroid-selinux": ("Public Domain", "https://github.com/termux/termux-packages"),
    "pcre2": ("BSD-3-Clause", "https://github.com/PCRE2Project/pcre2"),
}

def index(arch):
    url = f"{REPO}/dists/stable/main/binary-{arch}/Packages"
    raw = urllib.request.urlopen(url, timeout=120).read().decode("utf-8", "replace")
    out = {}
    for block in raw.split("\n\n"):
        fields = {}
        key = None
        for line in block.splitlines():
            if line.startswith(" ") and key:
                fields[key] += line
            elif ":" in line:
                key, _, val = line.partition(":")
                fields[key] = val.strip()
        if "Package" in fields:
            out[fields["Package"]] = fields
    return out

def main():
    root = os.path.dirname(os.path.abspath(__file__))
    lock = {"repository": REPO, "abis": {}}
    for abi, arch in ABIS.items():
        pkgs = index(arch)
        entries = []
        for name in WANT:
            p = pkgs.get(name)
            if not p:
                sys.exit(f"package {name} not in {arch} index")
            lic, src = LICENSES[name]
            entries.append({
                "package": name,
                "version": p["Version"],
                "filename": p["Filename"],
                "sha256": p["SHA256"],
                "license": lic,
                "source": src,
            })
            print(f"  {arch:9} {name:20} {p['Version']}")
        lock["abis"][abi] = {"termuxArch": arch, "packages": entries}
    path = os.path.join(root, "native.lock.json")
    with open(path, "w") as f:
        json.dump(lock, f, indent=2)
        f.write("\n")
    print("wrote", path)

main()
