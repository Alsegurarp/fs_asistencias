package mx.fastsolution.zenit.mobile

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView

/** Existing HTTPS administration, including its login and permissions, hosted in-app. */
class AdministrationActivity : ComponentActivity() {
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            var browser by remember { mutableStateOf<WebView?>(null) }
            var error by remember { mutableStateOf("") }
            BackHandler { if (browser?.canGoBack() == true) browser?.goBack() else finish() }
            DisposableEffect(Unit) { onDispose { browser?.apply { stopLoading(); destroy() }; browser = null } }
            MaterialTheme(colorScheme = ZenitColors) {
                Surface(Modifier.fillMaxSize()) {
                    Column(Modifier.fillMaxSize().safeDrawingPadding()) {
                        Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                            TextButton(onClick = { finish() }) { Text("Volver") }
                            TextButton(onClick = { startActivity(Intent(this@AdministrationActivity, CardProvisioningActivity::class.java)) }) { Text("Preparar tarjetas") }
                        }
                        if (error.isNotEmpty()) {
                            Text(error, Modifier.padding(16.dp))
                            TextButton(onClick = { error = ""; browser?.loadUrl("https://zenit.fastsolution.com.mx") }) { Text("Reintentar") }
                        }
                        AndroidView(modifier = Modifier.weight(1f).fillMaxWidth(), factory = { context ->
                            WebView(context).apply {
                                settings.javaScriptEnabled = true
                                settings.domStorageEnabled = true
                                settings.allowFileAccess = false
                                settings.allowContentAccess = false
                                settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
                                CookieManager.getInstance().setAcceptCookie(true)
                                webViewClient = object : WebViewClient() {
                                    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                                        val uri = request.url
                                        val allowed = uri.scheme == "https" && uri.host == "zenit.fastsolution.com.mx" && (uri.port == -1 || uri.port == 443)
                                        if (!allowed && request.isForMainFrame) error = "Este enlace no pertenece a Administración de Zenit."
                                        return !allowed
                                    }
                                    override fun onReceivedError(view: WebView, request: WebResourceRequest, failure: android.webkit.WebResourceError) {
                                        if (request.isForMainFrame) error = "No se pudo cargar Administración. Revisa tu conexión y vuelve a intentar."
                                    }
                                }
                                browser = this
                                loadUrl("https://zenit.fastsolution.com.mx")
                            }
                        })
                    }
                }
            }
        }
    }
}