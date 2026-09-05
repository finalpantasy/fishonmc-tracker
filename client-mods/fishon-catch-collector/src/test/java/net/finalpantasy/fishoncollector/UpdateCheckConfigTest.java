package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

final class UpdateCheckConfigTest {
    @TempDir Path temp;

    @Test
    void createsQuietSafeDefaults() throws Exception {
        Path path = temp.resolve("update-check.properties");

        UpdateCheckConfig config = UpdateCheckConfig.load(path);

        assertTrue(config.enabled());
        assertEquals("stable", config.channel());
        assertEquals(24, config.intervalHours());
        assertTrue(Files.readString(path).contains("updateChecks=true"));
    }

    @Test
    void supportsExplicitOptOutAndBoundsInvalidValues() throws Exception {
        Path path = temp.resolve("update-check.properties");
        Files.writeString(path, """
                updateChecks=false
                updateChannel=nightly
                updateCheckIntervalHours=999999
                """);

        UpdateCheckConfig config = UpdateCheckConfig.load(path);

        assertFalse(config.enabled());
        assertEquals("stable", config.channel());
        assertEquals(24, config.intervalHours());
    }

    @Test
    void unreadableOrMissingPathFailsToDefaults() {
        assertEquals(UpdateCheckConfig.defaults(), UpdateCheckConfig.load(null));
    }
}
