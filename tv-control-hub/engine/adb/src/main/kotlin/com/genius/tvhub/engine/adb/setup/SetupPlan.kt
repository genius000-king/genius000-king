package com.genius.tvhub.engine.adb.setup

/** One step of the one-time setup, with what it is for (shown to the user if it fails). */
data class SetupStep(val id: StepId, val command: String, val required: Boolean)

enum class StepId { ACCESSIBILITY_LIST, ACCESSIBILITY_ON, SECURE_SETTINGS, OVERLAY, PROJECTION, INSTALLS, HOME_ALIAS, HOME, BATTERY, ADB_PERSIST }

/**
 * What ADB mode changes on the TV, once, so the rest of TV Hub never needs a computer: the
 * accessibility service on, permissions Android otherwise asks for at the TV, and optionally the
 * home screen. Pure: the plan is tested; [com.genius.tvhub.engine.adb.AdbEngine] runs it.
 */
object SetupPlan {
    fun steps(
        pkg: String,
        accessibilityService: String,
        currentServices: String?,
        homeAlias: String?,
    ): List<SetupStep> = buildList {
        val services = mergeServices(currentServices, accessibilityService)
        add(SetupStep(StepId.ACCESSIBILITY_LIST, "settings put secure enabled_accessibility_services ${quote(services)}", required = true))
        add(SetupStep(StepId.ACCESSIBILITY_ON, "settings put secure accessibility_enabled 1", required = true))
        // Lets TV Hub turn its own accessibility back on if Android ever drops it (after updates).
        add(SetupStep(StepId.SECURE_SETTINGS, "pm grant $pkg android.permission.WRITE_SECURE_SETTINGS", required = false))
        add(SetupStep(StepId.OVERLAY, "appops set $pkg SYSTEM_ALERT_WINDOW allow", required = false))
        add(SetupStep(StepId.PROJECTION, "appops set $pkg PROJECT_MEDIA allow", required = false))
        add(SetupStep(StepId.INSTALLS, "appops set $pkg REQUEST_INSTALL_PACKAGES allow", required = false))
        if (homeAlias != null) {
            add(SetupStep(StepId.HOME_ALIAS, "pm enable $homeAlias", required = false))
            add(SetupStep(StepId.HOME, "cmd package set-home-activity $homeAlias", required = false))
        }
        add(SetupStep(StepId.BATTERY, "dumpsys deviceidle whitelist +$pkg", required = false))
        // Most boxes forget network ADB at reboot; this survives where the build allows it.
        add(SetupStep(StepId.ADB_PERSIST, "setprop persist.adb.tcp.port 5555", required = false))
    }

    /** Adds ours to the colon-separated list without dropping anyone else's service. */
    fun mergeServices(current: String?, ours: String): String {
        val list = current.orEmpty().trim().takeUnless { it == "null" }.orEmpty()
            .split(':').map { it.trim() }.filter { it.isNotEmpty() }
        return if (list.any { it.equals(ours, ignoreCase = true) }) list.joinToString(":") else (list + ours).joinToString(":")
    }

    /** Single-quotes for /system/bin/sh. Component names never hold quotes, but be safe anyway. */
    fun quote(s: String) = "'" + s.replace("'", "'\\''") + "'"
}
