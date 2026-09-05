package net.finalpantasy.fishoncollector;

import java.text.Normalizer;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class CatchNormalizer {
    private static final Pattern CLOCK = Pattern.compile("^(\\d{1,2}):(\\d{2})\\s*(am|pm)$", Pattern.CASE_INSENSITIVE);
    private static final Set<String> BAIT_STATES = Set.of("observed", "none", "disabled", "unavailable");
    private static final Set<String> ARMOR_STATES = Set.of("observed", "unavailable");

    private CatchNormalizer() {}

    public record RawCatch(
            String rawEventId,
            String displayName,
            String rarity,
            String variant,
            String size,
            Double weightLb,
            Double lengthIn,
            String locationName,
            String subLocation,
            String weather,
            String timeBand,
            String temperature,
            String pole,
            String reel,
            String line,
            String bait,
            List<String> armor,
            String pet,
            String extrasVersion,
            String baitState,
            String armorState) {
        public RawCatch(
                String rawEventId,
                String displayName,
                String rarity,
                String variant,
                String size,
                Double weightLb,
                Double lengthIn,
                String locationName,
                String subLocation,
                String weather,
                String timeBand,
                String temperature,
                String pole,
                String reel,
                String line,
                String bait,
                List<String> armor,
                String pet,
                String extrasVersion) {
            this(
                    rawEventId, displayName, rarity, variant, size, weightLb, lengthIn,
                    locationName, subLocation, weather, timeBand, temperature,
                    pole, reel, line, bait, armor, pet, extrasVersion,
                    bait == null ? "unavailable" : "observed",
                    armor == null ? "unavailable" : "observed");
        }
    }

    public static CatchObservation normalize(RawCatch raw, Instant caughtAt, String sessionId) {
        return normalize(raw, caughtAt, sessionId, "unknown", "unknown");
    }

    public static CatchObservation normalize(
            RawCatch raw,
            Instant caughtAt,
            String sessionId,
            String collectorVersion,
            String minecraftVersion) {
        Objects.requireNonNull(raw, "raw");
        Objects.requireNonNull(caughtAt, "caughtAt");
        String displayName = requiredText(raw.displayName(), "displayName");
        String caughtAtText = caughtAt.toString();
        String canonical = text(raw.rawEventId());
        if (canonical == null) {
            canonical = String.join("|", caughtAtText, displayName, String.valueOf(raw.weightLb()), String.valueOf(raw.lengthIn()));
        }
        CatchObservation.Fish fish = new CatchObservation.Fish(
                displayName,
                normalizedFishId(displayName),
                lower(raw.rarity()),
                lower(raw.variant()) == null ? "normal" : lower(raw.variant()),
                lower(raw.size()),
                positiveFinite(raw.weightLb()),
                positiveFinite(raw.lengthIn()));
        Semantic weather = weather(raw.weather());
        Semantic timeBand = timeBand(raw.timeBand());
        String weatherRaw = text(raw.weather());
        String timeText = text(raw.timeBand());
        CatchObservation.Context context = new CatchObservation.Context(
                text(raw.locationName()),
                text(raw.subLocation()),
                weather.value(),
                weatherRaw,
                timeBand.value(),
                timeText,
                text(raw.temperature()));
        CatchObservation.Setup setup = new CatchObservation.Setup(
                text(raw.pole()),
                text(raw.reel()),
                text(raw.line()),
                text(raw.bait()),
                cleanList(raw.armor()),
                text(raw.pet()));
        CatchObservation.Source source = new CatchObservation.Source(
                requiredText(collectorVersion, "collectorVersion"),
                requiredText(minecraftVersion, "minecraftVersion"),
                text(raw.extrasVersion()),
                "observed");
        CatchObservation.Quality quality = new CatchObservation.Quality(
                weather.status(),
                timeBand.status(),
                state(raw.baitState(), BAIT_STATES, raw.bait() == null ? "unavailable" : "observed"),
                state(raw.armorState(), ARMOR_STATES, "unavailable"));
        return new CatchObservation(
                2,
                CollectorEventId.fromRaw(canonical),
                caughtAtText,
                requiredText(sessionId, "sessionId"),
                fish,
                context,
                setup,
                source,
                quality);
    }

    private static Semantic weather(String value) {
        String raw = text(value);
        if (raw == null) return new Semantic(null, "unavailable");
        String normalized = raw.toLowerCase(Locale.ROOT);
        if (normalized.equals("clear") || normalized.equals("sunny") || normalized.equals("sun") || raw.equals("☀")) {
            return new Semantic("clear", normalized.equals("clear") ? "observed" : "derived");
        }
        if (normalized.equals("rain") || normalized.equals("raining") || normalized.equals("rainy")
                || normalized.equals("shower") || normalized.equals("showers")) {
            return new Semantic("rain", normalized.equals("rain") ? "observed" : "derived");
        }
        if (normalized.contains("thunder") || normalized.contains("storm") || normalized.contains("lightning")) {
            return new Semantic("thunder", normalized.equals("thunder") ? "observed" : "derived");
        }
        return new Semantic(null, "unresolved");
    }

    private static Semantic timeBand(String value) {
        String raw = text(value);
        if (raw == null) return new Semantic(null, "unavailable");
        String normalized = raw.toLowerCase(Locale.ROOT);
        if (Set.of("dawn", "day", "dusk", "night").contains(normalized)) {
            return new Semantic(normalized, "observed");
        }
        Matcher matcher = CLOCK.matcher(normalized);
        if (!matcher.matches()) return new Semantic(null, "unresolved");
        int hour = Integer.parseInt(matcher.group(1));
        int minute = Integer.parseInt(matcher.group(2));
        if (hour < 1 || hour > 12 || minute > 59) return new Semantic(null, "unresolved");
        if (hour == 12) hour = 0;
        if (matcher.group(3).equalsIgnoreCase("pm")) hour += 12;
        int minutes = hour * 60 + minute;
        String band = minutes >= 5 * 60 && minutes < 8 * 60 ? "dawn"
                : minutes >= 8 * 60 && minutes < 18 * 60 ? "day"
                : minutes >= 18 * 60 && minutes < 21 * 60 ? "dusk"
                : "night";
        return new Semantic(band, "derived");
    }

    private static String state(String value, Set<String> allowed, String fallback) {
        String normalized = lower(value);
        return normalized != null && allowed.contains(normalized) ? normalized : fallback;
    }

    private static String requiredText(String value, String field) {
        String cleaned = text(value);
        if (cleaned == null) throw new IllegalArgumentException(field + " is required");
        return cleaned;
    }

    private static String text(String value) {
        if (value == null) return null;
        String cleaned = value.trim().replaceAll("\\s+", " ");
        return cleaned.isEmpty() ? null : cleaned;
    }

    private static String lower(String value) {
        String cleaned = text(value);
        return cleaned == null ? null : cleaned.toLowerCase(Locale.ROOT);
    }

    public static String normalizedFishId(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFKD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-+|-+$)", "");
    }

    private static Double positiveFinite(Double value) {
        return value != null && Double.isFinite(value) && value > 0 ? value : null;
    }

    private static List<String> cleanList(List<String> values) {
        if (values == null) return List.of();
        List<String> output = new ArrayList<>();
        for (String value : values) {
            String cleaned = text(value);
            if (cleaned != null) output.add(cleaned);
        }
        return List.copyOf(output);
    }

    private record Semantic(String value, String status) {}

}
