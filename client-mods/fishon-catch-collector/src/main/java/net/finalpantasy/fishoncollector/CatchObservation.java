package net.finalpantasy.fishoncollector;

import java.util.List;

public record CatchObservation(
        int schemaVersion,
        String eventId,
        String caughtAt,
        String sessionId,
        Fish fish,
        Context context,
        Setup setup,
        Source source,
        Quality quality) {

    public CatchObservation(
            int schemaVersion,
            String eventId,
            String caughtAt,
            String sessionId,
            Fish fish,
            Context context,
            Setup setup,
            Source source) {
        this(schemaVersion, eventId, caughtAt, sessionId, fish, context, setup, source, null);
    }

    public record Fish(
            String displayName,
            String normalizedId,
            String rarity,
            String variant,
            String size,
            Double weightLb,
            Double lengthIn) {}

    public record Context(
            String locationName,
            String subLocation,
            String weather,
            String weatherRaw,
            String timeBand,
            String timeText,
            String temperature) {
        public Context(
                String locationName,
                String subLocation,
                String weather,
                String timeBand,
                String temperature) {
            this(locationName, subLocation, weather, weather, timeBand, timeBand, temperature);
        }
    }

    public record Setup(
            String pole,
            String reel,
            String line,
            String bait,
            List<String> armor,
            String pet) {
        public Setup {
            armor = armor == null ? List.of() : List.copyOf(armor);
        }
    }

    public record Source(
            String collectorVersion,
            String minecraftVersion,
            String extrasVersion,
            String confidence) {}

    public record Quality(
            String weather,
            String timeBand,
            String bait,
            String armor) {}
}
