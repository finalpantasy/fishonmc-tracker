package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.gson.Gson;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

final class CatchbookTooltipModelTest {
    private static final Gson GSON = new Gson();

    @Test
    void compactModeMatchesTheApprovedCopy() {
        Fixture fixture = fixture();
        List<CatchbookTooltipModel.TooltipLine> lines = CatchbookTooltipModel.render(
                fixture.fish(), fixture.published(), fixture.catchbook(), false, CatchbookTooltipConfig.defaults());

        assertEquals(List.of(
                "YOUR CATCHBOOK",
                "#2 OF 17 • 6.4% OF PUBLISHED MAX",
                "PB: 0.09LB • VARIANTS: 2/6",
                "HOLD SHIFT FOR RECORDS & SETUP"), plain(lines));
        assertEquals(CatchbookTooltipModel.Tone.HEADING, lines.getFirst().spans().getFirst().tone());
    }

    @Test
    void expandedModeShowsObservedRecordsVariantsExactSetupAndTruthfulProgress() {
        Fixture fixture = fixture();
        List<String> lines = plain(CatchbookTooltipModel.render(
                fixture.fish(), fixture.published(), fixture.catchbook(), true, CatchbookTooltipConfig.defaults()));

        assertTrue(lines.contains("CAUGHT: 17 • WEIGHT RANK: #2"));
        assertTrue(lines.contains("PERSONAL: 0.03 / 0.06 / 0.07 / 0.09LB"));
        assertTrue(lines.contains("MIN / AVG / THIS / MAX"));
        assertTrue(lines.contains("PUBLISHED MAX: 1.10LB • THIS: 6.4%"));
        assertTrue(lines.contains("VARIANTS: NORMAL ✓ • ALBINO ✓"));
        assertTrue(lines.contains("MELANISTIC □ • TROPHY □"));
        assertTrue(lines.contains("GIGANTIC □ • FABLED □"));
        assertTrue(lines.contains("CAUGHT WITH"));
        assertTrue(lines.contains("BAIT: NIGHTCRAWLER"));
        assertTrue(lines.contains("PET: BULLFROG"));
        assertTrue(lines.contains("REEL: STANDARD"));
        assertTrue(lines.contains("LINE: STANDARD"));
        assertFalse(lines.stream().anyMatch(line -> line.contains("REEL:") && line.contains("LINE:")));
        assertTrue(lines.contains("NEW COLLECTION PROGRESS"));
    }

    @Test
    void missingHistoryAndPublishedMaximumNeverCreateZeroValues() {
        PublishedFishIndex noMaximum = published(null);
        TooltipFish unknown = new TooltipFish("eyespot-bowfin", null, 0.07, "normal", "baby");
        List<String> lines = plain(CatchbookTooltipModel.render(
                unknown, noMaximum, CatchbookIndex.empty(), false, CatchbookTooltipConfig.defaults()));

        assertEquals(List.of(
                "YOUR CATCHBOOK",
                "NO LOGGED CATCHES • VARIANTS: 0/6",
                "HOLD SHIFT FOR RECORDS & SETUP"), lines);
        assertFalse(String.join(" ", lines).contains("0 OF"));
        assertFalse(String.join(" ", lines).contains("0.0%"));
    }

    @Test
    void expandedModeMakesAnUntrackedInventoryFishUsefulAndExplicit() {
        TooltipFish unknown = new TooltipFish("eyespot-bowfin", null, 0.07, "normal", "baby");
        List<String> lines = plain(CatchbookTooltipModel.render(
                unknown, published(21.5), CatchbookIndex.empty(), true, CatchbookTooltipConfig.defaults()));

        assertTrue(lines.contains("CAUGHT: 0 • THIS: 0.07LB"));
        assertTrue(lines.contains("NO LOGGED PERSONAL RECORDS"));
        assertTrue(lines.contains("PUBLISHED MAX: 21.50LB • THIS: 0.3%"));
        assertTrue(lines.contains("VARIANTS: NORMAL □ • ALBINO □"));
        assertTrue(lines.contains("MELANISTIC □ • TROPHY □"));
        assertTrue(lines.contains("GIGANTIC □ • FABLED □"));
        assertTrue(lines.contains("SETUP: NOT CAPTURED FOR THIS ITEM"));
    }

    @Test
    void expandedModeOmitsSetupWithoutAnExactEventMatch() {
        Fixture fixture = fixture();
        TooltipFish unmatched = new TooltipFish("eyespot-bowfin", "collectorcatch-missing", 0.07, "normal", "baby");
        List<String> lines = plain(CatchbookTooltipModel.render(
                unmatched, fixture.published(), fixture.catchbook(), true, CatchbookTooltipConfig.defaults()));

        assertTrue(lines.contains("SETUP: NOT CAPTURED FOR THIS ITEM"));
        assertFalse(lines.contains("NEW COLLECTION PROGRESS"));
    }

    private static Fixture fixture() {
        List<CatchObservation> events = new ArrayList<>();
        events.add(observation("current", "normal", "baby", 0.07, "2026-08-30T12:00:00Z"));
        events.add(observation("light", "normal", "baby", 0.03, "2026-08-30T12:01:00Z"));
        events.add(observation("middle", "albino", "baby", 0.06, "2026-08-30T12:02:00Z"));
        events.add(observation("heavy", "normal", "baby", 0.09, "2026-08-30T12:03:00Z"));
        for (int index = 4; index < 17; index++) {
            events.add(observation("unknown-" + index, "normal", "baby", null, "2026-08-30T12:" + (10 + index) + ":00Z"));
        }
        CatchbookIndex catchbook = CatchbookIndex.fromJsonLines(events.stream().map(GSON::toJson));
        return new Fixture(
                new TooltipFish("eyespot-bowfin", "collectorcatch-current", 0.07, "normal", "baby"),
                published(1.1),
                catchbook);
    }

    private static CatchObservation observation(String id, String variant, String size, Double weight, String caughtAt) {
        CatchObservation base = CatchbookIndexTest.observation(id, variant, weight);
        return new CatchObservation(
                base.schemaVersion(), base.eventId(), caughtAt, base.sessionId(),
                new CatchObservation.Fish(
                        base.fish().displayName(), base.fish().normalizedId(), base.fish().rarity(),
                        variant, size, weight, base.fish().lengthIn()),
                base.context(), base.setup(), base.source());
    }

    private static PublishedFishIndex published(Double maximum) {
        String json = "{\"schemaVersion\":1,\"snapshot\":\"test\",\"fish\":[{"
                + "\"normalizedId\":\"eyespot-bowfin\",\"displayName\":\"Eyespot Bowfin\","
                + "\"maximumWeightLb\":" + (maximum == null ? "null" : maximum) + "}]}";
        return PublishedFishIndex.load(new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8)));
    }

    private static List<String> plain(List<CatchbookTooltipModel.TooltipLine> lines) {
        return lines.stream().map(CatchbookTooltipModel.TooltipLine::plainText).toList();
    }

    private record Fixture(TooltipFish fish, PublishedFishIndex published, CatchbookIndex catchbook) {}
}
