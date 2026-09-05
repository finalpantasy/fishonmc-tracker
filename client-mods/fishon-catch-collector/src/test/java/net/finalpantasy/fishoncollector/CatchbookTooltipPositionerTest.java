package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import net.minecraft.client.gui.screens.inventory.tooltip.ClientTooltipPositioner;
import org.joml.Vector2ic;
import org.junit.jupiter.api.Test;

final class CatchbookTooltipPositionerTest {
    @Test
    void keepsAVisibleBottomMarginForTallCatchbookTooltips() {
        ClientTooltipPositioner positioner = load();

        Vector2ic position = positioner.positionTooltip(400, 300, 380, 290, 180, 220);

        assertTrue(position.y() >= 4);
        assertTrue(position.y() + 220 <= 288);
    }

    @Test
    void preservesTheDefaultHorizontalPlacement() {
        ClientTooltipPositioner positioner = load();

        Vector2ic actual = positioner.positionTooltip(400, 300, 100, 100, 120, 40);
        Vector2ic vanilla = net.minecraft.client.gui.screens.inventory.tooltip.DefaultTooltipPositioner.INSTANCE
                .positionTooltip(400, 300, 100, 100, 120, 40);

        assertEquals(vanilla.x(), actual.x());
    }

    private static ClientTooltipPositioner load() {
        try {
            Class<?> type = Class.forName("net.finalpantasy.fishoncollector.CatchbookTooltipPositioner");
            Field instance = type.getField("INSTANCE");
            return (ClientTooltipPositioner) instance.get(null);
        } catch (ReflectiveOperationException error) {
            throw new AssertionError("CatchbookTooltipPositioner is unavailable", error);
        }
    }
}
