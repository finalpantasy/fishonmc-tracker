package net.finalpantasy.fishoncollector;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import net.minecraft.client.Minecraft;
import net.minecraft.world.item.ItemStack;

final class FishStatsSignalPoller {
    private static final long POLL_INTERVAL_MS = 1_000;

    private final Path configDir;
    private final FishStatsNotificationCenter center;
    private final FishStatsNotificationState state;
    private final FishStatsRewardTracker rewardTracker = new FishStatsRewardTracker();
    private ExtrasStatsSnapshot stats = ExtrasStatsSnapshot.empty();
    private ExtrasStatsSnapshot sessionStartStats = ExtrasStatsSnapshot.empty();
    private boolean sessionBaselinePending = true;
    private long nextPollMs;

    FishStatsSignalPoller(
            Path configDir,
            FishStatsNotificationCenter center,
            FishStatsNotificationState state) {
        this.configDir = configDir;
        this.center = center;
        this.state = state;
    }

    void poll(Minecraft minecraft, long nowMs) {
        if (minecraft == null || minecraft.player == null || nowMs < nextPollMs) return;
        nextPollMs = nowMs + POLL_INTERVAL_MS;

        Path extrasData = configDir.resolve("fishonmcextras")
                .resolve("data")
                .resolve(minecraft.player.getUUID().toString());
        ExtrasQuestSnapshot quests = readQuests(extrasData.resolve("quest.json"));
        readStats(extrasData.resolve("stats.json"), nowMs);

        ExtrasLiveSnapshot live = ExtrasReflectionReader.readLiveState().orElse(null);
        ExtrasLiveSnapshot.Bait bait = live == null ? null : live.bait();
        ExtrasLiveSnapshot.Contest contest = live == null ? null : live.contest();
        String location = live == null ? null : live.location();
        FishStatsSignalSnapshot.EventState event = live == null
                ? null
                : FishStatsEventMapper.fromWeather(live.weather());
        FishStatsSignalSnapshot.Backpack backpack = backpack(minecraft);
        center.acceptSignals(new FishStatsSignalSnapshot(
                backpack, bait, location, quests, contest, event, stats.rewardCounts()), nowMs);
        state.rememberQuestCapacity(center.learnedQuestCapacity());
    }

    void beginCatchWindow(long nowMs) {
        rewardTracker.beginCatchWindow(nowMs);
    }

    ExtrasStatsSnapshot stats() {
        return stats;
    }

    ExtrasStatsSnapshot sessionStartStats() {
        return sessionStartStats;
    }

    void reset() {
        nextPollMs = 0;
        sessionBaselinePending = true;
        sessionStartStats = ExtrasStatsSnapshot.empty();
        rewardTracker.reset();
        center.reset();
    }

    private void readStats(Path path, long nowMs) {
        if (!Files.isRegularFile(path)) return;
        try {
            ExtrasStatsSnapshot next = ExtrasStatsSnapshot.fromJson(Files.readString(path));
            stats = next;
            if (sessionBaselinePending) {
                sessionStartStats = next;
                sessionBaselinePending = false;
            }
            Map<String, Integer> rewards = rewardTracker.observe(next.rewardCounts(), nowMs);
            center.acceptRewardDeltas(rewards, nowMs);
        } catch (IOException ignored) {
            // Retain the last complete Extras snapshot during an atomic file update.
        }
    }

    private static ExtrasQuestSnapshot readQuests(Path path) {
        if (!Files.isRegularFile(path)) return ExtrasQuestSnapshot.unavailable();
        try {
            return ExtrasQuestSnapshot.fromJson(Files.readString(path));
        } catch (IOException ignored) {
            return ExtrasQuestSnapshot.unavailable();
        }
    }

    private static FishStatsSignalSnapshot.Backpack backpack(Minecraft minecraft) {
        int occupied = 0;
        int capacity = 0;
        for (ItemStack stack : minecraft.player.getInventory().getNonEquipmentItems()) {
            capacity++;
            if (!stack.isEmpty()) occupied++;
        }
        return capacity > 0 ? new FishStatsSignalSnapshot.Backpack(occupied, capacity) : null;
    }
}
