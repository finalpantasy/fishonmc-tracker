package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

final class CollectorEventIdTest {
    @Test
    void derivesTheExistingPrivateStableId() {
        assertEquals(
                "collectorcatch-666ff6ccaa5b3c07feaa3a95d3a4bd2c",
                CollectorEventId.fromRaw("11111111-2222-3333-4444-555555555555"));
    }

    @Test
    void rejectsBlankIdentifiers() {
        assertThrows(IllegalArgumentException.class, () -> CollectorEventId.fromRaw("  "));
    }
}
