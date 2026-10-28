package mx.fastsolution.zenit

import mx.fastsolution.zenit.api.ApiException
import mx.fastsolution.zenit.dossier.DossierDownloadFiles
import mx.fastsolution.zenit.dossier.hashMatches
import mx.fastsolution.zenit.dossier.pkce
import mx.fastsolution.zenit.dossier.strictText
import mx.fastsolution.zenit.export.sha256
import tools.jackson.databind.json.JsonMapper
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.OutputStream
import java.nio.file.Files
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.test.*

class DossierVerificationTest {
    @Test fun `migration profile does not initialize OIDC or download endpoints`() {
        org.springframework.context.annotation.AnnotationConfigApplicationContext().use { context ->
            context.environment.setActiveProfiles("migrate")
            context.register(mx.fastsolution.zenit.dossier.DossierOidc::class.java, mx.fastsolution.zenit.dossier.DossierVerification::class.java, mx.fastsolution.zenit.dossier.DossierVerificationController::class.java)
            context.refresh()
            assertTrue(context.getBeansOfType(mx.fastsolution.zenit.dossier.DossierOidc::class.java).isEmpty())
            assertTrue(context.getBeansOfType(mx.fastsolution.zenit.dossier.DossierVerification::class.java).isEmpty())
        }
    }
    @Test fun `PKCE S256 and comparison use exact bytes and strict string boundaries`() {
        assertEquals("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM", pkce("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"))
        assertTrue(hashMatches("secret",sha256("secret".toByteArray())))
        assertFalse(hashMatches("other",sha256("secret".toByteArray())))
        val json=JsonMapper()
        assertEquals("text",strictText("code",json.readTree("\"text\"")))
        for(value in listOf("123","true","null","{}","[]","\"\"")) assertFailsWith<ApiException> { strictText("code",json.readTree(value)) }
    }
    @Test fun `private spool cleans successful interrupted failed and orphaned transmissions`() {
        val files=DossierDownloadFiles()
        val data=ByteArray(131073) { (it%251).toByte() }
        val spool=files.spool { it.write(data) }
        files.maintain(); assertTrue(Files.exists(spool))
        val output=ByteArrayOutputStream(); files.stream(spool,output)
        assertContentEquals(data,output.toByteArray()); assertFalse(Files.exists(spool))
        val broken=files.spool { it.write(data) }
        assertFailsWith<IOException> { files.stream(broken,object:OutputStream(){ override fun write(value:Int){ throw IOException("interrupted") } }) }
        assertFalse(Files.exists(broken))
        val orphan=Files.createTempFile(spool.parent,"delivery-",".zip")
        files.maintain(); assertFalse(Files.exists(orphan))
        assertFailsWith<IOException> { files.spool { throw IOException("failed spool") } }
        if (spool.fileSystem.supportedFileAttributeViews().contains("posix")) assertEquals("rwx------",java.nio.file.attribute.PosixFilePermissions.toString(Files.getPosixFilePermissions(spool.parent)))
    }
    @Test fun `maintenance preserves a spool while its response is actively streaming`() {
        val files=DossierDownloadFiles(); val spool=files.spool { it.write(byteArrayOf(1,2,3)) }
        val started=CountDownLatch(1); val release=CountDownLatch(1)
        Executors.newSingleThreadExecutor().use { worker ->
            val task=worker.submit { files.stream(spool,object:OutputStream(){ override fun write(value:Int){ started.countDown(); check(release.await(10,TimeUnit.SECONDS)) } }) }
            assertTrue(started.await(10,TimeUnit.SECONDS)); files.maintain(); assertTrue(Files.exists(spool))
            release.countDown(); task.get(10,TimeUnit.SECONDS); assertFalse(Files.exists(spool))
        }
    }
}
