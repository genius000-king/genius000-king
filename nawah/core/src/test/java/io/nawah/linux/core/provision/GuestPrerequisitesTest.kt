package io.nawah.linux.core.provision

import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

/**
 * Two packages whose absence the X server reports in a way nobody can act on.
 *
 * `xfonts-base` is the one that got away: the server prints `could not open
 * default font` and exits, which arrives in the app as a black screen. Neither
 * failure names a package, so the app has to name it instead.
 */
class GuestPrerequisitesTest {

    @get:Rule val tmp = TemporaryFolder()

    private fun rootfs(vararg markers: String): File =
        tmp.newFolder("rootfs-${System.nanoTime()}").also { root ->
            markers.forEach { File(root, it).apply { parentFile?.mkdirs(); mkdirs() } }
        }

    private val complete = arrayOf(
        "usr/share/X11/xkb/rules",
        "usr/share/fonts/X11/misc/fonts.dir",
    )

    @Test
    fun `a complete machine needs nothing`() {
        assertThat(GuestPrerequisites.missing(rootfs(*complete))).isEmpty()
    }

    @Test
    fun `a machine from an older build is missing the fonts`() {
        // Exactly the state of a machine installed before xfonts-base entered
        // the base list. It must not be told to reinstall Debian.
        val root = rootfs("usr/share/X11/xkb/rules")

        assertThat(GuestPrerequisites.missing(root)).containsExactly("xfonts-base")
    }

    @Test
    fun `an empty machine is missing both, in install order`() {
        assertThat(GuestPrerequisites.missing(rootfs()))
            .containsExactly("xkb-data", "xfonts-base").inOrder()
    }

    @Test
    fun `unpacked but unconfigured fonts still count as missing`() {
        // dpkg unpacks the .pcf files; a maintainer script builds fonts.dir.
        // A rootfs where that script did not run has a font directory full of
        // fonts and no way to open any of them.
        val root = rootfs("usr/share/X11/xkb/rules", "usr/share/fonts/X11/misc")

        assertThat(GuestPrerequisites.missing(root)).containsExactly("xfonts-base")
    }

    @Test
    fun `every package has a reason written for the log`() {
        for (name in GuestPrerequisites.missing(rootfs())) {
            assertThat(GuestPrerequisites.reason(name)).isNotEmpty()
        }
    }

    @Test
    fun `the install command retries behind an update rather than always updating`() {
        val command = GuestPrerequisites.installCommand(listOf("xfonts-base"))

        assertThat(command).startsWith("DEBIAN_FRONTEND=noninteractive apt-get install")
        assertThat(command).contains("|| { apt-get update &&")
        assertThat(command).contains("--no-install-recommends xfonts-base")
    }

    @Test
    fun `the font path names only directories that carry a fonts dir`() {
        val root = tmp.newFolder("fp")
        File(root, "usr/share/fonts/X11/misc").mkdirs()
        File(root, "usr/share/fonts/X11/misc/fonts.dir").writeText("0\n")
        // Present but unusable: no fonts.dir. Naming it would give the server
        // a font path entry it cannot read.
        File(root, "usr/share/fonts/X11/100dpi").mkdirs()

        val path = GuestPrerequisites.fontPath(root)

        assertThat(path).isNotNull()
        assertThat(path!!).endsWith("/usr/share/fonts/X11/misc")
        assertThat(path).doesNotContain("100dpi")
    }

    @Test
    fun `a machine with no usable font directory gets no font path at all`() {
        // Better than a path the server will reject: the launch says so, and
        // the prerequisite check has already offered to fix it.
        assertThat(GuestPrerequisites.fontPath(rootfs())).isNull()
    }

    @Test
    fun `font directories are listed in the server's own order`() {
        val root = tmp.newFolder("fp2")
        for (dir in listOf("misc", "100dpi", "75dpi")) {
            File(root, "usr/share/fonts/X11/$dir").mkdirs()
            File(root, "usr/share/fonts/X11/$dir/fonts.dir").writeText("0\n")
        }

        val parts = GuestPrerequisites.fontPath(root)!!.split(",").map { it.substringAfterLast('/') }

        assertThat(parts).containsExactly("misc", "100dpi", "75dpi").inOrder()
    }
}
