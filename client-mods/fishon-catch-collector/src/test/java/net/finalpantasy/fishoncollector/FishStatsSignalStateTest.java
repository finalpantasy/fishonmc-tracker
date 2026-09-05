package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

final class FishStatsSignalStateTest {
    @Test
    void backpackBaselinesSilentlyThenRearamsBelowSeventyFivePercent() {
        FishStatsNotificationCenter center = center();
        center.acceptSignals(signals(new FishStatsSignalSnapshot.Backpack(30, 36), null, null, null, null, null), 0);

        assertNull(center.view(0).active());
        assertEquals(List.of("BAG 83%"), labels(center));

        center.acceptSignals(signals(new FishStatsSignalSnapshot.Backpack(20, 36), null, null, null, null, null), 1_000);
        assertEquals(List.of(), labels(center));
        center.acceptSignals(signals(new FishStatsSignalSnapshot.Backpack(29, 36), null, null, null, null, null), 2_000);

        assertEquals("backpack:amber", center.view(2_000).active().key());
        assertEquals(List.of("BAG 80%"), labels(center));
    }

    @Test
    void backpackEscalatesToFullWithoutRepeatingTheSameBand() {
        FishStatsNotificationCenter center = center();
        center.acceptSignals(signals(new FishStatsSignalSnapshot.Backpack(20, 36), null, null, null, null, null), 0);
        center.acceptSignals(signals(new FishStatsSignalSnapshot.Backpack(35, 36), null, null, null, null, null), 1_000);
        assertEquals("backpack:red", center.view(1_000).active().key());
        center.acceptSignals(signals(new FishStatsSignalSnapshot.Backpack(35, 36), null, null, null, null, null), 2_000);
        center.acceptSignals(signals(new FishStatsSignalSnapshot.Backpack(36, 36), null, null, null, null, null), 3_000);

        assertEquals("backpack:full", center.view(3_000).active().key());
        assertEquals(List.of("BAG FULL"), labels(center));
    }

    @Test
    void baitOnlyNotifiesOnDownwardThresholdsAndDisabledBaitClearsTheBadge() {
        FishStatsNotificationCenter center = center();
        center.acceptSignals(signals(null, new ExtrasLiveSnapshot.Bait("Worm", 12, false), null, null, null, null), 0);
        center.acceptSignals(signals(null, new ExtrasLiveSnapshot.Bait("Worm", 10, false), null, null, null, null), 1_000);
        assertEquals("bait:low:worm", center.view(1_000).active().key());
        center.acceptSignals(signals(null, new ExtrasLiveSnapshot.Bait("Worm", 0, true), null, null, null, null), 8_000);

        assertNull(center.view(8_000).active());
        assertTrue(labels(center).stream().noneMatch(label -> label.startsWith("BAIT")));
    }

    @Test
    void unavailableReadCannotLookLikeBaitDepletion() {
        FishStatsNotificationCenter center = center();
        center.acceptSignals(signals(null, new ExtrasLiveSnapshot.Bait("Worm", 12, false), null, null, null, null), 0);
        center.acceptSignals(FishStatsSignalSnapshot.unavailable(), 1_000);

        assertNull(center.view(1_000).active());
    }

    @Test
    void questCompletionAndEmptyCapacityAreSeparateStates() {
        FishStatsNotificationCenter center = center();
        ExtrasQuestSnapshot before = ExtrasQuestSnapshot.fromJson("""
                {"questList":{"Cypress Lake":[{"goal":"adult","max":8,"current":7},{"goal":"rare","max":7,"current":1}]}}
                """);
        ExtrasQuestSnapshot after = ExtrasQuestSnapshot.fromJson("""
                {"questList":{"Cypress Lake":[{"goal":"adult","max":8,"current":8},{"goal":"rare","max":7,"current":1}]}}
                """);
        center.acceptSignals(signals(null, null, "Cypress Lake", before, null, null), 0);
        assertNull(center.view(0).active());
        assertEquals(List.of("Q"), labels(center));
        center.acceptSignals(signals(null, null, "Cypress Lake", after, null, null), 1_000);

        assertEquals("quest:complete:cypress lake:0", center.view(1_000).active().key());
        assertEquals("ADULT COMPLETE", center.view(1_000).active().title());
    }

