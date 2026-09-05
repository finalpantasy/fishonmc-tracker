package net.finalpantasy.fishoncollector.mixin;

import net.finalpantasy.fishoncollector.CatchbookTooltipPlacement;
import net.finalpantasy.fishoncollector.CatchbookTooltipPositioner;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.inventory.tooltip.ClientTooltipPositioner;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyArg;

@Mixin(GuiGraphics.class)
public abstract class GuiGraphicsTooltipMixin {
    @ModifyArg(
            method = "setTooltipForNextFrame(Lnet/minecraft/client/gui/Font;Ljava/util/List;Ljava/util/Optional;IILnet/minecraft/resources/Identifier;)V",
            at = @At(
                    value = "INVOKE",
                    target = "Lnet/minecraft/client/gui/GuiGraphics;setTooltipForNextFrameInternal(Lnet/minecraft/client/gui/Font;Ljava/util/List;IILnet/minecraft/client/gui/screens/inventory/tooltip/ClientTooltipPositioner;Lnet/minecraft/resources/Identifier;Z)V"),
            index = 4)
    private ClientTooltipPositioner fishonCatchbook$useSafePositioner(ClientTooltipPositioner original) {
        return CatchbookTooltipPlacement.consume() ? CatchbookTooltipPositioner.INSTANCE : original;
    }
}
