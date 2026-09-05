package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

final class FishStatsCatchClassifierTest {
    @Test
    void firstObservedCatchIsDiscoveryButDoesNotInventAPersonalBestAlert() {
        FishStatsCatchClassifier.Result result = FishStatsCatchClassifier.classify(CatchbookIndex.empty(), event("one", "Trout", "normal", 4.2));

        assertTrue(result.newSpecies());
        assertFalse(result.newVariant());
        assertFalse(result.newPersonalBest());
    }

    @Test
    void recognizesRealPersonalBestAndPreviouslyUnseenVariant() {
        CatchbookIndex before = index(event("one", "Trout", "normal", 4.2));
        FishStatsCatchClassifier.Result result = FishStatsCatchClassifier.classify(before, event("two", "Trout", "albino", 5.1));

        assertFalse(result.newSpecies());
        assertTrue(result.newVariant());
        assertTrue(result.newPersonalBest());
    }

    @Test
    void firstSpeciesWithSpecialVariantIsOneCombinedDiscovery() {
        FishStatsCatchClassifier.Result result = FishStatsCatchClassifier.classify(
                CatchbookIndex.empty(), event("one", "Trout", "melanistic", 4.2));

        assertTrue(result.newSpecies());
        assertTrue(result.newVariant());
    }

    @Test
    void repeatedSpeciesVariantAndLighterWeightStayQuiet() {
        CatchbookIndex before = index(event("one", "Trout", "albino", 5.1));
        FishStatsCatchClassifier.Result result = FishStatsCatchClassifier.classify(before, event("two", "Trout", "albino", 4.0));

        assertFalse(result.newSpecies());
        assertFalse(result.newVariant());
        assertFalse(result.newPersonalBest());
    }

    @Test
    void centerPresentsPbDiscoveryAndAggregatedRewards() {
        FishStatsNotificationCenter center = new FishStatsNotificationCenter(FishStatsNotificationConfig.defaults());
        CatchObservation caught = event("two", "Trout", "albino", 5.1);
        FishStatsCatchClassifier.Result result = FishStatsCatchClassifier.classify(
                index(event("one", "Trout", "normal", 4.2)), caught);

        center.acceptCatch(caught, result, 1_000);
        assertTrue(center.view(1_000).active().title().contains("PERSONAL BEST"));
        center.view(7_000);
        assertTrue(center.view(7_000).active().title().contains("NEW ALBINO VARIANT"));

        center.view(13_000);
        center.acceptRewardDeltas(Map.of("armorShard", 2, "package", 1), 13_000);
        assertTrue(center.view(13_000).active().title().contains("RARE REWARDS"));
        assertTrue(center.view(13_000).active().detail().contains("2 SHARDS"));
    }

    private static CatchbookIndex index(CatchObservation... events) {
        CatchbookIndex index = CatchbookIndex.empty();
        for (CatchObservation event : events) index = index.with(event);
        return index;
    }

    private static CatchObservation event(String id, String name, String variant, double weight) {
        return new CatchObservation(
                1,
                "collectorcatch-" + id,
                "2026-08-30T12:00:00Z",
                "session",
                new CatchObservation.Fish(name, name.toLowerCase(), "rare", variant, "adult", weight, 12.0),
                new CatchObservation.Context("Cypress Lake", null, null, null, null),
                new CatchObservation.Setup(null, null, null, null, List.of(), null),
                new CatchObservation.Source("0.4.0", "1.21.11", "0.3.7", "observed"));
    }
}
