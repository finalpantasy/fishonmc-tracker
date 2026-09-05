package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import org.junit.jupiter.api.Test;

final class FishStatsRewardTrackerTest {
    @Test
    void baselineNeverNotifiesAndCatchWindowAggregatesPositiveDeltasOnce() {
        FishStatsRewardTracker tracker = new FishStatsRewardTracker();
        assertTrue(tracker.observe(Map.of("armorShard", 25), 0).isEmpty());

        tracker.beginCatchWindow(1_000);
        assertTrue(tracker.observe(Map.of("armorShard", 25), 2_000).isEmpty());
        assertTrue(tracker.observe(Map.of("armorShard", 27, "package", 1), 3_000).isEmpty());
        assertEquals(Map.of("armorShard", 2, "package", 1),
                tracker.observe(Map.of("armorShard", 27, "package", 1), 6_000));
        assertTrue(tracker.observe(Map.of("armorShard", 27, "package", 1), 7_000).isEmpty());
    }

    @Test
    void staleWindowExpiresWithoutAttributingLaterDrops() {
        FishStatsRewardTracker tracker = new FishStatsRewardTracker();
        tracker.observe(Map.of("pet", 2), 0);
        tracker.beginCatchWindow(1_000);

        assertTrue(tracker.observe(Map.of("pet", 3), 7_001).isEmpty());
    }
}