    @Test
    void questCapacityLearnsHigherObservedCountsAndNeverShrinks() {
        FishStatsNotificationCenter center = center();
        center.acceptSignals(signals(null, null, "Cypress Lake", quests("Cypress Lake", 4), null, null), 0);
        assertEquals(4, center.learnedQuestCapacity());
        center.acceptSignals(signals(null, null, "Cypress Lake", quests("Cypress Lake", 3), null, null), 1_000);

        assertEquals(4, center.learnedQuestCapacity());
        assertEquals(List.of("Q"), labels(center));
    }

    @Test
    void questSlotEmptyNotifiesOnlyAfterARealFilledToEmptyTransition() {
        FishStatsNotificationCenter center = center();
        center.acceptSignals(signals(null, null, "Cypress Lake", quests("Cypress Lake", 3), null, null), 0);
        center.acceptSignals(signals(null, null, "Cypress Lake", quests("Cypress Lake", 2), null, null), 1_000);

        assertEquals("quest:empty:cypress lake", center.view(1_000).active().key());
        assertEquals("QUEST SLOT EMPTY", center.view(1_000).active().title());
    }

    @Test
    void contestWarnsAtFiveMinutesAndOneMinuteOncePerCycle() {
        FishStatsNotificationCenter center = center();
        center.acceptSignals(signals(null, null, null, null, new ExtrasLiveSnapshot.Contest(false, 301, 0), null), 0);
        center.acceptSignals(signals(null, null, null, null, new ExtrasLiveSnapshot.Contest(false, 300, 0), null), 1_000);
        assertEquals("contest:early", center.view(1_000).active().key());
        center.view(7_000);
        center.acceptSignals(signals(null, null, null, null, new ExtrasLiveSnapshot.Contest(true, 0, 1_800), null), 7_000);
        center.acceptSignals(signals(null, null, null, null, new ExtrasLiveSnapshot.Contest(false, 61, 0), null), 8_000);
        center.acceptSignals(signals(null, null, null, null, new ExtrasLiveSnapshot.Contest(false, 60, 0), null), 9_000);

        assertEquals("contest:late", center.view(9_000).active().key());
    }

    @Test
    void eventStartsAndActuallyEndsWithoutAnInventedCountdown() {
        FishStatsNotificationCenter center = center();
        center.acceptSignals(signals(null, null, null, null, null, new FishStatsSignalSnapshot.EventState("clear", "Clear", false, null, null)), 0);
        center.acceptSignals(signals(null, null, null, null, null, new FishStatsSignalSnapshot.EventState("rain", "Rain", true, null, null)), 1_000);
        assertEquals("event:start:rain", center.view(1_000).active().key());
        center.view(7_000);
        center.acceptSignals(signals(null, null, null, null, null, new FishStatsSignalSnapshot.EventState("clear", "Clear", false, null, null)), 7_000);

        assertEquals("event:end:rain", center.view(7_000).active().key());
    }

    @Test
    void eventCountdownWarnsOnlyWhenReliableSecondsAreProvided() {
        FishStatsNotificationCenter center = center();
        center.acceptSignals(signals(null, null, null, null, null,
                new FishStatsSignalSnapshot.EventState("gold-rush", "Gold Rush", false, 301L, null)), 0);
        center.acceptSignals(signals(null, null, null, null, null,
                new FishStatsSignalSnapshot.EventState("gold-rush", "Gold Rush", false, 300L, null)), 1_000);

        assertEquals("event:start-soon:gold-rush:early", center.view(1_000).active().key());
    }

    private static FishStatsNotificationCenter center() {
        return new FishStatsNotificationCenter(FishStatsNotificationConfig.defaults());
    }

    private static List<String> labels(FishStatsNotificationCenter center) {
        return center.view(0).badges().stream().map(FishStatsNotificationCenter.PersistentBadge::label).toList();
    }

    private static FishStatsSignalSnapshot signals(
            FishStatsSignalSnapshot.Backpack backpack,
            ExtrasLiveSnapshot.Bait bait,
            String location,
            ExtrasQuestSnapshot quests,
            ExtrasLiveSnapshot.Contest contest,
            FishStatsSignalSnapshot.EventState event) {
        return new FishStatsSignalSnapshot(backpack, bait, location, quests, contest, event, Map.of());
    }

    private static ExtrasQuestSnapshot quests(String location, int count) {
        StringBuilder rows = new StringBuilder();
        for (int index = 0; index < count; index++) {
            if (index > 0) rows.append(',');
            rows.append("{\"goal\":\"rare\",\"max\":7,\"current\":1}");
        }
        return ExtrasQuestSnapshot.fromJson("{\"questList\":{\"" + location + "\":[" + rows + "]}}");
    }
}
