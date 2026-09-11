package io.nawah.linux.core.runtime

/**
 * One fake `/proc` or `/sys` entry proot bind-mounts into the guest.
 *
 * @property fileName name under `<containerDir>/sysdata/`
 * @property guestPath the path inside the guest it substitutes for
 * @property content the exact bytes written, copied from proot-distro 5.8.0
 */
data class SysDataStub(
    val fileName: String,
    val guestPath: String,
    val content: String,
)

/**
 * Static replacements for the `/proc` and `/sys` files Android does not let an
 * app read.
 *
 * ### Why this exists at all
 * Android blocks or empties `/proc/stat`, `/proc/version`, `/proc/loadavg`,
 * `/proc/uptime`, `/proc/vmstat` and several `/proc/sys` knobs for ordinary
 * apps (the `hidepid`-style restrictions introduced around Android 9). A Debian
 * userland reads them constantly: `top`, `htop`, `systemd-detect-virt`, glibc's
 * own `sysconf`, and — the one that actually stops an install — `apt`, whose
 * sandbox setup consults `/proc/sys/kernel/overflowuid`. A blocked read surfaces
 * as `EACCES` in places whose error messages never mention `/proc`.
 *
 * So we write plausible static files into the container's own `sysdata/`
 * directory and bind each one over its real path. The numbers are *copied
 * verbatim from proot-distro 5.8.0's `sysdata.py`* rather than invented: they
 * are internally consistent (the per-CPU lines in `stat` sum to the aggregate
 * line, `vmstat` counters agree with each other), and tools that cross-check
 * them will not trip.
 *
 * `sys_empty` is a genuinely empty directory bound over `/sys/fs/selinux`,
 * which makes the guest conclude SELinux is absent instead of finding
 * Android's policy and refusing to run.
 *
 * The stubs live beside the rootfs and never inside it, so removing a machine
 * removes them, and a guest process cannot reach them through its own `/`.
 */
object SysData {
    /** Directory name bound over `/sys/fs/selinux` to hide Android's policy. */
    const val SYS_EMPTY_DIR: String = "sys_empty"

    /** Guest path [SYS_EMPTY_DIR] is mounted at. */
    const val SELINUX_GUEST_PATH: String = "/sys/fs/selinux"

    /**
     * Default fake kernel release reported through `uname -r`.
     *
     * A guest that reads Android's real release string sees something like
     * `5.10.101-android12-9-...`, and Debian packages that parse it (dkms,
     * some installer scripts) fail on the vendor suffix. proot's
     * `--kernel-release` extension is the fix; the value below is the one the
     * Nawah plan settled on.
     */
    const val DEFAULT_KERNEL_RELEASE: String = "6.2.1"

    /** Default fake kernel version string, shape copied from proot-distro. */
    const val DEFAULT_KERNEL_VERSION: String =
        "#1 SMP PREEMPT_DYNAMIC Fri, 10 Oct 2025 00:00:00 +0000"

    /** `uname -m` value; the only ABI we ship proot binaries for. */
    const val DEFAULT_UNAME_MACHINE: String = "aarch64"

    /**
     * The stubs, in the order proot-distro writes and binds them.
     *
     * Order is part of the contract with the golden argv test: a stable argv is
     * a diffable argv.
     *
     * @param kernelRelease value also passed to `--kernel-release`, so
     *   `/proc/version` and `uname -r` cannot disagree.
     */
    fun stubs(
        kernelRelease: String = DEFAULT_KERNEL_RELEASE,
        kernelVersion: String = DEFAULT_KERNEL_VERSION,
    ): List<SysDataStub> = listOf(
        SysDataStub("loadavg", "/proc/loadavg", FAKE_LOADAVG),
        SysDataStub("stat", "/proc/stat", FAKE_STAT),
        SysDataStub("uptime", "/proc/uptime", FAKE_UPTIME),
        SysDataStub("version", "/proc/version", fakeVersion(kernelRelease, kernelVersion)),
        SysDataStub("vmstat", "/proc/vmstat", FAKE_VMSTAT),
        SysDataStub(
            "sysctl_entry_cap_last_cap",
            "/proc/sys/kernel/cap_last_cap",
            "40\n",
        ),
        SysDataStub(
            "sysctl_inotify_max_user_watches",
            "/proc/sys/fs/inotify/max_user_watches",
            "4096\n",
        ),
        SysDataStub(
            "sysctl_kernel_overflowuid",
            "/proc/sys/kernel/overflowuid",
            FAKE_OVERFLOW_ID,
        ),
        SysDataStub(
            "sysctl_kernel_overflowgid",
            "/proc/sys/kernel/overflowgid",
            FAKE_OVERFLOW_ID,
        ),
    )

