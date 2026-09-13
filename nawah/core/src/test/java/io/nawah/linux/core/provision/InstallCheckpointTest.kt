package io.nawah.linux.core.provision

import com.google.common.truth.Truth.assertThat
import io.nawah.linux.core.model.DesktopSpec
import io.nawah.linux.core.model.LocalizedText
import io.nawah.linux.core.model.DistroSpec
import io.nawah.linux.core.model.MachinePermissions
import io.nawah.linux.core.model.ResourceProfile
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

/**
 * An install is twenty minutes long and the things that interrupt it — a lost
 * connection, the system reclaiming the process — are ordinary. These pin the
 * record that lets the next attempt continue instead of starting over.
 */
class InstallCheckpointTest {

    @get:Rule val tmp = TemporaryFolder()

    private fun request(id: String = "m1") = InstallRequest(
        machineId = id,
        name = "Linux-1",
        distro = DistroSpec(
            id = "debian-trixie", name = "Debian 13", version = "13", codename = "trixie",
            image = "library/debian:trixie", downloadBytes = 49_700_000,
            installedBytes = 125_000_000, aptMirror = "http://deb.debian.org/debian",
        ),
        desktop = DesktopSpec("none", LocalizedText.of("Command line only"), emptyList(), "", 0),
        profile = ResourceProfile.BALANCED,
        permissions = MachinePermissions(),
        displayWidth = 1280,
        displayHeight = 720,
    )

    @Test
    fun `a checkpoint survives a round trip through disk`() {
        val dir = tmp.newFolder("m1")
        val saved = InstallCheckpoint(request())
            .withCompleted(InstallStep.DOWNLOADING)
            .withCompleted(InstallStep.VERIFYING)

        InstallCheckpoint.save(dir, saved)

        assertThat(InstallCheckpoint.load(dir)).isEqualTo(saved)
    }

    @Test
    fun `the request is stored, because a resume happens in another process`() {
        val dir = tmp.newFolder("m2")
        InstallCheckpoint.save(dir, InstallCheckpoint(request("m2")))

        val loaded = InstallCheckpoint.load(dir)

        assertThat(loaded?.request?.distro?.image).isEqualTo("library/debian:trixie")
        assertThat(loaded?.request?.name).isEqualTo("Linux-1")
    }

    @Test
    fun `nextStep is the first one still outstanding`() {
        val c = InstallCheckpoint(request())
            .withCompleted(InstallStep.DOWNLOADING)
            .withCompleted(InstallStep.VERIFYING)

        assertThat(c.nextStep).isEqualTo(InstallStep.EXTRACTING)
    }

    @Test
    fun `nextStep is null once everything is done`() {
        var c = InstallCheckpoint(request())
        InstallStep.ordered.forEach { c = c.withCompleted(it) }

        assertThat(c.nextStep).isNull()
    }

    @Test
    fun `completing a step twice does not duplicate it`() {
        val c = InstallCheckpoint(request())
            .withCompleted(InstallStep.DOWNLOADING)
            .withCompleted(InstallStep.DOWNLOADING)

        assertThat(c.completed).containsExactly(InstallStep.DOWNLOADING)
    }

    @Test
    fun `a missing record simply means there is nothing to resume`() {
        assertThat(InstallCheckpoint.load(tmp.newFolder("empty"))).isNull()
    }

    @Test
    fun `a corrupt record is ignored rather than thrown`() {
        // A process killed mid-write is the expected way this happens, and it
        // must degrade to "start over", never to a crash on the home screen.
        val dir = tmp.newFolder("m3")
        InstallCheckpoint.file(dir).writeText("{ not json")

        assertThat(InstallCheckpoint.load(dir)).isNull()
    }

    @Test
    fun `saving leaves no temporary file behind`() {
        val dir = tmp.newFolder("m4")
        InstallCheckpoint.save(dir, InstallCheckpoint(request()))

        assertThat(dir.list()?.filter { it.endsWith(".tmp") }).isEmpty()
    }

    @Test
    fun `clear removes the record once the install is finished`() {
        val dir = tmp.newFolder("m5")
        InstallCheckpoint.save(dir, InstallCheckpoint(request()))

        InstallCheckpoint.clear(dir)

        assertThat(InstallCheckpoint.load(dir)).isNull()
        assertThat(File(dir, "install-state.json").exists()).isFalse()
    }
}
