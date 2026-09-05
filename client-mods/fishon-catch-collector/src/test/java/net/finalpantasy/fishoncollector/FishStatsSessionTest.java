package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

final class FishStatsSessionTest {
    @Test
    void calculatesSessionCountsRatesWeightAndLastCatch() {
        Instant start = Instant.parse("2026-08-30T12:00:00Z");
        FishStatsSession session = new FishStatsSession(start, 25.0);
        session.record(observation("one", "common", "baby", 10.0, start.plusSeconds(300)));
        session.record(observation("two", "rare", "adult", 20.0, start.plusSeconds(900)));
        session.record(observation("three", "rare", "adult", 30.0, start.plusSeconds(1500)));

        FishStatsSession.Snapshot snapshot = session.snapshot(start.plusSeconds(1800));

        assertEquals(3, snapshot.total());
        assertEquals(2, snapshot.rarityCount("rare"));
        assertEquals(2, snapshot.sizeCount("adult"));
        assertEquals(3, snapshot.variantCount("normal"));
        assertEquals(30, snapshot.elapsedMinutes());
        assertEquals(6.0, snapshot.catchesPerHour(), 0.001);
        assertEquals(60.0, snapshot.totalWeightLb(), 0.001);
        assertEquals(20.0, snapshot.averageWeightLb(), 0.001);
        assertEquals(120.0, snapshot.weightPerHourLb(), 0.001);
        assertEquals(30.0, snapshot.personalBestLb(), 0.001);
        assertEquals("Three Fish", snapshot.lastCatch().fish().displayName());
        assertEquals(5, snapshot.minutesSinceLastCatch());
    }

    @Test
    void emptySessionUsesStableZeroValues() {
        Instant start = Instant.parse("2026-08-30T12:00:00Z");
        FishStatsSession.Snapshot snapshot = new FishStatsSession(start, 0).snapshot(start);

        assertEquals(0.0, snapshot.catchesPerHour());
        assertEquals(0.0, snapshot.averageWeightLb());
        assertEquals(0.0, snapshot.weightPerHourLb());
        assertEquals("0m", snapshot.formattedDuration());
    }

    private static CatchObservation observation(
            String suffix,
            String rarity,
            String size,
            double weight,
            Instant caughtAt) {
        String name = Character.toUpperCase(suffix.charAt(0)) + suffix.substring(1) + " Fish";
        return new CatchObservation(
                1,
                "collectorcatch-" + suffix,
                caughtAt.toString(),
                "session-test",
                new CatchObservation.Fish(name, suffix + "-fish", rarity, "normal", size, weight, 12.5),
                new CatchObservation.Context("Cypress Lake", null, "calm", "day", "72 F"),
                new CatchObservation.Setup("Pole", "Reel", "Line", "Bait", List.of(), "Bullfrog"),
                new CatchObservation.Source("0.3.0", "1.21.11", "0.3.7+1.21.11", "observed"));
    }
}
