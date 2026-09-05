package net.finalpantasy.fishoncollector;

import java.util.HashMap;
import java.util.Map;

final class FishStatsRewardTracker {
    private static final long WINDOW_MS = 5_000;
    private Map<String, Integer> baseline;
    private final Map<String, Integer> accumulated = new HashMap<>();
    private long deadlineMs;
    private boolean windowOpen;

    void beginCatchWindow(long nowMs) {
        if (baseline == null) return;
        accumulated.clear();
        deadlineMs = nowMs + WINDOW_MS;
        windowOpen = true;
    }

    Map<String, Integer> observe(Map<String, Integer> current, long nowMs) {
        if (current == null) return Map.of();
        Map<String, Integer> cleaned = clean(current);
        if (baseline == null) {
            baseline = cleaned;
            return Map.of();
        }
        if (!windowOpen) {
            baseline = cleaned;
            return Map.of();
        }
        if (nowMs <= deadlineMs) {
            cleaned.forEach((key, value) -> {
                int delta = value - baseline.getOrDefault(key, 0);
                if (delta > 0) accumulated.merge(key, delta, Math::max);
            });
            if (nowMs < deadlineMs) return Map.of();
        }
        windowOpen = false;
        baseline = cleaned;
        Map<String, Integer> result = Map.copyOf(accumulated);
        accumulated.clear();
        return result;
    }

    void reset() {
        baseline = null;
        accumulated.clear();
        deadlineMs = 0;
        windowOpen = false;
    }

    private static Map<String, Integer> clean(Map<String, Integer> values) {
        Map<String, Integer> output = new HashMap<>();
        values.forEach((key, value) -> {
            if (key != null && value != null) output.put(key, Math.max(0, value));
        });
        return Map.copyOf(output);
    }
}
