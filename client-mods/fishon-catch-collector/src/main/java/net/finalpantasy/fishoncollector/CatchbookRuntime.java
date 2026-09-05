package net.finalpantasy.fishoncollector;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Stream;

public final class CatchbookRuntime {
    private final PublishedFishIndex published;
    private final AtomicReference<CatchbookIndex> catchbook;

    private CatchbookRuntime(PublishedFishIndex published, CatchbookIndex catchbook) {
        this.published = published;
        this.catchbook = new AtomicReference<>(catchbook);
    }

    public static CatchbookRuntime load(Path ledgerPath, InputStream publishedResource) {
        PublishedFishIndex published = PublishedFishIndex.load(publishedResource);
        CatchbookIndex catchbook = CatchbookIndex.empty();
        if (ledgerPath != null && Files.isRegularFile(ledgerPath)) {
            try (Stream<String> lines = Files.lines(ledgerPath, StandardCharsets.UTF_8)) {
                catchbook = CatchbookIndex.fromJsonLines(lines);
            } catch (IOException | RuntimeException ignored) {
                catchbook = CatchbookIndex.empty();
            }
        }
        return new CatchbookRuntime(published, catchbook);
    }

    public Snapshot snapshot() {
        return new Snapshot(published, catchbook.get());
    }

    public void record(CatchObservation event) {
        if (event != null) catchbook.updateAndGet(index -> index.with(event));
    }

    public record Snapshot(PublishedFishIndex published, CatchbookIndex catchbook) {}
}
