package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

final class ExtrasReflectionReaderTest {
    @Test
    void readsOnlyTheStructuredCatchContextAndSetupFields() {
        FakeTag pole = new FakeTag("Cypress Pole");
        FakeRod rod = new FakeRod(List.of(pole), List.of(new FakeTag("Tournament Reel")), List.of(new FakeTag("Braided Line")), List.of(new FakeTag("Worm")));
        FakeFish fish = new FakeFish();

        Optional<CatchNormalizer.RawCatch> result = ExtrasReflectionReader.read(
                new FakeCatchingHandler(fish),
                new FakeInventoryHandler(rod, new FakeTag("River Otter")),
                new FakeBossHandler(),
                "0.3.7+1.21.11");

        assertTrue(result.isPresent());
        CatchNormalizer.RawCatch raw = result.orElseThrow();
        assertEquals("11111111-2222-3333-4444-555555555555", raw.rawEventId());
        assertEquals("American Paddlefish", raw.displayName());
        assertEquals("legendary", raw.rarity());
        assertEquals("trophy", raw.variant());
        assertEquals("adult", raw.size());
        assertEquals(145.77, raw.weightLb());
        assertEquals(76.33, raw.lengthIn());
        assertEquals("Swamp Delta", raw.locationName());
        assertEquals("North Bank", raw.subLocation());
        assertEquals("Clear", raw.weather());
        assertEquals("Day", raw.timeBand());
        assertEquals("73 F", raw.temperature());
        assertEquals("Cypress Pole", raw.pole());
        assertEquals("Tournament Reel", raw.reel());
        assertEquals("Braided Line", raw.line());
        assertEquals("Worm", raw.bait());
        assertEquals("observed", raw.baitState());
        assertEquals("unavailable", raw.armorState());
        assertEquals("River Otter", raw.pet());
        assertEquals(List.of(), raw.armor());
    }

    @Test
    void missingFishReturnsEmptyInsteadOfCreatingAFalseCatch() {
        assertTrue(ExtrasReflectionReader.read(
                new FakeCatchingHandler(null),
                new FakeInventoryHandler(null, null),
                new FakeBossHandler(),
                "0.3.7+1.21.11").isEmpty());
    }

    @Test
    void readsActiveBaitBossStateAndContestClockWithoutExtrasTypes() {
        FakeTag bait = new FakeTag("Worm", 9);
        FakeRod rod = new FakeRod(List.of(), List.of(), List.of(), List.of(bait), false);
        FakeTimer timer = new FakeTimer(1800, 1800, -5);

        ExtrasLiveSnapshot live = ExtrasReflectionReader.readLive(
                        new FakeInventoryHandler(rod, null),
                        new FakeBossHandler(),
                        new FakeTimerDataHandler(Map.of("Contest Timer", timer)),
                        2000)
                .orElseThrow();

        assertEquals("Swamp Delta", live.location());
        assertEquals("Clear", live.weather());
        assertEquals(new ExtrasLiveSnapshot.Bait("Worm", 9, false), live.bait());
        assertFalse(live.contest().active());
        assertEquals(1605, live.contest().secondsToStart());
        assertEquals(0, live.contest().secondsToEnd());
    }

    @Test
    void disabledBaitIsRepresentedWithoutCallingItDepleted() {
        FakeRod rod = new FakeRod(List.of(), List.of(), List.of(), List.of(new FakeTag("Worm", 0)), true);

        ExtrasLiveSnapshot live = ExtrasReflectionReader.readLive(
                        new FakeInventoryHandler(rod, null),
                        new FakeBossHandler(),
                        new FakeTimerDataHandler(Map.of()),
                        0)
                .orElseThrow();

        assertTrue(live.bait().disabled());
        assertEquals(0, live.bait().count());
    }

    @Test
    void emptyStructuredBaitListIsNoneRatherThanUnavailable() {
        FakeRod rod = new FakeRod(List.of(), List.of(), List.of(), List.of(), false);

        CatchNormalizer.RawCatch raw = ExtrasReflectionReader.read(
                        new FakeCatchingHandler(new FakeFish()),
                        new FakeInventoryHandler(rod, null),
                        new FakeBossHandler(),
                        "0.3.7+1.21.11")
                .orElseThrow();

        assertEquals(null, raw.bait());
        assertEquals("none", raw.baitState());
    }

    private static final class FakeCatchingHandler {
        @SuppressWarnings("unused")
        private final Object lastCaughtFish;
        private FakeCatchingHandler(Object fish) { this.lastCaughtFish = fish; }
    }

    private static class FakeTag {
        private final String name;
        private final int count;
        private FakeTag(String name) { this(name, 1); }
        private FakeTag(String name, int count) { this.name = name; this.count = count; }
        public FakeComponent getName() { return new FakeComponent(name); }
        public int getCount() { return count; }
    }

    private static final class FakeFish extends FakeTag {
        private FakeFish() { super("American Paddlefish"); }
        public UUID getID() { return UUID.fromString("11111111-2222-3333-4444-555555555555"); }
        public String getRarity() { return "legendary"; }
        public String getVariant() { return "trophy"; }
        public String getFishSize() { return "adult"; }
        public float getWeight() { return 145.77F; }
        public float getLength() { return 76.33F; }
    }

    private record FakeComponent(String value) {
        public String getString() { return value; }
    }

    private record FakeRod(List<FakeTag> pole, List<FakeTag> reel, List<FakeTag> line, List<FakeTag> bait, boolean disabled) {
        private FakeRod(List<FakeTag> pole, List<FakeTag> reel, List<FakeTag> line, List<FakeTag> bait) {
            this(pole, reel, line, bait, false);
        }
        public List<FakeTag> getPoleItem() { return pole; }
        public List<FakeTag> getReelItem() { return reel; }
        public List<FakeTag> getLineItem() { return line; }
        public List<FakeTag> getActiveBait() { return bait; }
        public boolean getDisableBait() { return disabled; }
    }

    private record FakeInventoryHandler(FakeRod rod, FakeTag pet) {
        public FakeRod getCurrentFishingRod() { return rod; }
        public FakeTag getCurrentPet() { return pet; }
    }

    private static final class FakeBossHandler {
        public FakeComponent getLocation() { return new FakeComponent("Swamp Delta"); }
        public FakeComponent getSubLocation() { return new FakeComponent("North Bank"); }
        public FakeComponent getWeather() { return new FakeComponent("Clear"); }
        public FakeComponent getTime() { return new FakeComponent("Day"); }
        public FakeComponent getTemperature() { return new FakeComponent("73 F"); }
    }

    private record FakeTimerDataHandler(FakeTimerModel model) {
        private FakeTimerDataHandler(Map<String, FakeTimer> timers) { this(new FakeTimerModel(timers)); }
        public FakeTimerModel getCustomTimerData() { return model; }
    }

    private static final class FakeTimerModel {
        @SuppressWarnings("unused")
        public final Map<String, FakeTimer> timerList;
        private FakeTimerModel(Map<String, FakeTimer> timers) { this.timerList = timers; }
    }

    private record FakeTimer(int timer, int offTimer, int offset) {
        public int getTimer() { return timer; }
        public int getOffTimer() { return offTimer; }
        public int getOffset() { return offset; }
        public boolean isUseTimer() { return true; }
        public boolean isPeriod() { return true; }
    }
}
