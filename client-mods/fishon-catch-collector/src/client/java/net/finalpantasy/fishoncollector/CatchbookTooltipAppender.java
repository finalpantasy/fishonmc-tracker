package net.finalpantasy.fishoncollector;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;
import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.fabric.api.client.item.v1.ItemTooltipCallback;
import net.minecraft.ChatFormatting;
import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.MutableComponent;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.TooltipFlag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

final class CatchbookTooltipAppender {
    private static final String HEADING = "YOUR CATCHBOOK";
    private static final Logger LOGGER = LoggerFactory.getLogger("FishOn Catch Collector");
    private static final AtomicBoolean TOOLTIP_TRACE_WRITTEN = new AtomicBoolean();

    private CatchbookTooltipAppender() {}

    static void register() {
        ItemTooltipCallback.EVENT.register(CatchbookTooltipAppender::append);
    }

    private static void append(
            ItemStack stack,
            Item.TooltipContext context,
            TooltipFlag tooltipFlag,
            List<Component> lines) {
        CatchbookTooltipConfig config = FishOnCatchCollectorClient.tooltipConfig();
        CatchbookRuntime runtime = FishOnCatchCollectorClient.catchbookRuntime();
        if (config == null || runtime == null || !config.catchbookTooltips()) return;

        Minecraft minecraft = Minecraft.getInstance();
        if (minecraft.getCurrentServer() == null || !ServerGate.isAllowed(minecraft.getCurrentServer().ip)) return;

        Optional<TooltipFish> tooltipFish = FishTooltipReader.read(stack);
        if (looksLikeFishTooltip(lines) && tooltipFish.isEmpty() && TOOLTIP_TRACE_WRITTEN.compareAndSet(false, true)) {
            LOGGER.info("Tooltip trace: stock fish tooltip reached callback, but FishTooltipReader returned empty");
        }
        tooltipFish.ifPresent(fish -> {
            CatchbookRuntime.Snapshot snapshot = runtime.snapshot();
            boolean expanded = !config.expandedDetailsRequireShift()
                    || InputConstants.isKeyDown(minecraft.getWindow(), InputConstants.KEY_LSHIFT)
                    || InputConstants.isKeyDown(minecraft.getWindow(), InputConstants.KEY_RSHIFT);
            List<CatchbookTooltipModel.TooltipLine> additions = CatchbookTooltipModel.render(
                    fish,
                    snapshot.published(),
                    snapshot.catchbook(),
                    expanded,
                    config);
            if (additions.isEmpty()) return;
            List<Component> rendered = new java.util.ArrayList<>();
            for (CatchbookTooltipModel.TooltipLine addition : additions) {
                rendered.add(toComponent(addition));
            }
            Optional<Component> border = ExtrasTooltipFrameAdapter.borderComponent(stack);
            boolean integrated = border.map(component -> {
                if (TooltipFrameIntegrator.integrate(lines, component, rendered)) {
                    CatchbookTooltipPlacement.markNextTooltip();
                    return true;
                }
                return false;
            }).orElse(false);
            if (TOOLTIP_TRACE_WRITTEN.compareAndSet(false, true)) {
                LOGGER.info(
                        "Tooltip trace: fish=true, border={}, integrated={}, expanded={}, lines={}",
                        border.isPresent(),
                        integrated,
                        expanded,
                        lines.size());
            }
        });
    }

    private static boolean looksLikeFishTooltip(List<Component> lines) {
        boolean weight = false;
        boolean fishGroup = false;
        for (Component line : lines) {
            String text = line == null ? "" : line.getString().toUpperCase(java.util.Locale.ROOT);
            weight |= text.contains("WEIGHT:");
            fishGroup |= text.contains("FISH GROUP:");
        }
        return weight && fishGroup;
    }

    private static Component toComponent(CatchbookTooltipModel.TooltipLine line) {
        MutableComponent component = Component.empty();
        for (CatchbookTooltipModel.TooltipSpan span : line.spans()) {
            component.append(Component.literal(span.text()).withStyle(format(span.tone())));
        }
        return component;
    }

    private static ChatFormatting format(CatchbookTooltipModel.Tone tone) {
        return switch (tone) {
            case HEADING -> ChatFormatting.GOLD;
            case VALUE -> ChatFormatting.AQUA;
            case COMPLETE -> ChatFormatting.GREEN;
            case INCOMPLETE, MUTED -> ChatFormatting.DARK_GRAY;
            case LABEL -> ChatFormatting.GRAY;
        };
    }
}
