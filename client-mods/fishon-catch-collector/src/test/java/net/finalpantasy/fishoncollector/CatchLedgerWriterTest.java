package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

final class CatchLedgerWriterTest {
    @TempDir
    Path tempDir;

    @Test
    void appendsOneUtf8JsonObjectPerCatchAndSuppressesDuplicatesAcrossRestart() throws Exception {
        Path ledger = tempDir.resolve("nested").resolve("catches.jsonl");
        CatchObservation event = CatchNormalizer.normalize(
                new CatchNormalizer.RawCatch(
                        "unique-fish-1", "Bluegill", "common", "normal", "adult", 1.42, 9.31,
                        "Cypress Lake", null, "clear", "day", null,
                        null, null, null, "worm", null, null, "0.3.7+1.21.11"),
                Instant.parse("2026-08-29T18:04:31.120Z"),
                "session-local-1");

        CatchLedgerWriter first = new CatchLedgerWriter(ledger);
        assertTrue(first.append(event));
        assertFalse(first.append(event));

        CatchLedgerWriter restarted = new CatchLedgerWriter(ledger);
        assertFalse(restarted.append(event));

        String text = Files.readString(ledger, StandardCharsets.UTF_8);
        assertEquals(1, text.lines().count());
        assertTrue(text.endsWith(System.lineSeparator()));
        assertTrue(text.contains("\"eventId\":\"" + event.eventId() + "\""));
        assertTrue(text.contains("\"displayName\":\"Bluegill\""));
    }
}
