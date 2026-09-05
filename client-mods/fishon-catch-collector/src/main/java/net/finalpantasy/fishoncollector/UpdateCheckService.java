package net.finalpantasy.fishoncollector;

import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

public final class UpdateCheckService {
    private final UpdateCheckConfig config;
    private final UpdateCheckCache cache;
    private final UpdateTransport transport;
    private final URI metadataUri;
    private final Clock clock;

    public UpdateCheckService(
            UpdateCheckConfig config,
            UpdateCheckCache cache,
            UpdateTransport transport,
            URI metadataUri,
            Clock clock) {
        this.config = config == null ? UpdateCheckConfig.defaults() : config;
        this.cache = cache;
        this.transport = transport;
        this.metadataUri = metadataUri;
        this.clock = clock == null ? Clock.systemUTC() : clock;
    }

    public CompletableFuture<UpdateCheckResult> check(String installedVersion, String minecraftVersion) {
        if (!config.enabled()) return CompletableFuture.completedFuture(UpdateCheckResult.disabled());
        if (cache == null || transport == null || metadataUri == null || minecraftVersion == null) {
            return CompletableFuture.completedFuture(UpdateCheckResult.unavailable());
        }

        Instant now = clock.instant();
        Duration interval = Duration.ofHours(config.intervalHours());
        Optional<UpdateCheckCache.State> cached = cache.load(config.channel(), minecraftVersion);
        if (cached.isPresent() && cache.isFresh(cached.get(), now, interval)) {
            return CompletableFuture.completedFuture(
                    UpdateCheckResult.evaluate(installedVersion, cached.get().release()));
        }

        CompletableFuture<String> request;
        try {
            request = transport.fetch(metadataUri);
        } catch (RuntimeException error) {
            return CompletableFuture.completedFuture(UpdateCheckResult.unavailable());
        }
        return request.handle((body, error) -> {
            if (error != null) return UpdateCheckResult.unavailable();
            Optional<UpdateDocument> document = UpdateDocumentParser.parse(body);
            if (document.isEmpty()) return UpdateCheckResult.unavailable();
            CompatibleRelease release = document.get()
                    .compatibleRelease(config.channel(), minecraftVersion)
                    .orElse(null);
            cache.save(new UpdateCheckCache.State(now, config.channel(), minecraftVersion, release));
            return UpdateCheckResult.evaluate(installedVersion, release);
        });
    }
}
