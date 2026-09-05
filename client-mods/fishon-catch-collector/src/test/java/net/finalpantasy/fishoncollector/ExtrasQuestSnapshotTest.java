package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

final class ExtrasQuestSnapshotTest {
    @Test
    void distinguishesUnavailableDataFromAnObservedEmptyLocation() {
        ExtrasQuestSnapshot unavailable = ExtrasQuestSnapshot.fromJson("not-json");
        ExtrasQuestSnapshot observed = ExtrasQuestSnapshot.fromJson("""
                {"questList":{"Cypress Lake":[]},"version":"0.2"}
                """);

        assertFalse(unavailable.available());
        assertTrue(observed.available());
        assertEquals(List.of(), observed.quests("Cypress Lake"));
        assertTrue(observed.knowsLocation("Cypress Lake"));
        assertFalse(observed.knowsLocation("Kenai River"));
    }

    @Test
    void parsesImmutableQuestRowsByLocation() {
        ExtrasQuestSnapshot snapshot = ExtrasQuestSnapshot.fromJson("""
                {
                  "questList": {
                    "Cypress Lake": [
                      {"goal":"adult","max":8,"current":8},
                      {"goal":"rare","max":7,"current":3}
                    ]
                  },
                  "version":"0.2"
                }
                """);

        assertEquals(
                List.of(
                        new ExtrasQuestSnapshot.Quest("adult", 8, 8),
                        new ExtrasQuestSnapshot.Quest("rare", 7, 3)),
                snapshot.quests("Cypress Lake"));
        assertTrue(snapshot.quests("Cypress Lake").getFirst().complete());
        assertFalse(snapshot.quests("Cypress Lake").getLast().complete());
    }
}
