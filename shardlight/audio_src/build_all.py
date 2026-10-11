#!/usr/bin/env python3
"""Regenerate the whole Shardlight audio library, deterministically.

    python3 audio_src/build_all.py            # everything (parallel, ~2 min on 4 cores)
    python3 audio_src/build_all.py --jobs 1   # serial
    python3 audio_src/build_all.py --only gen_weapons gen_ui   # just some modules (manifest merged)

Writes game/assets/audio/<category>/<event>[_NN].ogg and game/assets/audio/manifest.json.
All randomness is seeded from CRC32(event name, variant), the Ogg stream serial is pinned,
so two builds are byte-identical.
"""
import argparse
import importlib
import json
import multiprocessing as mp
import os
import shutil
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import toolkit as T  # noqa: E402

OUT = os.path.normpath(os.path.join(HERE, "..", "game", "assets", "audio"))
MODULES = ["gen_music", "gen_ambience", "gen_weapons", "gen_abilities", "gen_pickup", "gen_foley",
           "gen_env", "gen_ui", "gen_npc", "gen_creatures"]
CATEGORIES = ["foley", "weapons", "abilities", "ui", "pickup", "npc", "creatures", "env", "ambience", "music"]

# The event-name CONTRACT (variants per event; 1 = single file, no _NN suffix)
CONTRACT = {}
for _s in ["grass", "stone", "sand", "wood", "metal", "water", "crystal", "snow"]:
    CONTRACT[f"step_{_s}_walk"] = 6
    CONTRACT[f"step_{_s}_run"] = 6
CONTRACT.update({"jump": 3, "land_soft": 3, "land_hard": 3, "dash": 3, "slide": 1, "cloth_move": 4,
                 "plasma_charge_start": 1, "plasma_charge_loop": 1, "plasma_charge_full": 1, "plasma_fire": 3,
                 "plasma_projectile_loop": 1, "plasma_impact": 3, "plasma_vent": 2, "shard_fire": 5,
                 "shard_impact": 4, "pulse_fire": 1, "weapon_switch": 1, "weapon_raise": 1, "dry_click": 1,
                 "lift_activate": 1, "lift_loop": 1, "lift_end": 1, "stasis_cast": 1, "stasis_loop": 1,
                 "stasis_end": 1, "scan_ping": 1, "ability_unlock": 1,
                 "hover": 1, "click": 1, "open": 1, "close": 1, "confirm": 1, "back": 1, "journal_page": 1,
                 "notify": 1, "quest_complete": 1, "typewriter": 6,
                 "echo_pickup": 1, "keystone_pickup": 1, "item_pickup": 1,
                 "talk_blip_low": 8, "talk_blip_mid": 8, "talk_blip_high": 8, "talk_blip_robot": 8,
                 "wisp_idle_loop": 1, "wisp_attack": 1, "wisp_hit": 3, "wisp_death": 1, "puff_chirp": 6, "puff_bounce": 3,
                 "water_loop": 1, "waterfall_loop": 1, "crystal_hum_loop": 1, "loom_hum_loop": 1, "portal_loop": 1,
                 "portal_enter": 1, "windmill_creak": 1,
                 "amb_verdant": 1, "amb_hub": 1, "amb_cave": 1, "amb_amber": 1, "amb_tide": 1, "amb_ember": 1,
                 "amb_glass": 1, "amb_hollow": 1, "bird": 8, "wind_gust": 3,
                 "mus_menu": 1, "mus_hub": 1, "mus_verdant": 1, "mus_tension": 1, "mus_reveal": 1, "mus_keystone": 1})


def run_task(task):
    mod_name, only = task
    t0 = time.time()
    mod = importlib.import_module(mod_name)
    reg = T.Registry(OUT)
    if only is None:
        mod.build(reg)
    else:
        mod.build(reg, only=only)
    return mod_name, only, reg.events, reg.bytes, time.time() - t0


def tasks_for(mods):
    out = []
    for m in mods:
        mod = importlib.import_module(m)
        tl = getattr(mod, "TASKS", None)
        out += [(m, t) for t in tl] if tl else [(m, None)]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--jobs", type=int, default=min(4, os.cpu_count() or 1))
    ap.add_argument("--only", nargs="*", help="generator modules to (re)build; others kept in manifest")
    args = ap.parse_args()
    mods = args.only or MODULES
    t0 = time.time()
    manifest_path = os.path.join(OUT, "manifest.json")
    events = {}
    if args.only and os.path.exists(manifest_path):
        events = json.load(open(manifest_path))
    elif not args.only:
        for cat in CATEGORIES:                       # wipe stale files from earlier builds
            shutil.rmtree(os.path.join(OUT, cat), ignore_errors=True)
    tasks = tasks_for(mods)
    total = 0
    if args.jobs > 1:
        with mp.get_context("fork").Pool(args.jobs) as pool:
            it = pool.imap_unordered(run_task, tasks)
            results = list(it)
    else:
        results = [run_task(t) for t in tasks]
    for mod_name, only, ev, nbytes, dt in results:
        events.update(ev)
        total += nbytes
        print(f"  {mod_name}{':' + only if only else ''}: {len(ev)} events, {nbytes / 1e6:.1f} MB, {dt:.0f}s", flush=True)
    events = dict(sorted(events.items()))
    with open(manifest_path, "w") as f:
        json.dump(events, f, indent=1)
        f.write("\n")
    if not args.only:
        missing = [e for e in CONTRACT if e not in events]
        wrong = [f"{e}: {len(events[e]['files'])} != {n}" for e, n in CONTRACT.items() if e in events and len(events[e]["files"]) != n]
        extra = [e for e in events if e not in CONTRACT]
        if missing or wrong:
            print("CONTRACT VIOLATIONS:", missing, wrong)
            sys.exit(1)
        if extra:
            print("note: events not in contract:", extra)
        print(f"contract ok: {len(CONTRACT)} events")
    print(f"built {len(events)} events in {time.time() - t0:.0f}s; library size {sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(OUT) for f in fs) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
