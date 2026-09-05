package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.google.gson.Gson;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

final class CatchbookRuntimeTest {
    @TempDir Path tempDir;

    @Test
    void loadsOnceServesMemoryOnlySnapshotsAndAcceptsNewEvents() throws Exception {
        Path ledger = tempDir.resolve("catches.jsonl");
        CatchObservation first = CatchbookIndexTest.observation("first", "normal", 0.03);
        Files.writeString(ledger, new Gson().toJson(first) + "\n", StandardCharsets.UTF_8);

        CatchbookRuntime runtime = CatchbookRuntime.load(ledger, published());
        Files.delete(ledger);

        assertEquals(1, runtime.snapshot().catchbook().eventCount());
        assertEquals(21.5, runtime.snapshot().published().find("eyespot-bowfin").orElseThrow().maximumWeightLb());

        runtime.record(CatchbookIndexTest.observation("second", "albino", 0.06));
        assertEquals(2, runtime.snapshot().catchbook().eventCount());
        assertEquals(2, runtime.snapshot().catchbook().species("eyespot-bowfin").orElseThrow().observedCount());
    }

    @Test
    void missingLedgerStartsWithAnEmptyCatchbook() {
        CatchbookRuntime runtime = CatchbookRuntime.load(tempDir.resolve("missing.jsonl"), published());
        assertEquals(0, runtime.snapshot().catchbook().eventCount());
    }

    private static ByteArrayInputStream published() {
        String json = """
                {"schemaVersion":1,"snapshot":"test","fish":[
                  {"normalizedId":"eyespot-bowfin","displayName":"Eyespot Bowfin","maximumWeightLb":21.5}
                ]}
                """;
        return new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8));
    }
}
