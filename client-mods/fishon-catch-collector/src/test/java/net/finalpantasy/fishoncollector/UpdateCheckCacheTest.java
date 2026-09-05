package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

final class UpdateCheckCacheTest {
    @TempDir Path temp;

    @Test
    void persistsOnlyBoundedCompatibleReleaseState() throws Exception {
        Path path = temp.resolve("update-cache.properties");
        UpdateCheckCache cache = new UpdateCheckCache(path);
        Instant checkedAt = Instant.parse("2026-08-30T20:00:00Z");
        CompatibleRelease release = new CompatibleRelease(
                "0.4.2",
                URI.create("https://github.com/finalpantasy/fishon-catch-collector/releases/tag/v0.4.2"));

        cache.save(new UpdateCheckCache.State(checkedAt, "stable", "1.21.11", release));

        UpdateCheckCache.State loaded = cache.load("stable", "1.21.11").orElseThrow();
        assertEquals(checkedAt, loaded.checkedAt());
        assertEquals(release, loaded.release());
        assertTrue(cache.isFresh(loaded, checkedAt.plus(Duration.ofHours(23)), Duration.ofHours(24)));
        assertFalse(cache.isFresh(loaded, checkedAt.plus(Duration.ofHours(24)), Duration.ofHours(24)));
        assertTrue(cache.load("stable", "1.21.12").isEmpty());
        assertFalse(Files.readString(path).toLowerCase().contains("player"));
    }

    @Test
    void malformedStateFailsClosed() throws Exception {
        Path path = temp.resolve("update-cache.properties");
        Files.writeString(path, "checkedAt=nope\nversion=0.4.2\nreleaseUrl=https://evil.example/x\n");

        assertTrue(new UpdateCheckCache(path).load("stable", "1.21.11").isEmpty());
    }
}
