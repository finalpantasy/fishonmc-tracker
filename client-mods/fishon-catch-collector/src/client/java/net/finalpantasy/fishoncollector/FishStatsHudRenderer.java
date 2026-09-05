package net.finalpantasy.fishoncollector;

import java.nio.file.Path;
import java.time.Instant;
import java.util.Locale;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.hud.VanillaHudElements;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.DeltaTracker;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.resources.Identifier;

final class FishStatsHudRenderer {
    private static final int PANEL = 0x4C050709;
    private static final int HAIRLINE = 0x8A9AA4AA;
    private static final int DIVIDER = 0x3FAAB4B9;
    private static final int BADGE_FILL = 0xC7181E22;
    private static final int TEXT = 0xFFF4F7F8;
    private static final int MUTED = 0xFFB7C0C5;
    private static final int FAINT = 0xFF7D898F;
    private static final int CYAN = 0xFF4DE6E6;
    private static final int GREEN = 0xFF65E67A;
    private static final int GOLD = 0xFFF2D75C;
    private static final int MAGENTA = 0xFFF25BEF;
    private static final int BLUE = 0xFF6594FF;
    private static final int ORANGE = 0xFFFFA047;
    private static final int RED = 0xFFFF6262;

    private static final Category[] RARITIES = {
        new Category("C", "common", TEXT),
        new Category("R", "rare", BLUE),
        new Category("E", "epic", GREEN),
        new Category("L", "legendary", ORANGE),
        new Category("M", "mythical", RED)
    };
    private static final Category[] SIZES = {
        new Category("B", "baby", CYAN),
        new Category("J", "juvenile", GREEN),
        new Category("A", "adult", GOLD),
        new Category("L", "large", ORANGE),
        new Category("G", "gigantic", 0xFF9C72EA)
    };

    private static FishStatsSession session;
    private static FishStatsNotificationCenter notificationCenter;
    private static FishStatsSignalPoller signalPoller;
    private static boolean registered;

    private FishStatsHudRenderer() {}

    static synchronized void initialize(double personalBestWeightLb) {
        session = new FishStatsSession(Instant.now(), personalBestWeightLb);
        Path configDir = FabricLoader.getInstance().getConfigDir();
        FishStatsNotificationConfig notificationConfig = FishStatsNotificationConfig.load(
                configDir.resolve("fishon-stats-notifications.properties"));
        FishStatsNotificationState notificationState = FishStatsNotificationState.load(
                configDir.resolve("fishon-catch-collector").resolve("notification-state.properties"),
                notificationConfig.questSlots());
        notificationCenter = new FishStatsNotificationCenter(notificationConfig, notificationState.questCapacity());
        signalPoller = new FishStatsSignalPoller(configDir, notificationCenter, notificationState);
        if (registered) return;
        registered = true;
        ClientPlayConnectionEvents.JOIN.register((handler, sender, client) -> {
            FishStatsSession active = session;
            if (active != null) active.reset(Instant.now());
            FishStatsSignalPoller poller = signalPoller;
            if (poller != null) poller.reset();
        });
        HudElementRegistry.attachElementAfter(
                VanillaHudElements.CROSSHAIR,
                Identifier.fromNamespaceAndPath("fishon-catch-collector", "fish_stats_hud"),
                FishStatsHudRenderer::render);
    }

    static void record(CatchObservation event, FishStatsCatchClassifier.Result classification) {
        FishStatsSession active = session;
        if (active != null) active.record(event);
        long nowMs = System.currentTimeMillis();
        FishStatsNotificationCenter center = notificationCenter;
        if (center != null) center.acceptCatch(event, classification, nowMs);
        FishStatsSignalPoller poller = signalPoller;
        if (poller != null) poller.beginCatchWindow(nowMs);
    }

    private static void render(GuiGraphics graphics, DeltaTracker deltaTracker) {
        Minecraft minecraft = Minecraft.getInstance();
        if (minecraft.options.hideGui || minecraft.player == null || minecraft.getCurrentServer() == null) return;
        if (!ServerGate.isAllowed(minecraft.getCurrentServer().ip)) return;

        FishStatsSession active = session;
        FishStatsSignalPoller poller = signalPoller;
        FishStatsNotificationCenter center = notificationCenter;
        if (active == null || poller == null || center == null) return;
        long nowMs = System.currentTimeMillis();
        poller.poll(minecraft, nowMs);
        FishStatsHudLayout.Bounds bounds = FishStatsHudLayout.resolve(graphics.guiWidth(), graphics.guiHeight());
        graphics.pose().pushMatrix();
        graphics.pose().translate(bounds.x(), bounds.y());
        graphics.pose().scale(FishStatsHudLayout.SCALE, FishStatsHudLayout.SCALE);
        drawPanel(graphics, minecraft.font, active.snapshot(Instant.now()), poller.stats(),
                poller.sessionStartStats(), center.view(nowMs));
        graphics.pose().popMatrix();
    }

