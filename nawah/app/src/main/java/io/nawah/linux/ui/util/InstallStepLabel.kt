package io.nawah.linux.ui.util

import androidx.annotation.StringRes
import io.nawah.linux.R
import io.nawah.linux.core.provision.InstallStep

/**
 * The user-facing name of an install step.
 *
 * `:core` has no resources — it is deliberately a pure-logic module — so the
 * step's own `label` is English and can only ever be English. Everything the
 * user reads resolves through here instead, or the whole install screen stays
 * in English on an Arabic phone.
 */
@get:StringRes
val InstallStep.labelRes: Int
    get() = when (this) {
        InstallStep.DOWNLOADING -> R.string.install_step_downloading
        InstallStep.VERIFYING -> R.string.install_step_verifying
        InstallStep.EXTRACTING -> R.string.install_step_extracting
        InstallStep.BOOTSTRAPPING -> R.string.install_step_bootstrapping
        InstallStep.INSTALLING_PACKAGES -> R.string.install_step_packages
        InstallStep.INSTALLING_X11_BRIDGE -> R.string.install_step_scripts
        InstallStep.CONFIGURING -> R.string.install_step_configuring
    }
