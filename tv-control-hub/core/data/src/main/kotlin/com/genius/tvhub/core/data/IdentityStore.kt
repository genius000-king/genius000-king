package com.genius.tvhub.core.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import com.genius.tvhub.core.common.Log
import com.genius.tvhub.core.security.IdentityKey
import com.genius.tvhub.core.security.SoftwareIdentityKey
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.security.KeyFactory
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.security.spec.PKCS8EncodedKeySpec
import java.security.spec.X509EncodedKeySpec
import javax.inject.Inject
import javax.inject.Singleton

/**
 * This device's identity key, created once and kept forever (so pairing survives restarts).
 * Preferred home: AndroidKeyStore, where the private key cannot be read out. Some TV boxes ship a
 * broken keystore; then a software key in app-private storage is used instead.
 */
@Singleton
class IdentityStore @Inject constructor(@ApplicationContext private val context: Context) {

    val key: IdentityKey by lazy { keystoreKey() ?: softwareKey() }

    private fun keystoreKey(): IdentityKey? = try {
        val ks = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        if (!ks.containsAlias(ALIAS)) {
            KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, ANDROID_KEYSTORE).apply {
                initialize(
                    KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY)
                        .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                        .setDigests(KeyProperties.DIGEST_SHA256)
                        .build(),
                )
            }.generateKeyPair()
        }
        val entry = ks.getEntry(ALIAS, null) as KeyStore.PrivateKeyEntry
        KeystoreIdentityKey(entry.privateKey, entry.certificate.publicKey.encoded).also {
            it.sign(byteArrayOf(1)) // fail now, not mid-handshake, if this keystore is broken
        }
    } catch (e: Exception) {
        Log.w(TAG, "AndroidKeyStore unavailable, using a software identity", e)
        null
    }

    private fun softwareKey(): IdentityKey {
        val file = File(context.filesDir, "identity.key")
        val pubFile = File(context.filesDir, "identity.pub")
        if (file.exists() && pubFile.exists()) {
            runCatching {
                val kf = KeyFactory.getInstance("EC")
                return SoftwareIdentityKey(KeyPair(kf.generatePublic(X509EncodedKeySpec(pubFile.readBytes())), kf.generatePrivate(PKCS8EncodedKeySpec(file.readBytes()))))
            }
        }
        val pair = KeyPairGenerator.getInstance("EC").apply { initialize(ECGenParameterSpec("secp256r1")) }.generateKeyPair()
        file.writeBytes(pair.private.encoded)
        pubFile.writeBytes(pair.public.encoded)
        return SoftwareIdentityKey(pair)
    }

    private class KeystoreIdentityKey(private val private: PrivateKey, override val publicKey: ByteArray) : IdentityKey {
        override fun sign(data: ByteArray): ByteArray =
            Signature.getInstance("SHA256withECDSA").run { initSign(private); update(data); sign() }
    }

    companion object {
        private const val TAG = "IdentityStore"
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val ALIAS = "tvhub-identity-v1"
    }
}