    private static void drawPanel(
            GuiGraphics graphics,
            Font font,
            FishStatsSession.Snapshot session,
            ExtrasStatsSnapshot allTime,
            ExtrasStatsSnapshot sessionBaseline,
            FishStatsNotificationCenter.View notifications) {
        int width = FishStatsHudLayout.VIRTUAL_WIDTH;
        int height = FishStatsHudLayout.VIRTUAL_HEIGHT;
        graphics.fill(0, 0, width, height, PANEL);
        graphics.fill(0, 0, width, 1, HAIRLINE);
        graphics.fill(0, height - 1, width, height, HAIRLINE);

        centered(graphics, font, "FISH STATS", width / 2, 5, TEXT);
        drawStatusBadges(graphics, font, notifications.badges(), width);
        summaryMetric(graphics, font, 43, "TOTAL", integer(allTime.fishTotal()), TEXT);
        summaryMetric(graphics, font, 130, "SESSION", emptyMetric(session.total(), integer(session.total())), CYAN);
        summaryMetric(graphics, font, 217, "RATE", emptyMetric(session.total(), one(session.catchesPerHour()) + "/HR"), GREEN);
        centered(graphics, font, session.formattedDuration(), 217, 43, MUTED);
        graphics.fill(86, 20, 87, 51, DIVIDER);
        graphics.fill(173, 20, 174, 51, DIVIDER);

        divider(graphics, 8, width - 8, 56);
        drawDistributionGrid(graphics, font, session, allTime);
        divider(graphics, 8, width - 8, 147);

        draw(graphics, font, "VARIANTS", 8, 154, MUTED);
        variantCell(graphics, font, 45, "N", "normal", CYAN, session, allTime);
        variantCell(graphics, font, 88, "A", "albino", GOLD, session, allTime);
        variantCell(graphics, font, 132, "M", "melanistic", RED, session, allTime);
        variantCell(graphics, font, 177, "T", "trophy", MAGENTA, session, allTime);
        variantCell(graphics, font, 222, "F", "fabled", TEXT, session, allTime);

        divider(graphics, 8, width - 8, 178);
        draw(graphics, font, "PERFORMANCE", 8, 185, MUTED);
        metric(graphics, font, 34, 197, "AVG WT", emptyMetric(session.total(), two(session.averageWeightLb()) + " LB"), TEXT);
        metric(graphics, font, 98, 197, "TOTAL WT", emptyMetric(session.total(), one(session.totalWeightLb()) + " LB"), TEXT);
        metric(graphics, font, 162, 197, "LB/HR", emptyMetric(session.total(), one(session.weightPerHourLb())), TEXT);
        metric(graphics, font, 226, 197, "PB", session.personalBestLb() > 0 ? two(session.personalBestLb()) + " LB" : "--", GOLD);
        graphics.fill(65, 197, 66, 220, DIVIDER);
        graphics.fill(129, 197, 130, 220, DIVIDER);
        graphics.fill(194, 197, 195, 220, DIVIDER);

        divider(graphics, 8, width - 8, 225);
        draw(graphics, font, "REWARDS", 8, 232, MUTED);
        drawRewardsTable(graphics, font, allTime, sessionBaseline);

        divider(graphics, 8, width - 8, 298);
        drawLastOrAlert(graphics, font, session, notifications.active(), width);
    }

    private static void drawLastOrAlert(
            GuiGraphics graphics,
            Font font,
            FishStatsSession.Snapshot session,
            FishStatsNotification alert,
            int width) {
        if (alert != null) {
            draw(graphics, font, "ALERT", 8, 305, alert.color());
            centered(graphics, font, fit(font, alert.title(), width - 16), width / 2, 318, alert.color());
            centered(graphics, font, fit(font, alert.detail(), width - 16), width / 2, 330, TEXT);
            return;
        }
        draw(graphics, font, "LAST", 8, 305, MUTED);
        CatchObservation lastCatch = session.lastCatch();
        if (lastCatch == null || lastCatch.fish() == null) {
            centered(graphics, font, "WAITING FOR FIRST CATCH...", width / 2, 321, FAINT);
            return;
        }
        String ago = session.minutesSinceLastCatch() == 0 ? "NOW" : session.minutesSinceLastCatch() + "M AGO";
        String details = valueOr(lastCatch.fish().displayName(), "FISH").toUpperCase(Locale.ROOT)
                + "  " + initials(lastCatch.fish())
                + "  " + two(lastCatch.fish().weightLb()) + " LB"
                + "  " + one(lastCatch.fish().lengthIn()) + " IN";
        centered(graphics, font, fit(font, details, width - 16), width / 2, 318, TEXT);
        String location = lastCatch.context() == null ? "FishOnMC" : valueOr(lastCatch.context().locationName(), "FishOnMC");
        centered(graphics, font, fit(font, location.toUpperCase(Locale.ROOT) + "  " + ago, width - 16), width / 2, 330, MUTED);
    }

