package com.genius.imlaq.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.genius.imlaq.AppContainer
import com.genius.imlaq.common.Bytes
import com.genius.imlaq.device.DeviceProfile
import com.genius.imlaq.engine.host.Runner
import com.genius.imlaq.memory.MemoryPolicy
import com.genius.imlaq.memory.MemoryPressure
import com.genius.imlaq.models.LocalModel
import com.genius.imlaq.models.SpeedEstimate
import com.genius.imlaq.models.SpeedEstimator
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class ModelRow(val model: LocalModel, val estimate: SpeedEstimate?)

data class HomeState(
    val loading: Boolean = true,
    val profile: DeviceProfile? = null,
    val reserve: Bytes = Bytes.ZERO,
    val budget: Bytes = Bytes.ZERO,
    val textEngineBundled: Boolean = false,
    val modelsDir: String = "",
    val models: List<ModelRow> = emptyList(),
)

class HomeViewModel(private val container: AppContainer) : ViewModel() {

    private val _state = MutableStateFlow(HomeState())
    val state: StateFlow<HomeState> = _state

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _state.value = withContext(Dispatchers.IO) { load() }
        }
    }

    private fun load(): HomeState {
        val profile = container.deviceProfiler.profile(container.modelsDir)
        val policy = MemoryPolicy.defaultFor(profile.memory.total)
        val budget = container.memoryPlanner.budget(profile.memory, policy, MemoryPressure.NORMAL)
        val models = container.modelStore.list().map { m ->
            val estimate = m.summary?.let {
                SpeedEstimator.estimate(it, budget, ASSUMED_FLASH_BYTES_PER_S, ASSUMED_RAM_BYTES_PER_S)
            }
            ModelRow(m, estimate)
        }
        return HomeState(
            loading = false,
            profile = profile,
            reserve = policy.systemReserve,
            budget = budget,
            textEngineBundled = container.runners.isPackaged(Runner.TEXT),
            modelsDir = container.modelsDir.path,
            models = models,
        )
    }

    companion object {
        /**
         * Placeholders until the device benchmark runs (docs/PLAN.md, phase 1): a mid-range
         * UFS 3.1/4.0 read figure and LPDDR5-class bandwidth. The UI says so next to the number.
         */
        const val ASSUMED_FLASH_BYTES_PER_S = 2.0e9
        const val ASSUMED_RAM_BYTES_PER_S = 50.0e9
    }
}
