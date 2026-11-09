package expo.modules.installreferrer

import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Lee el Play Install Referrer: la cadena `referrer` con la que se abrió Play
 * Store antes de instalar la app. Nuestra liga del QR (/a/{codigo}) la manda
 * como utm_source=qr&utm_medium=lona&utm_campaign=XXX&codigo_asesor=XXX.
 *
 * Resuelve null (nunca rechaza) cuando no hay dato: instalación sin liga,
 * Play Store viejo, APK sideload, emulador, etc. El JS decide qué hacer.
 */
class InstallReferrerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("InstallReferrer")

    AsyncFunction("getReferrerAsync") { promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.resolve(null)
        return@AsyncFunction
      }

      val client = InstallReferrerClient.newBuilder(context).build()
      var resuelto = false
      fun resolverUnaVez(valor: Any?) {
        if (resuelto) return
        resuelto = true
        promise.resolve(valor)
        try { client.endConnection() } catch (_: Exception) {}
      }

      try {
        client.startConnection(object : InstallReferrerStateListener {
          override fun onInstallReferrerSetupFinished(responseCode: Int) {
            if (responseCode != InstallReferrerClient.InstallReferrerResponse.OK) {
              resolverUnaVez(null)
              return
            }
            try {
              val details = client.installReferrer
              resolverUnaVez(mapOf(
                "installReferrer" to details.installReferrer,
                "referrerClickTimestampSeconds" to details.referrerClickTimestampSeconds.toDouble(),
                "installBeginTimestampSeconds" to details.installBeginTimestampSeconds.toDouble(),
              ))
            } catch (e: Exception) {
              resolverUnaVez(null)
            }
          }

          override fun onInstallReferrerServiceDisconnected() {
            // Play Store cortó la conexión antes de contestar: sin dato.
            resolverUnaVez(null)
          }
        })
      } catch (e: Exception) {
        resolverUnaVez(null)
      }
    }
  }
}
