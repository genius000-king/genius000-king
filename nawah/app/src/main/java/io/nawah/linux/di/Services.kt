package io.nawah.linux.di

import android.content.Context
import io.nawah.linux.BuildConfig
import io.nawah.linux.catalog.Catalog
import io.nawah.linux.core.oci.HttpOciClient
import android.os.Build
import io.nawah.linux.core.oci.OciArch
import io.nawah.linux.core.oci.OciClient
import io.nawah.linux.core.probe.AndroidDeviceProbe
import io.nawah.linux.core.probe.DeviceProbe
import io.nawah.linux.core.provision.ProotProvisioner
import io.nawah.linux.core.provision.Provisioner
import io.nawah.linux.core.runtime.AndroidNativeTools
import io.nawah.linux.core.runtime.NativeTools
import io.nawah.linux.core.runtime.ProcessProotRunner
import io.nawah.linux.core.runtime.ProotRunner
import io.nawah.linux.core.store.FileMachineStore
import io.nawah.linux.core.store.MachineStore
import io.nawah.linux.session.SessionLauncher

/**
 * The object graph, by hand.
 *
 * There are nine singletons and no scopes; a dependency-injection framework
 * would add a build step and an annotation processor to save nine lines.
 */
class Services(context: Context) {

    private val app = context.applicationContext

    val catalog: Catalog by lazy { Catalog.load(app) }
    val nativeTools: NativeTools by lazy { AndroidNativeTools(app) }
    val prootRunner: ProotRunner by lazy { ProcessProotRunner() }
    val machineStore: MachineStore by lazy { FileMachineStore(app.filesDir) }
    val deviceProbe: DeviceProbe by lazy { AndroidDeviceProbe(app, nativeTools, prootRunner) }
    val ociClient: OciClient by lazy { HttpOciClient() }

    val provisioner: Provisioner by lazy {
        ProotProvisioner(
            store = machineStore,
            runner = prootRunner,
            tools = nativeTools,
            oci = ociClient,
            applicationId = BuildConfig.APPLICATION_ID,
            // A device we have no image for is a hard stop, not a silent
            // fallback to the wrong architecture.
            arch = Build.SUPPORTED_ABIS.firstNotNullOfOrNull { OciArch.fromAbi(it) }
                ?: error("no system image is published for ${Build.SUPPORTED_ABIS.joinToString()}"),
            openAsset = { path -> app.assets.open(path) },
        )
    }

    val sessionLauncher: SessionLauncher by lazy {
        SessionLauncher(app, nativeTools, machineStore, prootRunner)
    }
}
