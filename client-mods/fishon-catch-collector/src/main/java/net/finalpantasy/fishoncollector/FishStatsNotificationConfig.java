package net.finalpantasy.fishoncollector;

import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.EnumMap;
import java.util.Map;
import java.util.Properties;

final class FishStatsNotificationConfig {
    private static final String DEFAULT_TEXT = """
            enabled=true
            displaySeconds=6
            queueCapacity=8
            backpackAmberPercent=80
            backpackRedPercent=95
            backpackRearmPercent=75
            baitLow=10
            baitCritical=3
            questSlots=3
            contestEarlySeconds=300
            contestLateSeconds=60
            eventEarlySeconds=300
            eventLateSeconds=60
            notifyBackpack=true
            notifyBait=true
            notifyQuest=true
            notifyContest=true
            notifyEvent=true
            notifyPersonalBest=true
            notifyDiscovery=true
            notifyReward=true
            """;

    private final boolean enabled;
    private final int displaySeconds;
    private final int queueCapacity;
    private final int backpackAmberPercent;
    private final int backpackRedPercent;
    private final int backpackRearmPercent;
    private final int baitLow;
    private final int baitCritical;
    private final int questSlots;
    private final int contestEarlySeconds;
    private final int contestLateSeconds;
    private final int eventEarlySeconds;
    private final int eventLateSeconds;
    private final Map<FishStatsNotification.Type, Boolean> typeEnabled;

    private FishStatsNotificationConfig(
            boolean enabled,
            int displaySeconds,
            int queueCapacity,
            int backpackAmberPercent,
            int backpackRedPercent,
            int backpackRearmPercent,
            int baitLow,
            int baitCritical,
            int questSlots,
            int contestEarlySeconds,
            int contestLateSeconds,
            int eventEarlySeconds,
            int eventLateSeconds,
            Map<FishStatsNotification.Type, Boolean> typeEnabled) {
        this.enabled = enabled;
        this.displaySeconds = displaySeconds;
        this.queueCapacity = queueCapacity;
        this.backpackAmberPercent = backpackAmberPercent;
        this.backpackRedPercent = backpackRedPercent;
        this.backpackRearmPercent = backpackRearmPercent;
        this.baitLow = baitLow;
        this.baitCritical = baitCritical;
        this.questSlots = questSlots;
        this.contestEarlySeconds = contestEarlySeconds;
        this.contestLateSeconds = contestLateSeconds;
        this.eventEarlySeconds = eventEarlySeconds;
        this.eventLateSeconds = eventLateSeconds;
        this.typeEnabled = Map.copyOf(typeEnabled);
    }

    static FishStatsNotificationConfig defaults() {
        EnumMap<FishStatsNotification.Type, Boolean> types = new EnumMap<>(FishStatsNotification.Type.class);
        for (FishStatsNotification.Type type : FishStatsNotification.Type.values()) types.put(type, true);
        return new FishStatsNotificationConfig(true, 6, 8, 80, 95, 75, 10, 3, 3, 300, 60, 300, 60, types);
    }

