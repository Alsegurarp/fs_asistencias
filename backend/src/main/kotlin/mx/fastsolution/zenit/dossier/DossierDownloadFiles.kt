package mx.fastsolution.zenit.dossier

import org.springframework.stereotype.Component
import java.io.OutputStream
import java.nio.file.Files
import java.nio.file.LinkOption.NOFOLLOW_LINKS
import java.nio.file.Path
import java.nio.file.attribute.PosixFilePermissions
import java.time.Instant

/** Copia privada antes de consumir: el mantenimiento SQL no puede truncar una entrega en curso. */
@Component
class DossierDownloadFiles {
    fun spool(write: (OutputStream) -> Unit): Path {
        val file = synchronized(active) {
            Files.createTempFile(directory, "delivery-", ".zip").also { active[it] = Instant.MAX }
        }
        try {
            Files.newOutputStream(file).use(write)
            synchronized(active) { active[file] = Instant.now() }
            return file
        }
        catch (failure: Exception) { discard(file); throw failure }
    }

    fun stream(file: Path, output: OutputStream) {
        synchronized(active) { check(active.containsKey(file)); active[file] = Instant.MAX }
        try { Files.newInputStream(file).use { it.copyTo(output) } }
        finally { discard(file) }
    }

    fun discard(file: Path) {
        synchronized(active) {
            try { Files.deleteIfExists(file); active.remove(file) }
            catch (_: Exception) { active[file] = Instant.EPOCH }
        }
    }

    fun maintain() {
        synchronized(active) {
            Files.list(directory).use { files ->
                files.filter { it.fileName.toString().startsWith("delivery-") && it.fileName.toString().endsWith(".zip") && Files.isRegularFile(it, NOFOLLOW_LINKS) }
                    .forEach { file -> if (active[file]?.isAfter(Instant.now().minusSeconds(60)) != true) discard(file) }
            }
        }
    }

    companion object {
        private val active = mutableMapOf<Path, Instant>()
        private val directory: Path = Path.of(System.getProperty("java.io.tmpdir"), "zenit-dossier-downloads").also {
            val attributes = if (it.fileSystem.supportedFileAttributeViews().contains("posix")) arrayOf(PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------"))) else emptyArray()
            Files.createDirectories(it, *attributes)
            check(Files.isDirectory(it, NOFOLLOW_LINKS))
            if (attributes.isNotEmpty()) Files.setPosixFilePermissions(it, PosixFilePermissions.fromString("rwx------"))
        }
    }
}
