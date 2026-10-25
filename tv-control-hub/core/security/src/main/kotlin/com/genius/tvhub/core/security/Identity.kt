package com.genius.tvhub.core.security

import com.genius.tvhub.core.common.sha256
import com.genius.tvhub.core.common.toHex
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.Signature
import java.security.spec.ECGenParameterSpec

/**
 * A device's long-term identity. On Android the private key lives in AndroidKeyStore and never
 * leaves it; [SoftwareIdentityKey] exists for tests and as a fallback.
 */
interface IdentityKey {
    /** X.509 SubjectPublicKeyInfo of an EC P-256 key. */
    val publicKey: ByteArray
    fun sign(data: ByteArray): ByteArray
}

class SoftwareIdentityKey(private val pair: KeyPair) : IdentityKey {
    override val publicKey: ByteArray = pair.public.encoded
    override fun sign(data: ByteArray): ByteArray =
        Signature.getInstance(SIGNATURE_ALGORITHM).run { initSign(pair.private); update(data); sign() }

    companion object {
        fun generate() = SoftwareIdentityKey(Crypto.newEcKeyPair())
    }
}

/** A device id is the SHA-256 of its public key: it cannot be claimed without the private key. */
fun fingerprintOf(publicKey: ByteArray): String = publicKey.sha256().toHex()

/** "a1b2 c3d4" — the first 8 hex digits of a fingerprint, for screens. */
fun shortFingerprint(fingerprint: String): String = fingerprint.take(8).chunked(4).joinToString(" ")

internal const val SIGNATURE_ALGORITHM = "SHA256withECDSA"

internal object Crypto {
    fun newEcKeyPair(): KeyPair = KeyPairGenerator.getInstance("EC").run {
        initialize(ECGenParameterSpec("secp256r1"))
        generateKeyPair()
    }
}
