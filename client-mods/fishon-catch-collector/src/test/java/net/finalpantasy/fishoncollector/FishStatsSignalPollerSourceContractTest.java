package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

final class FishStatsSignalPollerSourceContractTest {
    @Test
    void pollerRemainsReadOnlyAndUsesTheExtrasDataDirectory() throws Exception {
        String source = Files.readString(Path.of("src/client/java/net/finalpantasy/fishoncollector/FishStatsSignalPoller.java"));

        assertTrue(source.contains("fishonmcextras"));
        assertTrue(source.contains("quest.json"));
        assertTrue(source.contains("stats.json"));
        assertFalse(source.contains("sendCommand"));
        assertFalse(source.contains("useItem"));
        assertFalse(source.contains("handleInventoryMouseClick"));
    }
}
