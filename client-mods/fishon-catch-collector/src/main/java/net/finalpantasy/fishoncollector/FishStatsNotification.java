package net.finalpantasy.fishoncollector;

record FishStatsNotification(
        Type type,
        String key,
        int priority,
        int color,
        String title,
        String detail,
        long durationMs,
        boolean persistent) {
    FishStatsNotification {
        type = type == null ? Type.EVENT : type;
        key = key == null ? "" : key;
        title = title == null ? "" : title;
        detail = detail == null ? "" : detail;
        durationMs = Math.max(1, durationMs);
    }

    enum Type {
        BACKPACK,
        BAIT,
        QUEST,
        CONTEST,
        EVENT,
        PERSONAL_BEST,
        DISCOVERY,
        REWARD
    }
}
