package com.genius.tvhub.engine.files

import android.content.Context
import com.genius.tvhub.engine.files.guard.PathGuard
import com.genius.tvhub.engine.files.ops.FileOps
import com.genius.tvhub.engine.files.roots.RootsProvider
import com.genius.tvhub.engine.files.transfer.TransferManager

/** The files engine: its four parts, wired once. */
class FilesEngine(context: Context) {
    val roots = RootsProvider(context)
    val guard = PathGuard(roots::dirs)
    val ops = FileOps(guard)
    val transfers = TransferManager(guard)
}
