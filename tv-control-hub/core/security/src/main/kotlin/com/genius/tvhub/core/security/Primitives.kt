package com.genius.tvhub.core.security

import java.security.KeyFactory
import java.security.PrivateKey
import java.security.PublicKey
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import javax.crypto.KeyAgreement
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

internal object Primitives {
    fun decodePublicKey(encoded: ByteArray): PublicKey =
        KeyFactory.getInstance("EC").generatePublic(X509EncodedKeySpec(encoded))

    fun ecdh(own: PrivateKey, peerEncoded: ByteArray): ByteArray = KeyAgreement.getInstance("ECDH").run {
        init(own)
        doPhase(decodePublicKey(peerEncoded), true)
        generateSecret()
    }

    fun verify(publicKey: ByteArray, data: ByteArray, signature: ByteArray): Boolean = try {
        Signature.getInstance(SIGNATURE_ALGORITHM).run {
            initVerify(decodePublicKey(publicKey))
            update(data)
            verify(signature)
        }
    } catch (_: Exception) {
        false
    }

    private fun hmac(key: ByteArray, data: ByteArray): ByteArray =
        Mac.getInstance("HmacSHA256").run { init(SecretKeySpec(key, "HmacSHA256")); doFinal(data) }

    /** RFC 5869 HKDF-SHA256. */
    fun hkdf(ikm: ByteArray, salt: ByteArray, info: ByteArray, length: Int): ByteArray {
        val prk = hmac(salt, ikm)
        val out = ByteArray(length)
        var previous = ByteArray(0)
        var written = 0
        var counter = 1
        while (written < length) {
            previous = hmac(prk, previous + info + byteArrayOf(counter.toByte()))
            val n = minOf(previous.size, length - written)
            previous.copyInto(out, written, 0, n)
            written += n
            counter++
        }
        return out
    }
}
