package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

final class CatchbookTooltipConfigTest {
    @TempDir Path tempDir;

    @Test
    void createsAndReloadsTheDocumentedDefaults() throws Exception {
        Path path = tempDir.resolve("catchbook.properties");
        CatchbookTooltipConfig config = CatchbookTooltipConfig.load(path);

        assertTrue(config.catchbookTooltips());
        assertTrue(config.expandedDetailsRequireShift());
        assertTrue(config.showCapturedSetup());
        assertTrue(config.showPublishedMaximum());
        String first = Files.readString(path, StandardCharsets.UTF_8);
        assertEquals(config, CatchbookTooltipConfig.load(path));
        assertEquals(first, Files.readString(path, StandardCharsets.UTF_8));
    }

    @Test
    void acceptsExplicitBooleansAndPreservesDefaultsForMalformedValues() throws Exception {
        Path path = tempDir.resolve("catchbook.properties");
        Files.writeString(path, """
                catchbookTooltips=false
                expandedDetailsRequireShift=maybe
                showCapturedSetup=false
                showPublishedMaximum=true
                """, StandardCharsets.UTF_8);

        CatchbookTooltipConfig config = CatchbookTooltipConfig.load(path);
        assertFalse(config.catchbookTooltips());
        assertTrue(config.expandedDetailsRequireShift());
        assertFalse(config.showCapturedSetup());
        assertTrue(config.showPublishedMaximum());
    }
}
