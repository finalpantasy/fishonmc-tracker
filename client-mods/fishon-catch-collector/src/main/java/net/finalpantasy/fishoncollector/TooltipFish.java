package net.finalpantasy.fishoncollector;

import java.util.Locale;

public record TooltipFish(
        String normalizedId,
        String eventId,
        Double weightLb,
        String variant,
        String size) {
    public TooltipFish {
        normalizedId = cleanRequired(normalizedId);
        eventId = clean(eventId);
        weightLb = weightLb != null && Double.isFinite(weightLb) && weightLb > 0 ? weightLb : null;
        variant = clean(variant);
        if (variant == null) variant = "normal";
        size = clean(size);
    }

    private static String cleanRequired(String value) {
        String cleaned = clean(value);
        if (cleaned == null) throw new IllegalArgumentException("normalized fish id is required");
        return cleaned;
    }

    private static String clean(String value) {
        if (value == null) return null;
        String cleaned = value.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
        return cleaned.isEmpty() ? null : cleaned;
    }
}
