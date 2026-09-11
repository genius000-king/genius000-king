#!/usr/bin/env python3
"""Turn pinned Termux .deb packages into the app's jniLibs.

Why this exists: since Android 10 an app may not execute anything from its data
directory. `nativeLibraryDir` is the only executable location left, and the
packaging tools only place files there if they are named lib*.so. So every
executable we need ships renamed as a fake shared library -- and because the
rename breaks SONAME/DT_NEEDED resolution, the ELF headers are rewritten to
match. See docs/native-binaries.md.
"""
import hashlib, json, os, shutil, subprocess, sys, tarfile, urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.abspath(os.path.join(ROOT, "..", ".."))
WORK = os.path.join(ROOT, ".work")
# Termux packages install under their own app prefix.
PREFIX = "data/data/com.termux/files"

# source path inside the .deb  ->  name it gets in jniLibs
MAP = {
    "usr/bin/proot":                 "libproot.so",
    "usr/libexec/proot/loader":      "libproot-loader.so",
    "usr/bin/busybox":               "libbusybox.so",
    "usr/lib/libtalloc.so.2":        "libtalloc.so",
    "usr/lib/libandroid-shmem.so":   "libandroid-shmem.so",
    "usr/lib/libandroid-selinux.so": "libandroid-selinux.so",
}
# Provided by Android itself; never bundled.
SYSTEM_LIBS = {
    "libc.so", "libdl.so", "libm.so", "liblog.so", "libz.so",
    "libandroid.so", "libstdc++.so", "libEGL.so", "libGLESv2.so",
}

def sh(*a):
    return subprocess.run(a, check=True, capture_output=True, text=True).stdout


def needed_of(path):
    """DT_NEEDED entries, or None when the file has no dynamic section.

    proot's loader is deliberately statically linked -- it has to run before
    any dynamic loader exists -- so "no dynamic section" is the correct answer
    for it, not an error.
    """
    try:
        return sh("patchelf", "--print-needed", path).split()
    except subprocess.CalledProcessError:
        return None

def fetch(lock, abi):
    out = os.path.join(PROJECT, "app", "src", "main", "jniLibs", abi)
    os.makedirs(out, exist_ok=True)
    stage = os.path.join(WORK, abi)
    shutil.rmtree(stage, ignore_errors=True)
    os.makedirs(stage)

    for pkg in lock["abis"][abi]["packages"]:
        deb = os.path.join(stage, os.path.basename(pkg["filename"]))
        url = f"{lock['repository']}/{pkg['filename']}"
        print(f"  fetch {pkg['package']} {pkg['version']}")
        urllib.request.urlretrieve(url, deb)
        got = hashlib.sha256(open(deb, "rb").read()).hexdigest()
        if got != pkg["sha256"]:
            sys.exit(f"SHA-256 mismatch for {pkg['package']}: {got} != {pkg['sha256']}")
        subprocess.run(["ar", "x", deb], cwd=stage, check=True)
        data = next(f for f in os.listdir(stage) if f.startswith("data.tar"))
        with tarfile.open(os.path.join(stage, data)) as t:
            t.extractall(os.path.join(stage, "root"), filter="tar")
        os.remove(os.path.join(stage, data))
        for leftover in ("control.tar.xz", "control.tar.gz", "debian-binary"):
            p = os.path.join(stage, leftover)
            if os.path.exists(p):
                os.remove(p)

    produced = {}
    for src, name in MAP.items():
        p = os.path.join(stage, "root", PREFIX, src)
        if not os.path.isfile(p):
            sys.exit(f"missing {src} in extracted packages")
        dst = os.path.join(out, name)
        shutil.copy2(p, dst)
        os.chmod(dst, 0o755)
        produced[name] = dst
    return out, produced, stage

