package com.genius.tvhub.e2e

import com.genius.tvhub.runtime.host.*

import com.genius.tvhub.core.model.DeviceRole
import com.genius.tvhub.core.model.Grant
import com.genius.tvhub.core.model.Grants
import com.genius.tvhub.core.model.HostStatus
import com.genius.tvhub.core.model.KeyAction
import com.genius.tvhub.core.model.NormPoint
import com.genius.tvhub.core.model.PeerInfo
import com.genius.tvhub.core.model.RemotePath
import com.genius.tvhub.core.model.ShellBackend
import com.genius.tvhub.core.protocol.Call
import com.genius.tvhub.core.protocol.ErrorCode
import com.genius.tvhub.core.protocol.RemoteException
import com.genius.tvhub.core.protocol.Reply
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import org.junit.Test

class CallRouterTest {
    private val tv = FakeTv()
    private var grants = Grants.DEFAULT
    private val router = CallRouter(tv.ports, { grants }, { HostStatus(PeerInfo("id", "TV", "m", DeviceRole.TV, "1"), emptyList(), grants, false) }, { 77 })

    private suspend fun code(call: Call) = (runCatching { router.handle(call) }.exceptionOrNull() as RemoteException).code

    @Test fun inputReachesTheEngine() = runTest {
        assertThat(router.handle(Call.Key(KeyAction.HOME))).isEqualTo(Reply.Ok)
        router.handle(Call.Tap(NormPoint(0.5f, 0.25f)))
        assertThat(tv.log).containsExactly("key:HOME", "tap:0.5,0.25").inOrder()
    }

    @Test fun defaultGrantsBlockCommandsUntilTheTvAllowsThem() = runTest {
        assertThat(code(Call.RunCommand(ShellBackend.SANDBOX, "id"))).isEqualTo(ErrorCode.DENIED)
        assertThat(code(Call.ListServices)).isEqualTo(ErrorCode.DENIED)
        grants = grants + Grant.SHELL
        val r = router.handle(Call.RunCommand(ShellBackend.SANDBOX, "id")) as Reply.Command
        assertThat(r.result.stdout).isEqualTo("ran id")
    }

    @Test fun revokedGrantAppliesToTheNextCall() = runTest {
        router.handle(Call.ListRoots)
        grants = grants - Grant.FILES_READ
        assertThat(code(Call.ListRoots)).isEqualTo(ErrorCode.DENIED)
        assertThat(code(Call.ListDir(RemotePath("app")))).isEqualTo(ErrorCode.DENIED)
    }

    @Test fun sessionCallsNeedNoGrant() = runTest {
        grants = Grants.NONE
        assertThat((router.handle(Call.Ping(5)) as Reply.Pong).receivedAt).isEqualTo(77)
        assertThat(router.handle(Call.GetStatus)).isInstanceOf(Reply.Status::class.java)
    }

    @Test fun accessibilityOffIsExplained() = runTest {
        tv.inputReady = false
        val e = runCatching { router.handle(Call.Key(KeyAction.UP)) }.exceptionOrNull() as RemoteException
        assertThat(e.code).isEqualTo(ErrorCode.UNAVAILABLE)
        assertThat(e.message).contains("accessibility")
    }

    @Test fun appsAndMissingApps() = runTest {
        assertThat((router.handle(Call.ListApps) as Reply.Apps).apps.map { it.packageName }).containsExactly("yt", "brave")
        assertThat(code(Call.LaunchApp("missing"))).isEqualTo(ErrorCode.NOT_FOUND)
        assertThat(router.handle(Call.LaunchApp("yt"))).isEqualTo(Reply.Ok)
    }
}
