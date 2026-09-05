package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

final class CollectorVersionTest {
    @Test
    void detectsOnlyRealSemanticUpgrades() {
        assertTrue(CollectorVersion.isNewer("0.4.2", "0.4.1"));
        assertTrue(CollectorVersion.isNewer("0.4.2", "0.4.2-beta.1"));
        assertFalse(CollectorVersion.isNewer("0.4.2", "0.4.2"));
        assertFalse(CollectorVersion.isNewer("0.4.1", "0.4.2"));
        assertFalse(CollectorVersion.isNewer("0.4.3-beta.1", "0.4.2"));
    }

    @Test
    void malformedOrUnknownVersionsNeverCreateAnAlert() {
        assertFalse(CollectorVersion.isNewer("banana", "0.4.1"));
        assertFalse(CollectorVersion.isNewer("0.4.2", "unknown"));
        assertFalse(CollectorVersion.isNewer(null, "0.4.1"));
        assertFalse(CollectorVersion.isNewer("0.4.2", null));
    }
}
