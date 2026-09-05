package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

final class CatchbookIndexTest {
    @Test
    void aggregatesValidObservedRowsAndRejectsDuplicatesAndMalformedRows() {
        CatchObservation first = observation("a", "normal", 0.03);
        CatchObservation second = observation("b", "albino", 0.06);
        CatchObservation third = observation("c", "normal", 0.09);
        CatchObservation unknownWeight = observation("d", "normal", null);

        CatchbookIndex index = CatchbookIndex.fromJsonLines(Stream.of(
                json(first),
                json(second),
                json(third),
                json(unknownWeight),
                json(first),
                "{not-json"));

        CatchbookIndex.SpeciesSummary summary = index.species("eyespot-bowfin").orElseThrow();
        assertEquals(4, summary.observedCount());
        assertEquals(3, summary.weightedCount());
        assertEquals(0.03, summary.minimumLb());
        assertEquals(0.06, summary.meanLb(), 0.000001);
        assertEquals(0.06, summary.medianLb());
        assertEquals(0.09, summary.maximumLb());
        assertEquals(2, summary.rank(0.07));
        assertEquals(0.09, index.personalBestWeightLb());
        assertEquals(Set.of("normal", "albino"), summary.variants());
        assertEquals(1, index.malformedRows());
        assertTrue(index.event("collectorcatch-a").isPresent());
    }

    @Test
    void addingAnEventReturnsANewIndexAndKnownIdsAreNoOps() {
        CatchObservation event = observation("a", "normal", 0.03);
        CatchbookIndex empty = CatchbookIndex.empty();
        CatchbookIndex first = empty.with(event);
        CatchbookIndex duplicate = first.with(event);

        assertTrue(empty.species("eyespot-bowfin").isEmpty());
        assertEquals(1, first.species("eyespot-bowfin").orElseThrow().observedCount());
        assertTrue(first == duplicate);
    }

    private static String json(CatchObservation event) {
        return new com.google.gson.Gson().toJson(event);
    }

    static CatchObservation observation(String suffix, String variant, Double weight) {
        return new CatchObservation(
                2,
                "collectorcatch-" + suffix,
                "2026-08-30T12:00:00Z",
                "session-test",
                new CatchObservation.Fish(
                        "Eyespot Bowfin", "eyespot-bowfin", "epic", variant, "baby", weight, 6.74),
                new CatchObservation.Context(
                        "Cypress Lake", null, "clear", "☀", "day", "01:40pm", "72 F"),
                new CatchObservation.Setup(
                        "Standard Fishing Rod", "Standard", "Standard", "Nightcrawler", List.of(), "Bullfrog"),
                new CatchObservation.Source("0.4.1", "1.21.11", "0.3.7+1.21.11", "observed"),
                new CatchObservation.Quality("derived", "derived", "observed", "unavailable"));
    }
}
