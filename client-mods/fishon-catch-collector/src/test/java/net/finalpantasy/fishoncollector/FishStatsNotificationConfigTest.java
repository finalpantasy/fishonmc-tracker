package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

final class FishStatsNotificationConfigTest {
    @TempDir Path temp;

    @Test
    void createsReadableDefaultsWhenTheFileDoesNotExist() throws Exception {
        Path path = temp.resolve("nested/fishon-stats-notifications.properties");

        FishStatsNotificationConfig config = FishStatsNotificationConfig.load(path);

        assertTrue(Files.isRegularFile(path));
        assertTrue(config.enabled());
        assertEquals(6, config.displaySeconds());
        assertEquals(8, config.queueCapacity());
        assertEquals(80, config.backpackAmberPercent());
        assertEquals(95, config.backpackRedPercent());
        assertEquals(75, config.backpackRearmPercent());
        assertEquals(10, config.baitLow());
        assertEquals(3, config.baitCritical());
        assertEquals(3, config.questSlots());
        assertEquals(300, config.contestEarlySeconds());
        assertEquals(60, config.contestLateSeconds());
        assertTrue(config.typeEnabled(FishStatsNotification.Type.REWARD));
    }

    @Test
    void malformedValuesFallBackIndependently() throws Exception {
        Path path = temp.resolve("notifications.properties");
        Files.writeString(path, """
                enabled=false
                displaySeconds=nope
                queueCapacity=4
                backpackAmberPercent=150
                baitLow=8
                notifyReward=false
                """);

        FishStatsNotificationConfig config = FishStatsNotificationConfig.load(path);

        assertFalse(config.enabled());
        assertEquals(6, config.displaySeconds());
        assertEquals(4, config.queueCapacity());
        assertEquals(80, config.backpackAmberPercent());
        assertEquals(8, config.baitLow());
        assertFalse(config.typeEnabled(FishStatsNotification.Type.REWARD));
        assertTrue(config.typeEnabled(FishStatsNotification.Type.BAIT));
    }
}