    static FishStatsNotificationConfig load(Path path) {
        if (path == null) return defaults();
        FishStatsNotificationConfig defaults = defaults();
        Path normalized = path.toAbsolutePath().normalize();
        try {
            Path parent = normalized.getParent();
            if (parent != null) Files.createDirectories(parent);
            if (!Files.isRegularFile(normalized)) {
                Files.writeString(
                        normalized,
                        DEFAULT_TEXT,
                        StandardCharsets.UTF_8,
                        StandardOpenOption.CREATE_NEW,
                        StandardOpenOption.WRITE);
            }
            Properties properties = new Properties();
            try (Reader reader = Files.newBufferedReader(normalized, StandardCharsets.UTF_8)) {
                properties.load(reader);
            }
            int amber = integer(properties, "backpackAmberPercent", defaults.backpackAmberPercent, 1, 99);
            int red = integer(properties, "backpackRedPercent", defaults.backpackRedPercent, 2, 99);
            int rearm = integer(properties, "backpackRearmPercent", defaults.backpackRearmPercent, 0, 98);
            if (red <= amber) red = defaults.backpackRedPercent;
            if (rearm >= amber) rearm = defaults.backpackRearmPercent;
            int baitLow = integer(properties, "baitLow", defaults.baitLow, 1, 100000);
            int baitCritical = integer(properties, "baitCritical", defaults.baitCritical, 1, 100000);
            if (baitCritical >= baitLow) baitCritical = defaults.baitCritical;
            EnumMap<FishStatsNotification.Type, Boolean> types = new EnumMap<>(FishStatsNotification.Type.class);
            types.put(FishStatsNotification.Type.BACKPACK, bool(properties, "notifyBackpack", true));
            types.put(FishStatsNotification.Type.BAIT, bool(properties, "notifyBait", true));
            types.put(FishStatsNotification.Type.QUEST, bool(properties, "notifyQuest", true));
            types.put(FishStatsNotification.Type.CONTEST, bool(properties, "notifyContest", true));
            types.put(FishStatsNotification.Type.EVENT, bool(properties, "notifyEvent", true));
            types.put(FishStatsNotification.Type.PERSONAL_BEST, bool(properties, "notifyPersonalBest", true));
            types.put(FishStatsNotification.Type.DISCOVERY, bool(properties, "notifyDiscovery", true));
            types.put(FishStatsNotification.Type.REWARD, bool(properties, "notifyReward", true));
            return new FishStatsNotificationConfig(
                    bool(properties, "enabled", defaults.enabled),
                    integer(properties, "displaySeconds", defaults.displaySeconds, 1, 60),
                    integer(properties, "queueCapacity", defaults.queueCapacity, 1, 32),
                    amber,
                    red,
                    rearm,
                    baitLow,
                    baitCritical,
                    integer(properties, "questSlots", defaults.questSlots, 1, 20),
                    integer(properties, "contestEarlySeconds", defaults.contestEarlySeconds, 1, 3600),
                    integer(properties, "contestLateSeconds", defaults.contestLateSeconds, 1, 3600),
                    integer(properties, "eventEarlySeconds", defaults.eventEarlySeconds, 1, 86400),
                    integer(properties, "eventLateSeconds", defaults.eventLateSeconds, 1, 3600),
                    types);
        } catch (IOException | RuntimeException ignored) {
            return defaults;
        }
    }

    FishStatsNotificationConfig withQueueCapacity(int value) {
        return new FishStatsNotificationConfig(
                enabled, displaySeconds, value, backpackAmberPercent, backpackRedPercent,
                backpackRearmPercent, baitLow, baitCritical, questSlots, contestEarlySeconds,
                contestLateSeconds, eventEarlySeconds, eventLateSeconds, typeEnabled);
    }

    boolean enabled() { return enabled; }
    int displaySeconds() { return displaySeconds; }
    int queueCapacity() { return queueCapacity; }
    int backpackAmberPercent() { return backpackAmberPercent; }
    int backpackRedPercent() { return backpackRedPercent; }
    int backpackRearmPercent() { return backpackRearmPercent; }
    int baitLow() { return baitLow; }
    int baitCritical() { return baitCritical; }
    int questSlots() { return questSlots; }
    int contestEarlySeconds() { return contestEarlySeconds; }
    int contestLateSeconds() { return contestLateSeconds; }
    int eventEarlySeconds() { return eventEarlySeconds; }
    int eventLateSeconds() { return eventLateSeconds; }
    boolean typeEnabled(FishStatsNotification.Type type) { return typeEnabled.getOrDefault(type, false); }

    private static boolean bool(Properties properties, String key, boolean fallback) {
        String value = properties.getProperty(key);
        if (value == null) return fallback;
        if ("true".equalsIgnoreCase(value.trim())) return true;
        if ("false".equalsIgnoreCase(value.trim())) return false;
        return fallback;
    }

    private static int integer(Properties properties, String key, int fallback, int minimum, int maximum) {
        String value = properties.getProperty(key);
        if (value == null) return fallback;
        try {
            int parsed = Integer.parseInt(value.trim());
            return parsed >= minimum && parsed <= maximum ? parsed : fallback;
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }
}
