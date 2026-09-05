package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

final class FishStatsHudLayoutTest {
    @Test
    void anchorsNearTheLeftUpperSafeZoneInsteadOfTheBottom() {
        FishStatsHudLayout.Bounds bounds = FishStatsHudLayout.resolve(1920, 1080);

        assertEquals(2, bounds.x());
        assertTrue(bounds.y() >= 270 && bounds.y() <= 310, "panel starts below the player and pet HUDs");
        assertTrue(bounds.bottom() < 650, "panel leaves a substantial chat-safe area below it");
        assertTrue(bounds.width() >= 160 && bounds.width() <= 175, "panel occupies about 17 percent of a 4K playfield");
        assertTrue(bounds.height() > bounds.width() * 1.25, "panel matches the preview's tall, narrow silhouette");
    }

    @Test
    void keepsEveryNumericColumnInsideThePanel() {
        FishStatsHudLayout.Columns columns = FishStatsHudLayout.columns();

        assertTrue(columns.leftLabel() < columns.leftAll());
        assertTrue(columns.leftAll() < columns.leftPercent());
        assertTrue(columns.leftPercent() < columns.leftSession());
        assertTrue(columns.leftSession() < columns.leftDry());
        assertTrue(columns.leftDry() < columns.rightLabel());
        assertTrue(columns.rightLabel() >= 134, "size badges need a visible gutter after the center divider");
        assertTrue(columns.rightLabel() < columns.rightAll());
        assertTrue(columns.rightAll() < columns.rightPercent());
        assertTrue(columns.rightPercent() < columns.rightSession());
        assertTrue(columns.rightSession() < columns.rightDry());
        assertTrue(columns.rightDry() <= FishStatsHudLayout.VIRTUAL_WIDTH - 8);
    }
}
