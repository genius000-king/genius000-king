package com.genius.tvhub.core.security

import java.nio.ByteBuffer
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * AES-256-GCM for one direction of one connection. The nonce is an implicit counter both sides
 * keep: the transport is ordered and reliable, so a replayed, dropped or reordered frame fails
 * authentication instead of being accepted.
 */
class AeadChannel(key: ByteArray) {
    private val keySpec = SecretKeySpec(key.copyOf(), "AES")
    private val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    private var counter = 0L

    init { require(key.size == 32) { "AES-256 key required" } }

    @Synchronized
    fun seal(plain: ByteArray): ByteArray {
        cipher.init(Cipher.ENCRYPT_MODE, keySpec, GCMParameterSpec(128, nextNonce()))
        return cipher.doFinal(plain)
    }

    @Synchronized
    fun open(sealed: ByteArray): ByteArray {
        cipher.init(Cipher.DECRYPT_MODE, keySpec, GCMParameterSpec(128, nextNonce()))
        return try {
            cipher.doFinal(sealed)
        } catch (e: AEADBadTagException) {
            throw SecurityException("frame failed authentication (tampered, replayed or out of order)", e)
        }
    }

    private fun nextNonce(): ByteArray {
        check(counter != Long.MAX_VALUE) { "nonce space exhausted" }
        return ByteBuffer.allocate(12).putInt(0).putLong(counter++).array()
    }
}
