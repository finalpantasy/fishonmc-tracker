package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import org.junit.jupiter.api.Test;

final class FishTooltipReaderTest {
    @Test
    void convertsOnlyBoundedFishFieldsAndHashesTheRawIdentifier() {
        TooltipFish fish = FishTooltipReader.fromFishTag(new FakeFish()).orElseThrow();

        assertEquals("eyespot-bowfin", fish.normalizedId());
        assertEquals("collectorcatch-666ff6ccaa5b3c07feaa3a95d3a4bd2c", fish.eventId());
        assertEquals(0.07, fish.weightLb(), 0.000001);
        assertEquals("normal", fish.variant());
        assertEquals("baby", fish.size());
        assertFalse(fish.toString().contains("11111111-2222-3333-4444-555555555555"));
    }

    @Test
    void driftAndNullInputsFailClosed() {
        assertTrue(FishTooltipReader.fromFishTag(new Object()).isEmpty());
        assertTrue(FishTooltipReader.fromFishTag(null).isEmpty());
        assertTrue(FishTooltipReader.read(null).isEmpty());
    }

    public static final class FakeFish {
        public UUID getID() { return UUID.fromString("11111111-2222-3333-4444-555555555555"); }
        public FakeComponent getName() { return new FakeComponent("Eyespot Bowfin"); }
        public float getWeight() { return 0.07F; }
        public String getVariant() { return "normal"; }
        public String getFishSize() { return "baby"; }
    }

    public record FakeComponent(String value) {
        public String getString() { return value; }
    }
}
