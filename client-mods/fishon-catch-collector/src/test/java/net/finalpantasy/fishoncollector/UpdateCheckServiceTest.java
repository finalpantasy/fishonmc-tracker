package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.URI;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

final class UpdateCheckServiceTest {
    private static final URI METADATA = URI.create(
            "https://raw.githubusercontent.com/finalpantasy/fishon-catch-collector/main/update.json");
    private static final String DOCUMENT = """
            {"schemaVersion":1,"modId":"fishon-catch-collector","channels":{"stable":{"1.21.11":{
            "version":"0.4.2","releaseUrl":"https://github.com/finalpantasy/fishon-catch-collector/releases/tag/v0.4.2"}}}}
            """;

    @TempDir Path temp;

    @Test
    void returnsCompatibleUpdateAndCachesSuccessfulCheck() {
        org.junit.jupiter.api.Assertions.assertTrue(UpdateDocumentParser.parse(DOCUMENT).isPresent());
        AtomicInteger calls = new AtomicInteger();
        UpdateTransport transport = uri -> {
            calls.incrementAndGet();
            return CompletableFuture.completedFuture(DOCUMENT);
        };
        UpdateCheckService service = service(UpdateCheckConfig.defaults(), transport);

        UpdateCheckResult result = service.check("0.4.1", "1.21.11").join();

        assertEquals(UpdateCheckResult.Status.UPDATE_AVAILABLE, result.status());
        assertEquals("0.4.2", result.release().orElseThrow().version());
        assertEquals(1, calls.get());

        UpdateCheckResult cached = service.check("0.4.1", "1.21.11").join();
        assertEquals(UpdateCheckResult.Status.UPDATE_AVAILABLE, cached.status());
        assertEquals(1, calls.get());
    }

    @Test
    void currentIncompatibleDisabledAndFailuresAreQuiet() {
        UpdateTransport valid = uri -> CompletableFuture.completedFuture(DOCUMENT);
        assertEquals(UpdateCheckResult.Status.CURRENT, service(UpdateCheckConfig.defaults(), valid)
                .check("0.4.2", "1.21.11").join().status());
        assertEquals(UpdateCheckResult.Status.UNAVAILABLE, service(UpdateCheckConfig.defaults(), valid)
                .check("0.4.1", "1.21.12").join().status());

        UpdateCheckConfig disabled = new UpdateCheckConfig(false, "stable", 24);
        assertEquals(UpdateCheckResult.Status.DISABLED, service(disabled, uri -> {
            throw new AssertionError("disabled checker made a request");
        }).check("0.4.1", "1.21.11").join().status());

        UpdateTransport failed = uri -> CompletableFuture.failedFuture(new IllegalStateException("offline"));
        assertEquals(UpdateCheckResult.Status.UNAVAILABLE, service(UpdateCheckConfig.defaults(), failed)
                .check("0.4.1", "1.21.11").join().status());
        assertEquals(UpdateCheckResult.Status.UNAVAILABLE, service(UpdateCheckConfig.defaults(),
                uri -> CompletableFuture.completedFuture("bad json"))
                .check("0.4.1", "1.21.11").join().status());
    }

    private UpdateCheckService service(UpdateCheckConfig config, UpdateTransport transport) {
        Clock clock = Clock.fixed(Instant.parse("2026-08-30T20:00:00Z"), ZoneOffset.UTC);
        return new UpdateCheckService(
                config,
                new UpdateCheckCache(temp.resolve(java.util.UUID.randomUUID() + ".properties")),
                transport,
                METADATA,
                clock);
    }
}
