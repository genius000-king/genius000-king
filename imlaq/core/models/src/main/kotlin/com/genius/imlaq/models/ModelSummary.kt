package com.genius.imlaq.models

import com.genius.imlaq.common.Bytes

enum class ModelKind {
    /** Mixture-of-Experts chat model: only a few experts run per token, so it can stream. */
    TEXT_MOE,

    /** Dense chat model: every weight runs every token. */
    TEXT_DENSE,

    /** A vision projector (llama.cpp "mmproj"); pairs with a text model to read images. */
    VISION_PROJECTOR,

    OTHER,
}

/**
 * What the app knows about a model from its header alone.
 *
 * The split that matters for "storage as RAM" is [denseBytes] vs [expertBytes]: dense weights
 * run every token and must stay in RAM; expert weights run a few at a time and can live on flash.
 */
data class ModelSummary(
    val kind: ModelKind,
    val architecture: String,
    val name: String?,
    val expertCount: Int,
    val expertUsedCount: Int,
    val blockCount: Int,
    val contextLength: Int,
    val totalBytes: Bytes,
    val expertBytes: Bytes,
    val denseBytes: Bytes,
) {
    /** What the model does, from its architecture. */
    val type: ModelType get() = ModelTypes.fromGguf(architecture, kind)

    /** Weights touched per token, assuming routing spreads evenly over the experts. */
    val activeBytesPerToken: Bytes
        get() = if (expertCount > 0 && expertUsedCount > 0) {
            denseBytes + expertBytes * (expertUsedCount.toDouble() / expertCount)
        } else {
            totalBytes
        }

    companion object {
        /** MoE expert tensors are named `blk.N.ffn_{gate,up,down,gate_up}_exps.weight`. */
        fun isExpertTensor(name: String) = name.contains("_exps.")

        /** Summarises one model from the headers of all its shards (first shard first). */
        fun from(shards: List<GgufHeader>): ModelSummary {
            require(shards.isNotEmpty())
            val head = shards.first()
            val arch = head.string("general.architecture") ?: "unknown"
            fun archInt(key: String) = head.long("$arch.$key")?.toInt() ?: 0

            var expert = 0L
            var dense = 0L
            for (shard in shards) {
                for ((name, size) in shard.tensorSizes()) {
                    if (isExpertTensor(name)) expert += size else dense += size
                }
            }

            val experts = archInt("expert_count")
            val kind = when {
                arch == "clip" -> ModelKind.VISION_PROJECTOR
                experts > 0 && expert > 0 -> ModelKind.TEXT_MOE
                head.long("$arch.block_count") != null -> ModelKind.TEXT_DENSE
                else -> ModelKind.OTHER
            }

            return ModelSummary(
                kind = kind,
                architecture = arch,
                name = head.string("general.name"),
                expertCount = experts,
                expertUsedCount = archInt("expert_used_count"),
                blockCount = archInt("block_count"),
                contextLength = archInt("context_length"),
                totalBytes = Bytes(expert + dense),
                expertBytes = Bytes(expert),
                denseBytes = Bytes(dense),
            )
        }
    }
}
