package net.finalpantasy.fishoncollector;

import java.util.Map;

record FishStatsSignalSnapshot(
        Backpack backpack,
        ExtrasLiveSnapshot.Bait bait,
        String location,
        ExtrasQuestSnapshot quests,
        ExtrasLiveSnapshot.Contest contest,
        EventState event,
        Map<String, Integer> rewards) {
    FishStatsSignalSnapshot {
        rewards = rewards == null ? Map.of() : Map.copyOf(rewards);
    }

    static FishStatsSignalSnapshot unavailable() {
        return new FishStatsSignalSnapshot(null, null, null, null, null, null, Map.of());
    }

    record Backpack(int occupied, int capacity) {
        Backpack {
            capacity = Math.max(0, capacity);
            occupied = Math.max(0, Math.min(occupied, capacity));
        }

        int percent() {
            return capacity <= 0 ? 0 : (int)Math.floor(occupied * 100.0 / capacity);
        }
    }

    record EventState(String key, String label, boolean active, Long secondsToStart, Long secondsToEnd) {
        EventState {
            key = clean(key);
            label = clean(label);
            secondsToStart = nonNegative(secondsToStart);
            secondsToEnd = nonNegative(secondsToEnd);
        }

        private static String clean(String value) {
            if (value == null) return null;
            String cleaned = value.trim();
            return cleaned.isEmpty() ? null : cleaned;
        }

        private static Long nonNegative(Long value) {
            return value == null ? null : Math.max(0, value);
        }
    }
}