    private static void drawStatusBadges(
            GuiGraphics graphics,
            Font font,
            java.util.List<FishStatsNotificationCenter.PersistentBadge> badges,
            int width) {
        int right = width - 6;
        for (int index = badges.size() - 1; index >= 0; index--) {
            FishStatsNotificationCenter.PersistentBadge badge = badges.get(index);
            int badgeWidth = font.width(badge.label()) + 5;
            int left = right - badgeWidth;
            graphics.fill(left, 6, left + 2, 13, badge.color());
            draw(graphics, font, badge.label(), left + 5, 5, badge.color());
            right = left - 4;
        }
    }

    private static void drawDistributionGrid(
            GuiGraphics graphics,
            Font font,
            FishStatsSession.Snapshot session,
            ExtrasStatsSnapshot allTime) {
        int x = 0;
        FishStatsHudLayout.Columns c = FishStatsHudLayout.columns();
        centered(graphics, font, "RARITY", 65, 63, MUTED);
        centered(graphics, font, "SIZE", 197, 63, MUTED);
        columnHead(graphics, font, x, 74, c.leftAll(), c.leftPercent(), c.leftSession(), c.leftDry());
        columnHead(graphics, font, x, 74, c.rightAll(), c.rightPercent(), c.rightSession(), c.rightDry());
        graphics.fill(129, 62, 130, 143, DIVIDER);
        for (int index = 0; index < RARITIES.length; index++) {
            int rowY = 85 + index * 11;
            categoryRow(graphics, font, x, rowY, RARITIES[index], "rarity", c.leftLabel(), c.leftAll(),
                    c.leftPercent(), c.leftSession(), c.leftDry(), session.rarityCount(RARITIES[index].key()),
                    session.total() > 0, allTime);
            categoryRow(graphics, font, x, rowY, SIZES[index], "size", c.rightLabel(), c.rightAll(),
                    c.rightPercent(), c.rightSession(), c.rightDry(), session.sizeCount(SIZES[index].key()),
                    session.total() > 0, allTime);
        }
    }

    private static void columnHead(
            GuiGraphics graphics, Font font, int x, int y, int all, int percent, int session, int dry) {
        right(graphics, font, "ALL", x + all, y, FAINT);
        right(graphics, font, "%", x + percent, y, FAINT);
        right(graphics, font, "SES", x + session, y, FAINT);
        right(graphics, font, "DRY", x + dry, y, FAINT);
    }

    private static void categoryRow(
            GuiGraphics graphics,
            Font font,
            int x,
            int y,
            Category category,
            String group,
            int label,
            int all,
            int percent,
            int session,
            int dry,
            int sessionCount,
            boolean hasSession,
            ExtrasStatsSnapshot allTime) {
        drawCategoryBadge(graphics, font, x + label, y, category.label(), category.color());
        right(graphics, font, integer(allTime.fishCount(group, category.key())), x + all, y, TEXT);
        right(graphics, font, one(allTime.fishPercent(group, category.key())), x + percent, y, MUTED);
        right(graphics, font, hasSession ? integer(sessionCount) : "--", x + session, y, CYAN);
        right(graphics, font, integer(allTime.fishDry(group, category.key())), x + dry, y, FAINT);
    }

    private static void drawCategoryBadge(
            GuiGraphics graphics, Font font, int x, int y, String label, int color) {
        graphics.fill(x, y, x + 10, y + 10, BADGE_FILL);
        graphics.fill(x, y, x + 10, y + 1, color);
        graphics.fill(x, y + 9, x + 10, y + 10, color);
        graphics.fill(x, y, x + 1, y + 10, color);
        graphics.fill(x + 9, y, x + 10, y + 10, color);
        centered(graphics, font, label, x + 5, y + 1, color);
    }

    private static void summaryMetric(
            GuiGraphics graphics, Font font, int center, String label, String value, int valueColor) {
        centered(graphics, font, label, center, 20, MUTED);
        centered(graphics, font, value, center, 32, valueColor);
    }