    /**
     * `/proc/version` in the exact shape Linux prints it, with our own release
     * and build host substituted in.
     */
    private fun fakeVersion(kernelRelease: String, kernelVersion: String): String =
        "Linux version $kernelRelease (proot@nawah) " +
            "(gcc (GCC) 13.3.0, GNU ld (GNU Binutils) 2.42) " +
            "$kernelVersion\n"
}

// ---------------------------------------------------------------------------
// Content below is copied byte for byte from proot-distro 5.8.0 sysdata.py.
// Do not "tidy" the numbers: they are mutually consistent and tools read them.
// ---------------------------------------------------------------------------

private const val FAKE_LOADAVG: String =
    "0.12 0.07 0.02 2/165 765\n"

private const val FAKE_UPTIME: String =
    "124.08 932.80\n"

private const val FAKE_OVERFLOW_ID: String =
    "65534\n"

private const val FAKE_STAT: String =
    "cpu  1957 0 2877 93280 262 342 254 87 0 0\n" +
    "cpu0 31 0 226 12027 82 10 4 9 0 0\n" +
    "cpu1 45 0 664 11144 21 263 233 12 0 0\n" +
    "cpu2 494 0 537 11283 27 10 3 8 0 0\n" +
    "cpu3 359 0 234 11723 24 26 5 7 0 0\n" +
    "cpu4 295 0 268 11772 10 12 2 12 0 0\n" +
    "cpu5 270 0 251 11833 15 3 1 10 0 0\n" +
    "cpu6 430 0 520 11386 30 8 1 12 0 0\n" +
    "cpu7 30 0 172 12108 50 8 1 13 0 0\n" +
    "intr 127541 38 290 0 0 0 0 4 0 1 0 0 25329 258 0 5777 277 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0\n" +
    "ctxt 140223\n" +
    "btime 1680020856\n" +
    "processes 772\n" +
    "procs_running 2\n" +
    "procs_blocked 0\n" +
    "softirq 75663 0 5903 6 25375 10774 0 243 11685 0 21677\n"

