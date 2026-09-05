package net.finalpantasy.fishoncollector;

import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

final class FishStatsSession {
    private Instant startedAt;
    private int total;
    private double totalWeightLb;
    private double personalBestLb;
    private final Map<String, Integer> rarityCounts = new HashMap<>();
    private final Map<String, Integer> sizeCounts = new HashMap<>();
    private final Map<String, Integer> variantCounts = new HashMap<>();
    private CatchObservation lastCatch;
    private Instant lastCaughtAt;

    FishStatsSession(Instant startedAt, double personalBestLb) {
        this.startedAt = startedAt == null ? Instant.now() : startedAt;
        this.personalBestLb = finitePositive(personalBestLb) ? personalBestLb : 0;
    }

    synchronized void reset(Instant now) {
        startedAt = now == null ? Instant.now() : now;
        total = 0;
        totalWeightLb = 0;
        rarityCounts.clear();
        sizeCounts.clear();
        variantCounts.clear();
        lastCatch = null;
        lastCaughtAt = null;
    }

    synchronized void record(CatchObservation event) {
        if (event == null || event.fish() == null) return;
        total++;
        increment(rarityCounts, event.fish().rarity());
        increment(sizeCounts, event.fish().size());
        increment(variantCounts, event.fish().variant());
        Double weight = event.fish().weightLb();
        if (weight != null && finitePositive(weight)) {
            totalWeightLb += weight;
            personalBestLb = Math.max(personalBestLb, weight);
        }
        lastCatch = event;
        lastCaughtAt = parseInstant(event.caughtAt());
    }

    synchronized Snapshot snapshot(Instant now) {
        Instant capturedAt = now == null ? Instant.now() : now;
        long elapsedSeconds = Math.max(0, Duration.between(startedAt, capturedAt).getSeconds());
        long elapsedMinutes = elapsedSeconds / 60;
        double elapsedHours = elapsedSeconds / 3600.0;
        double catchesPerHour = elapsedHours > 0 ? total / elapsedHours : 0;
        double averageWeight = total > 0 ? totalWeightLb / total : 0;
        double weightPerHour = elapsedHours > 0 ? totalWeightLb / elapsedHours : 0;
        long sinceLast = lastCaughtAt == null
                ? 0
                : Math.max(0, Duration.between(lastCaughtAt, capturedAt).toMinutes());
        return new Snapshot(
                total,
                elapsedMinutes,
                catchesPerHour,
                totalWeightLb,
                averageWeight,
                weightPerHour,
                personalBestLb,
                Map.copyOf(rarityCounts),
                Map.copyOf(sizeCounts),
                Map.copyOf(variantCounts),
                lastCatch,
                sinceLast);
    }

    private static void increment(Map<String, Integer> counts, String key) {
        String cleaned = clean(key);
        if (cleaned != null) counts.merge(cleaned, 1, Integer::sum);
    }

    private static String clean(String value) {
        if (value == null) return null;
        String cleaned = value.trim().toLowerCase(Locale.ROOT);
        return cleaned.isEmpty() ? null : cleaned;
    }

    private static boolean finitePositive(double value) {
        return Double.isFinite(value) && value > 0;
    }

    private static Instant parseInstant(String value) {
        try {
            return value == null ? Instant.now() : Instant.parse(value);
        } catch (DateTimeParseException ignored) {
            return Instant.now();
        }
    }

    record Snapshot(
            int total,
            long elapsedMinutes,
            double catchesPerHour,
            double totalWeightLb,
            double averageWeightLb,
            double weightPerHourLb,
            double personalBestLb,
            Map<String, Integer> rarityCounts,
            Map<String, Integer> sizeCounts,
            Map<String, Integer> variantCounts,
            CatchObservation lastCatch,
            long minutesSinceLastCatch) {
        int rarityCount(String rarity) { return rarityCounts.getOrDefault(clean(rarity), 0); }
        int sizeCount(String size) { return sizeCounts.getOrDefault(clean(size), 0); }
        int variantCount(String variant) { return variantCounts.getOrDefault(clean(variant), 0); }
        String formattedDuration() {
            long hours = elapsedMinutes / 60;
            long minutes = elapsedMinutes % 60;
            return hours > 0 ? hours + "h " + minutes + "m" : minutes + "m";
        }
    }
}
