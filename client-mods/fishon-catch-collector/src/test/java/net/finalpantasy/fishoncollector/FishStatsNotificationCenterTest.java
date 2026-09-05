package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import org.junit.jupiter.api.Test;

final class FishStatsNotificationCenterTest {
    @Test
    void notificationExpiresAndLeavesTheQueueEmpty() {
        FishStatsNotificationCenter center = center();
        center.enqueue(note("quest", 6, 1_000), 10_000);

        assertEquals("quest", center.view(10_999).active().key());
        assertNull(center.view(11_000).active());
    }

    @Test
    void criticalNotificationPreemptsThenResumesTheInterruptedNotice() {
        FishStatsNotificationCenter center = center();
        center.enqueue(note("quest", 6, 6_000), 1_000);
        center.enqueue(note("full", 1, 2_000), 3_000);

        assertEquals("full", center.view(3_000).active().key());
        assertEquals("quest", center.view(5_000).active().key());
        assertNull(center.view(9_000).active());
    }

    @Test
    void duplicateKeysCoalesceInsteadOfQueuingRepeatedWarnings() {
        FishStatsNotificationCenter center = center();
        center.enqueue(note("bait-low", 7, 6_000), 1_000);
        center.enqueue(note("bait-low", 7, 6_000), 2_000);

        assertEquals("bait-low", center.view(7_999).active().key());
        assertNull(center.view(8_000).active());
    }

    @Test
    void queueCapacityDropsTheOldestLowestPriorityNotice() {
        FishStatsNotificationConfig config = FishStatsNotificationConfig.defaults().withQueueCapacity(2);
        FishStatsNotificationCenter center = new FishStatsNotificationCenter(config);
        center.enqueue(note("active", 1, 10_000), 1_000);
        center.enqueue(note("low-old", 7, 6_000), 1_100);
        center.enqueue(note("important", 2, 6_000), 1_200);

        assertEquals("active", center.view(1_200).active().key());
        assertEquals("important", center.view(11_000).active().key());
        assertNull(center.view(17_000).active());
    }

    @Test
    void persistentBadgesRenderTwoNamesAndAnOverflowCount() {
        FishStatsNotificationCenter center = center();
        center.setPersistent(new FishStatsNotificationCenter.PersistentBadge("full", "BAG", 0xFFFF0000, 1));
        center.setPersistent(new FishStatsNotificationCenter.PersistentBadge("bait", "BAIT", 0xFFFF0000, 2));
        center.setPersistent(new FishStatsNotificationCenter.PersistentBadge("quest", "Q", 0xFFFFFF00, 3));
        center.setPersistent(new FishStatsNotificationCenter.PersistentBadge("event", "EV", 0xFFFFFF00, 4));

        assertEquals(
                List.of("BAG", "BAIT", "+2"),
                center.view(0).badges().stream().map(FishStatsNotificationCenter.PersistentBadge::label).toList());
        center.clearPersistent("bait");
        assertEquals(
                List.of("BAG", "Q", "EV"),
                center.view(0).badges().stream().map(FishStatsNotificationCenter.PersistentBadge::label).toList());
    }

    @Test
    void resetClearsTransientAndPersistentState() {
        FishStatsNotificationCenter center = center();
        center.enqueue(note("quest", 6, 6_000), 1_000);
        center.setPersistent(new FishStatsNotificationCenter.PersistentBadge("quest", "Q", 0, 6));

        center.reset();

        assertNull(center.view(1_000).active());
        assertEquals(List.of(), center.view(1_000).badges());
    }

    private static FishStatsNotificationCenter center() {
        return new FishStatsNotificationCenter(FishStatsNotificationConfig.defaults());
    }

    private static FishStatsNotification note(String key, int priority, long durationMs) {
        return new FishStatsNotification(
                FishStatsNotification.Type.QUEST,
                key,
                priority,
                0xFFFFFFFF,
                key,
                "detail",
                durationMs,
                false);
    }
}
