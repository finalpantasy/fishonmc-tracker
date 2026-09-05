package net.finalpantasy.fishoncollector;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.HashSet;
import java.util.Set;

public final class CatchLedgerWriter {
    private static final int MAX_SEEN_IDS = 100_000;
    private final Path ledgerPath;
    private final Gson gson = new GsonBuilder().serializeNulls().disableHtmlEscaping().create();
    private final Set<String> seenIds = new HashSet<>();

    public CatchLedgerWriter(Path ledgerPath) throws IOException {
        this.ledgerPath = ledgerPath.toAbsolutePath().normalize();
        loadSeenIds();
    }

    public synchronized boolean append(CatchObservation event) throws IOException {
        if (event == null || event.eventId() == null || !seenIds.add(event.eventId())) return false;
        Path parent = ledgerPath.getParent();
        if (parent != null) Files.createDirectories(parent);
        byte[] bytes = (gson.toJson(event) + System.lineSeparator()).getBytes(StandardCharsets.UTF_8);
        try (FileChannel channel = FileChannel.open(
                ledgerPath,
                StandardOpenOption.CREATE,
                StandardOpenOption.WRITE,
                StandardOpenOption.APPEND)) {
            ByteBuffer buffer = ByteBuffer.wrap(bytes);
            while (buffer.hasRemaining()) channel.write(buffer);
            channel.force(false);
        } catch (IOException error) {
            seenIds.remove(event.eventId());
            throw error;
        }
        return true;
    }

    private void loadSeenIds() throws IOException {
        if (!Files.isRegularFile(ledgerPath)) return;
        try (var lines = Files.lines(ledgerPath, StandardCharsets.UTF_8)) {
            lines.limit(MAX_SEEN_IDS).forEach(line -> {
                try {
                    JsonObject row = JsonParser.parseString(line).getAsJsonObject();
                    if (row.has("eventId") && row.get("eventId").isJsonPrimitive()) {
                        seenIds.add(row.get("eventId").getAsString());
                    }
                } catch (RuntimeException ignored) {
                    // The bridge reports malformed rows. The writer never rewrites or deletes the ledger.
                }
            });
        }
    }
}