def legal_name(soname):
    """A name Android will actually extract into nativeLibraryDir.

    Only `lib*.so` survives packaging, so `libbusybox.so.1.38.0` has to become
    something like `libbusybox_1_38_0.so` -- and every DT_NEEDED pointing at
    the old name has to follow, or the loader searches for a file that was
    never unpacked.
    """
    base = soname
    if base.endswith(".so"):
        return base
    stem, _, rest = base.partition(".so")
    return stem + rest.replace(".", "_") + ".so"


def resolve(stage, out, produced):
    """Pull in every library the produced binaries still need, transitively.

    Doing this by hand is how a missing transitive dependency reaches a user's
    phone as "proot: not found". The loop instead keeps asking the binaries
    themselves what they want until nothing is left unanswered.
    """
    libdirs = [
        os.path.join(stage, "root", PREFIX, "usr", "lib"),
        os.path.join(stage, "root", PREFIX, "usr", "libexec"),
    ]
    renames = {}
    for src, name in MAP.items():
        original = os.path.basename(src)
        if original != name:
            renames[original] = name

    changed = True
    while changed:
        changed = False
        for name in list(produced):
            for dep in needed_of(produced[name]) or []:
                if dep in SYSTEM_LIBS or dep in renames or dep in produced:
                    continue
                found = next(
                    (os.path.join(d, dep) for d in libdirs if os.path.isfile(os.path.join(d, dep))),
                    None,
                )
                if not found:
                    continue
                target_name = legal_name(dep)
                dst = os.path.join(out, target_name)
                shutil.copy2(found, dst)
                os.chmod(dst, 0o755)
                produced[target_name] = dst
                if target_name != dep:
                    renames[dep] = target_name
                print(f"    + pulled in {dep} as {target_name}")
                changed = True
    return renames


def patch(produced, renames):
    """Rewrite SONAME and DT_NEEDED so the renamed files still resolve."""
    for name, path in produced.items():
        if needed_of(path) is None:
            continue  # statically linked: nothing to rewrite
        try:
            sh("patchelf", "--set-soname", name, path)
        except subprocess.CalledProcessError:
            pass  # an executable, not a shared object
        for old, new in renames.items():
            if old in (needed_of(path) or []):
                sh("patchelf", "--replace-needed", old, new, path)
        # Termux builds carry a RUNPATH into /data/data/com.termux/... which
        # does not exist here; LD_LIBRARY_PATH points at nativeLibraryDir and
        # must be what wins.
        try:
            sh("patchelf", "--remove-rpath", path)
        except subprocess.CalledProcessError:
            pass


def verify(out, produced):
    print("\n  verification")
    present = set(os.listdir(out))
    ok = True
    for name, path in sorted(produced.items()):
        needed = needed_of(path)
        if needed is None:
            print(f"    ok  {name:26} {os.path.getsize(path):>9,} B   static")
            continue
        unresolved = [n for n in needed if n not in present and n not in SYSTEM_LIBS]
        size = os.path.getsize(path)
        mark = "ok " if not unresolved else "MISSING"
        print(f"    {mark} {name:26} {size:>9,} B   needs: {' '.join(needed) or '-'}")
        if unresolved:
            print(f"         unresolved: {unresolved}")
            ok = False
    return ok

def main():
    lock = json.load(open(os.path.join(ROOT, "native.lock.json")))
    all_ok = True
    checksums = {}
    for abi in lock["abis"]:
        print(f"\n[{abi}]")
        out, produced, stage = fetch(lock, abi)
        renames = resolve(stage, out, produced)
        patch(produced, renames)
        all_ok &= verify(out, produced)
        checksums[abi] = {
            n: hashlib.sha256(open(p, "rb").read()).hexdigest()
            for n, p in sorted(produced.items())
        }
    lock["produced"] = checksums
    with open(os.path.join(ROOT, "native.lock.json"), "w") as f:
        json.dump(lock, f, indent=2)
        f.write("\n")
    shutil.rmtree(WORK, ignore_errors=True)
    print("\n" + ("all dependencies resolve" if all_ok else "UNRESOLVED DEPENDENCIES"))
    sys.exit(0 if all_ok else 1)

main()