private const val FAKE_VMSTAT: String =
    "nr_free_pages 1743136\n" +
    "nr_zone_inactive_anon 179281\n" +
    "nr_zone_active_anon 7183\n" +
    "nr_zone_inactive_file 22858\n" +
    "nr_zone_active_file 51328\n" +
    "nr_zone_unevictable 642\n" +
    "nr_zone_write_pending 0\n" +
    "nr_mlock 0\n" +
    "nr_bounce 0\n" +
    "nr_zspages 0\n" +
    "nr_free_cma 0\n" +
    "numa_hit 1259626\n" +
    "numa_miss 0\n" +
    "numa_foreign 0\n" +
    "numa_interleave 720\n" +
    "numa_local 1259626\n" +
    "numa_other 0\n" +
    "nr_inactive_anon 179281\n" +
    "nr_active_anon 7183\n" +
    "nr_inactive_file 22858\n" +
    "nr_active_file 51328\n" +
    "nr_unevictable 642\n" +
    "nr_slab_reclaimable 8091\n" +
    "nr_slab_unreclaimable 7804\n" +
    "nr_isolated_anon 0\n" +
    "nr_isolated_file 0\n" +
    "workingset_nodes 0\n" +
    "workingset_refault_anon 0\n" +
    "workingset_refault_file 0\n" +
    "workingset_activate_anon 0\n" +
    "workingset_activate_file 0\n" +
    "workingset_restore_anon 0\n" +
    "workingset_restore_file 0\n" +
    "workingset_nodereclaim 0\n" +
    "nr_anon_pages 7723\n" +
    "nr_mapped 8905\n" +
    "nr_file_pages 253569\n" +
    "nr_dirty 0\n" +
    "nr_writeback 0\n" +
    "nr_writeback_temp 0\n" +
    "nr_shmem 178741\n" +
    "nr_shmem_hugepages 0\n" +
    "nr_shmem_pmdmapped 0\n" +
    "nr_file_hugepages 0\n" +
    "nr_file_pmdmapped 0\n" +
    "nr_anon_transparent_hugepages 1\n" +
    "nr_vmscan_write 0\n" +
    "nr_vmscan_immediate_reclaim 0\n" +
    "nr_dirtied 0\n" +
    "nr_written 0\n" +
    "nr_throttled_written 0\n" +
    "nr_kernel_misc_reclaimable 0\n" +
    "nr_foll_pin_acquired 0\n" +
    "nr_foll_pin_released 0\n" +
    "nr_kernel_stack 2780\n" +
    "nr_page_table_pages 344\n" +
    "nr_sec_page_table_pages 0\n" +
    "nr_swapcached 0\n" +
    "pgpromote_success 0\n" +
    "pgpromote_candidate 0\n" +
    "nr_dirty_threshold 356564\n" +
    "nr_dirty_background_threshold 178064\n" +
    "pgpgin 890508\n" +
    "pgpgout 0\n" +
    "pswpin 0\n" +
    "pswpout 0\n" +
    "pgalloc_dma 272\n" +
    "pgalloc_dma32 261\n" +
    "pgalloc_normal 1328079\n" +
    "pgalloc_movable 0\n" +
    "pgalloc_device 0\n" +
    "allocstall_dma 0\n" +
    "allocstall_dma32 0\n" +
    "allocstall_normal 0\n" +
    "allocstall_movable 0\n" +
    "allocstall_device 0\n" +
    "pgskip_dma 0\n" +
    "pgskip_dma32 0\n" +
    "pgskip_normal 0\n" +
    "pgskip_movable 0\n" +
    "pgskip_device 0\n" +
    "pgfree 3077011\n" +
    "pgactivate 0\n" +
    "pgdeactivate 0\n" +
    "pglazyfree 0\n" +
    "pgfault 176973\n" +
    "pgmajfault 488\n" +
    "pglazyfreed 0\n" +
    "pgrefill 0\n" +
    "pgreuse 19230\n" +
    "pgsteal_kswapd 0\n" +
    "pgsteal_direct 0\n" +
    "pgsteal_khugepaged 0\n" +
    "pgdemote_kswapd 0\n" +
    "pgdemote_direct 0\n" +
    "pgdemote_khugepaged 0\n" +
    "pgscan_kswapd 0\n" +
    "pgscan_direct 0\n" +
    "pgscan_khugepaged 0\n" +
    "pgscan_direct_throttle 0\n" +
    "pgscan_anon 0\n" +
    "pgscan_file 0\n" +
    "pgsteal_anon 0\n" +
    "pgsteal_file 0\n" +
    "zone_reclaim_failed 0\n" +
    "pginodesteal 0\n" +
    "slabs_scanned 0\n" +
    "kswapd_inodesteal 0\n" +
    "kswapd_low_wmark_hit_quickly 0\n" +
    "kswapd_high_wmark_hit_quickly 0\n" +
    "pageoutrun 0\n" +
    "pgrotated 0\n" +
    "drop_pagecache 0\n" +
    "drop_slab 0\n" +
    "oom_kill 0\n" +
    "numa_pte_updates 0\n" +
    "numa_huge_pte_updates 0\n" +
    "numa_hint_faults 0\n" +
    "numa_hint_faults_local 0\n" +
    "numa_pages_migrated 0\n" +
    "pgmigrate_success 0\n" +
    "pgmigrate_fail 0\n" +
    "thp_migration_success 0\n" +
    "thp_migration_fail 0\n" +
    "thp_migration_split 0\n" +
    "compact_migrate_scanned 0\n" +
    "compact_free_scanned 0\n" +
    "compact_isolated 0\n" +
    "compact_stall 0\n" +
    "compact_fail 0\n" +
    "compact_success 0\n" +
    "compact_daemon_wake 0\n" +
    "compact_daemon_migrate_scanned 0\n" +
    "compact_daemon_free_scanned 0\n" +
    "htlb_buddy_alloc_success 0\n" +
    "htlb_buddy_alloc_fail 0\n" +
    "cma_alloc_success 0\n" +
    "cma_alloc_fail 0\n" +
    "unevictable_pgs_culled 27002\n" +
    "unevictable_pgs_scanned 0\n" +
    "unevictable_pgs_rescued 744\n" +
    "unevictable_pgs_mlocked 744\n" +
    "unevictable_pgs_munlocked 744\n" +
    "unevictable_pgs_cleared 0\n" +
    "unevictable_pgs_stranded 0\n" +
    "thp_fault_alloc 13\n" +
    "thp_fault_fallback 0\n" +
    "thp_fault_fallback_charge 0\n" +
    "thp_collapse_alloc 4\n" +
    "thp_collapse_alloc_failed 0\n" +
    "thp_file_alloc 0\n" +
    "thp_file_fallback 0\n" +
    "thp_file_fallback_charge 0\n" +
    "thp_file_mapped 0\n" +
    "thp_split_page 0\n" +
    "thp_split_page_failed 0\n" +
    "thp_deferred_split_page 1\n" +
    "thp_split_pmd 1\n" +
    "thp_scan_exceed_none_pte 0\n" +
    "thp_scan_exceed_swap_pte 0\n" +
    "thp_scan_exceed_share_pte 0\n" +
    "thp_split_pud 0\n" +
    "thp_zero_page_alloc 0\n" +
    "thp_zero_page_alloc_failed 0\n" +
    "thp_swpout 0\n" +
    "thp_swpout_fallback 0\n" +
    "balloon_inflate 0\n" +
    "balloon_deflate 0\n" +
    "balloon_migrate 0\n" +
    "swap_ra 0\n" +
    "swap_ra_hit 0\n" +
    "ksm_swpin_copy 0\n" +
    "cow_ksm 0\n" +
    "zswpin 0\n" +
    "zswpout 0\n" +
    "direct_map_level2_splits 29\n" +
    "direct_map_level3_splits 0\n" +
    "nr_unstable 0\n"

