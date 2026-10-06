#!/usr/bin/env bash
# Cross-compiles the native engines for Android arm64 and stages them into
# engine/host/src/main/jniLibs/arm64-v8a, where Gradle packs them into the APK.
#
#   scripts/build-native.sh            # Release build
#   BUILD_TYPE=Debug scripts/build-native.sh
#
# Needs: the Android NDK (ANDROID_NDK_HOME, or the newest under $ANDROID_HOME/ndk), cmake, ninja,
# and the submodules (git submodule update --init --recursive).
#
# Every engine is an executable, shipped as lib*.so: Android only lets an app exec files from its
# nativeLibraryDir, and only lib*.so files are extracted there. The app runs them with
# ProcessBuilder (engine/host/RunnerProcess.kt) — no JNI.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ABI=arm64-v8a
API_LEVEL=29
BUILD_TYPE="${BUILD_TYPE:-Release}"
OUT="$ROOT/build-native"
JNI="$ROOT/engine/host/src/main/jniLibs/$ABI"

find_ndk() {
  if [[ -n "${ANDROID_NDK_HOME:-}" && -d "$ANDROID_NDK_HOME" ]]; then echo "$ANDROID_NDK_HOME"; return; fi
  local sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
  local latest
  latest="$(ls -1d "$sdk"/ndk/*/ 2>/dev/null | sort -V | tail -1 || true)"
  [[ -n "$latest" ]] || { echo "Android NDK not found: set ANDROID_NDK_HOME" >&2; exit 1; }
  echo "${latest%/}"
}

NDK="$(find_ndk)"
echo "NDK: $NDK"

BMOE="$ROOT/third_party/bigmoeonedge"
[[ -f "$BMOE/third_party/llama.cpp/CMakeLists.txt" ]] || {
  echo "submodules missing: git submodule update --init --recursive" >&2; exit 1;
}

# ── text: BigMoeOnEdge (bmoe-cli + its llama.cpp fork) ──
# CPU target armv8.2-a+dotprod+fp16, deliberately not i8mm: an i8mm build SIGILLs on pre-2021 SoCs,
# and ggml's runtime CPU dispatch would split the backend into dlopen'd variants, which drops the
# fork's statically linked expert-ready hook (the I/O–compute overlap). Same choice as upstream's
# scripts/build-android.ps1.
cmake -S "$BMOE" -B "$OUT/bmoe" -G Ninja \
  -DCMAKE_TOOLCHAIN_FILE="$NDK/build/cmake/android.toolchain.cmake" \
  -DANDROID_ABI="$ABI" \
  -DANDROID_PLATFORM="android-$API_LEVEL" \
  -DCMAKE_BUILD_TYPE="$BUILD_TYPE" \
  -DBMOE_BUILD_TESTS=OFF \
  -DBMOE_BUILD_TOOLS=ON \
  -DGGML_NATIVE=OFF \
  -DGGML_OPENCL=OFF \
  -DGGML_OPENMP=OFF \
  -DGGML_CPU_ARM_ARCH="armv8.2-a+dotprod+fp16" \
  -DLLAMA_CURL=OFF
cmake --build "$OUT/bmoe" -j "$(nproc)" --target bmoe-cli bmoe-iobench bmoe-membench

# ── stage ──
# The list is explicit and the directory is wiped first, so a stray library from an old build
# can never ride along into an APK unnoticed.
mkdir -p "$JNI"
rm -f "$JNI"/*.so

install -m 755 "$OUT/bmoe/cli/bmoe-cli" "$JNI/libimlaq_text.so"
install -m 755 "$OUT/bmoe/tools/bmoe-iobench" "$JNI/libimlaq_iobench.so"
install -m 755 "$OUT/bmoe/tools/bmoe-membench" "$JNI/libimlaq_membench.so"

for lib in libggml.so libggml-base.so libggml-cpu.so libllama.so libllama-common.so; do
  src="$(find "$OUT/bmoe" -name "$lib" -print -quit)"
  [[ -n "$src" ]] || { echo "$lib not found in $OUT/bmoe" >&2; exit 1; }
  install -m 644 "$src" "$JNI/$lib"
done

# The engines link the c++_shared STL; its runtime lives in the NDK sysroot, not the build tree.
STL="$(find "$NDK/toolchains/llvm/prebuilt" -path "*aarch64-linux-android/libc++_shared.so" -print -quit)"
install -m 644 "$STL" "$JNI/libc++_shared.so"

# Strip symbols: the APK carries every byte of these, and the users' phones store them.
STRIP="$(find "$NDK/toolchains/llvm/prebuilt" -name llvm-strip -print -quit)"
for so in "$JNI"/*.so; do "$STRIP" --strip-unneeded "$so"; done

# 16 KB page alignment: required on Android 15+ devices with 16 KB pages, and by Google Play.
READELF="$(find "$NDK/toolchains/llvm/prebuilt" -name llvm-readelf -print -quit)"
for so in "$JNI"/*.so; do
  align="$("$READELF" -lW "$so" | awk '$1=="LOAD"{print $NF; exit}')"
  if [[ "$align" != "0x4000" && "$align" != "0x10000" ]]; then
    echo "warning: $(basename "$so") LOAD alignment $align (want >= 0x4000)" >&2
  fi
done

echo "Staged into $JNI:"
ls -la "$JNI"
