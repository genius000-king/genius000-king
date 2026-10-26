package com.genius.tvhub.feature.tv.system

import androidx.compose.runtime.Immutable
import com.genius.tvhub.core.model.AppLanguage
import com.genius.tvhub.core.model.Grant
import com.genius.tvhub.core.model.Grants
import com.genius.tvhub.core.model.HubSettings
import com.genius.tvhub.core.model.ServiceState

enum class Section { INTERFACE, PHONES, SETUP, SYSTEM, SERVICES, ABOUT }

enum class SetupKind { ADB, ACCESSIBILITY, INSTALL, FILES, HOME }

/** Where ADB mode stands, for the line under its setup item. */
enum class AdbNote { CONNECTING, APPROVE_ON_TV, PORT_CLOSED, NOT_APPROVED, FAILED }

@Immutable data class PhoneRow(val id: String, val name: String, val model: String, val grants: Grants, val connected: Boolean)

@Immutable data class SetupItem(val kind: SetupKind, val done: Boolean, val note: AdbNote? = null)

@Immutable data class ServiceRow(val name: String, val state: ServiceState)

@Immutable
data class SystemState(
    val settings: HubSettings = HubSettings(),
    val phones: List<PhoneRow> = emptyList(),
    val setup: List<SetupItem> = emptyList(),
    val services: List<ServiceRow> = emptyList(),
    val version: String = "",
    val fingerprint: String = "",
    val address: String = "",
)

interface SystemActions {
    fun update(change: (HubSettings) -> HubSettings)
    fun setGrant(phoneId: String, grant: Grant, on: Boolean)
    fun revoke(phoneId: String)
    fun openSetup(kind: SetupKind)
    fun setLanguage(language: AppLanguage)
}
