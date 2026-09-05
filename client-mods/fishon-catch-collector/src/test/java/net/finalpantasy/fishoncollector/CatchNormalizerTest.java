package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.gson.Gson;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

final class CatchNormalizerTest {
    @Test
    void createsACompletePrivacyBoundedCatchEvent() {
        CatchNormalizer.RawCatch raw = new CatchNormalizer.RawCatch(
                "raw-server-item-identifier",
                "  American Paddlefish  ",
                "LEGENDARY",
                "TROPHY",
                "ADULT",
                145.77,
                76.33,
                "  Swamp Delta ",
                " North Bank ",
                " ☀ ",
                " 01:40pm ",
                " 73 F ",
                " Cypress Pole ",
                " Tournament Reel ",
                " Braided Line ",
                " Worm ",
                List.of(" Angler Hat ", "", "Angler Boots"),
                " River Otter ",
                "0.3.7+1.21.11",
                "observed",
                "unavailable");

        CatchObservation event = CatchNormalizer.normalize(
                raw,
                Instant.parse("2026-08-29T18:04:31.120Z"),
                "session-local-1",
                "0.4.1",
                "1.21.11");

        assertEquals(2, event.schemaVersion());
        assertTrue(event.eventId().matches("collectorcatch-[0-9a-f]{32}"));
        assertEquals("2026-08-29T18:04:31.120Z", event.caughtAt());
        assertEquals("American Paddlefish", event.fish().displayName());
        assertEquals("american-paddlefish", event.fish().normalizedId());
        assertEquals("legendary", event.fish().rarity());
        assertEquals("trophy", event.fish().variant());
        assertEquals("adult", event.fish().size());
        assertEquals(145.77, event.fish().weightLb());
        assertEquals(76.33, event.fish().lengthIn());
        assertEquals("Swamp Delta", event.context().locationName());
        assertEquals("North Bank", event.context().subLocation());
        assertEquals("clear", event.context().weather());
        assertEquals("☀", event.context().weatherRaw());
        assertEquals("day", event.context().timeBand());
        assertEquals("01:40pm", event.context().timeText());
        assertEquals(List.of("Angler Hat", "Angler Boots"), event.setup().armor());
        assertEquals("River Otter", event.setup().pet());
        assertEquals("derived", event.quality().weather());
        assertEquals("derived", event.quality().timeBand());
        assertEquals("observed", event.quality().bait());
        assertEquals("unavailable", event.quality().armor());
        assertEquals("0.4.1", event.source().collectorVersion());
        assertEquals("1.21.11", event.source().minecraftVersion());
        assertEquals("observed", event.source().confidence());

        String json = new Gson().toJson(event);
        assertFalse(json.contains("raw-server-item-identifier"));
        assertFalse(json.toLowerCase().contains("player"));
        assertFalse(json.toLowerCase().contains("coordinate"));
    }

    @Test
    void invalidOrUnknownOptionalValuesRemainNullInsteadOfBecomingZeros() {
        CatchNormalizer.RawCatch raw = new CatchNormalizer.RawCatch(
                null, "Bluegill", null, null, null,
                Double.NaN, -4.0,
                null, null, null, null, null,
                null, null, null, null, null, null, null,
                "unavailable", "unavailable");

        CatchObservation event = CatchNormalizer.normalize(
                raw, Instant.EPOCH, "session-local-2", "0.4.1", "1.21.11");

        assertNull(event.fish().rarity());
        assertEquals("normal", event.fish().variant());
        assertNull(event.fish().size());
        assertNull(event.fish().weightLb());
        assertNull(event.fish().lengthIn());
        assertNull(event.context().locationName());
        assertEquals(List.of(), event.setup().armor());
        assertEquals("unavailable", event.quality().weather());
        assertEquals("unavailable", event.quality().timeBand());
    }

    @Test
    void preservesUnknownWeatherGlyphWithoutInventingAConditionAndDerivesNight() {
        CatchNormalizer.RawCatch raw = new CatchNormalizer.RawCatch(
                null, "Bluegill", "common", "normal", "adult", 1.0, 8.0,
                "Cypress Lake", null, "♣", "11:17pm", "72 F",
                "Standard Cast Pole", null, null, null, List.of(), null,
                "0.3.7+1.21.11", "none", "unavailable");

        CatchObservation event = CatchNormalizer.normalize(
                raw, Instant.EPOCH, "session-local-3", "0.4.1", "1.21.11");

        assertNull(event.context().weather());
        assertEquals("♣", event.context().weatherRaw());
        assertEquals("unresolved", event.quality().weather());
        assertEquals("night", event.context().timeBand());
        assertEquals("derived", event.quality().timeBand());
        assertEquals("none", event.quality().bait());
    }
}