    private static void variantCell(
            GuiGraphics graphics,
            Font font,
            int center,
            String label,
            String key,
            int color,
            FishStatsSession.Snapshot session,
            ExtrasStatsSnapshot allTime) {
        String count = integer(allTime.fishCount("variant", key));
        int sessionCount = session.variantCount(key);
        String remainder = " " + count + (sessionCount > 0 ? " +" + sessionCount : "");
        int left = center - (font.width(label + remainder) / 2);
        draw(graphics, font, label, left, 165, color);
        draw(graphics, font, remainder, left + font.width(label), 165, TEXT);
    }

    private static void metric(
            GuiGraphics graphics, Font font, int center, int y, String label, String value, int valueColor) {
        centered(graphics, font, label, center, y, FAINT);
        centered(graphics, font, value, center, y + 11, valueColor);
    }

    private static void drawRewardsTable(
            GuiGraphics graphics, Font font, ExtrasStatsSnapshot allTime, ExtrasStatsSnapshot sessionBaseline) {
        draw(graphics, font, "REWARD", 16, 243, FAINT);
        centered(graphics, font, "ALL", 113, 243, FAINT);
        centered(graphics, font, "SES", 173, 243, FAINT);
        centered(graphics, font, "DRY", 232, 243, FAINT);
        rewardRow(graphics, font, "PET", 254, allTime.petTotal(),
                delta(allTime.petTotal(), sessionBaseline.petTotal()), allTime.petDry(), MAGENTA);
        rewardRow(graphics, font, "SHARDS", 265, allTime.itemCount("armorShard"),
                delta(allTime.itemCount("armorShard"), sessionBaseline.itemCount("armorShard")),
                allTime.itemDry("armorShard"), CYAN);
        rewardRow(graphics, font, "PACK", 276, allTime.itemCount("package"),
                delta(allTime.itemCount("package"), sessionBaseline.itemCount("package")),
                allTime.itemDry("package"), GOLD);
        rewardRow(graphics, font, "CHUM", 287, allTime.itemCount("chummer"),
                delta(allTime.itemCount("chummer"), sessionBaseline.itemCount("chummer")),
                allTime.itemDry("chummer"), GREEN);
    }

    private static void rewardRow(
            GuiGraphics graphics, Font font, String label, int y, int all, int sessionDelta, int dry, int color) {
        graphics.fill(8, y + 2, 10, y + 8, color);
        draw(graphics, font, label, 16, y, MUTED);
        centered(graphics, font, integer(all), 113, y, color);
        centered(graphics, font, sessionDelta > 0 ? integer(sessionDelta) : "--", 173, y,
                sessionDelta > 0 ? color : FAINT);
        centered(graphics, font, integer(dry), 232, y, MUTED);
    }

    private static int delta(int current, int baseline) {
        return Math.max(0, current - baseline);
    }

    private static String initials(CatchObservation.Fish fish) {
        return initial(fish.rarity()) + " / " + initial(fish.variant()) + " / " + initial(fish.size());
    }

    private static String initial(String value) {
        if (value == null || value.isBlank()) return "-";
        return value.substring(0, 1).toUpperCase(Locale.ROOT);
    }

    private static String valueOr(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private static String fit(Font font, String value, int width) {
        if (font.width(value) <= width) return value;
        return font.plainSubstrByWidth(value, Math.max(0, width - font.width("..."))) + "...";
    }

    private static String integer(int value) {
        return Integer.toString(Math.max(0, value));
    }

    private static String emptyMetric(int sessionTotal, String value) {
        return sessionTotal > 0 ? value : "--";
    }

    private static String one(Double value) {
        return String.format(Locale.ROOT, "%.1f", value == null || !Double.isFinite(value) ? 0 : value);
    }

    private static String two(Double value) {
        return String.format(Locale.ROOT, "%.2f", value == null || !Double.isFinite(value) ? 0 : value);
    }

    private static void divider(GuiGraphics graphics, int left, int right, int y) {
        graphics.fill(left, y, right, y + 1, DIVIDER);
    }

    private static void draw(GuiGraphics graphics, Font font, String text, int x, int y, int color) {
        graphics.drawString(font, text, x, y, color, true);
    }

    private static void right(GuiGraphics graphics, Font font, String text, int right, int y, int color) {
        draw(graphics, font, text, right - font.width(text), y, color);
    }

    private static void centered(GuiGraphics graphics, Font font, String text, int center, int y, int color) {
        draw(graphics, font, text, center - font.width(text) / 2, y, color);
    }

    private record Category(String label, String key, int color) {}
}
