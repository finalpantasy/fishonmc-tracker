package net.finalpantasy.fishoncollector;

import net.minecraft.client.gui.screens.inventory.tooltip.ClientTooltipPositioner;
import net.minecraft.client.gui.screens.inventory.tooltip.DefaultTooltipPositioner;
import org.joml.Vector2i;
import org.joml.Vector2ic;

public final class CatchbookTooltipPositioner implements ClientTooltipPositioner {
    public static final ClientTooltipPositioner INSTANCE = new CatchbookTooltipPositioner();
    private static final int EDGE_MARGIN = 12;
    private static final int MINIMUM_Y = 4;

    private CatchbookTooltipPositioner() {}

    @Override
    public Vector2ic positionTooltip(
            int screenWidth,
            int screenHeight,
            int mouseX,
            int mouseY,
            int tooltipWidth,
            int tooltipHeight) {
        Vector2ic vanilla = DefaultTooltipPositioner.INSTANCE.positionTooltip(
                screenWidth, screenHeight, mouseX, mouseY, tooltipWidth, tooltipHeight);
        int highestBottomSafeY = screenHeight - tooltipHeight - EDGE_MARGIN;
        int shiftedY = Math.min(vanilla.y() - EDGE_MARGIN, highestBottomSafeY);
        return new Vector2i(vanilla.x(), Math.max(MINIMUM_Y, shiftedY));
    }
}
