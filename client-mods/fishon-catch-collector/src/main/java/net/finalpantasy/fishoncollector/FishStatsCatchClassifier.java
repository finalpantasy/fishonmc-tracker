package net.finalpantasy.fishoncollector;

import java.util.Locale;
import java.util.Optional;

final class FishStatsCatchClassifier {
    private FishStatsCatchClassifier() {}

    static Result classify(CatchbookIndex before, CatchObservation event) {
        if (before == null || event == null || event.fish() == null) return Result.NONE;
        CatchObservation.Fish fish = event.fish();
        Optional<CatchbookIndex.SpeciesSummary> species = before.species(fish.normalizedId());
        String variant = clean(fish.variant());
        boolean newSpecies = species.isEmpty();
        boolean newVariant = variant != null
                && !"normal".equals(variant)
                && (newSpecies || !species.orElseThrow().variants().contains(variant));
        double oldPersonalBest = before.personalBestWeightLb();
        double weight = positive(fish.weightLb()) ? fish.weightLb() : 0;
        boolean newPersonalBest = oldPersonalBest > 0 && weight > oldPersonalBest;
        return new Result(newPersonalBest, oldPersonalBest, weight, newSpecies, newVariant, variant);
    }

    private static boolean positive(Double value) {
        return value != null && Double.isFinite(value) && value > 0;
    }

    private static String clean(String value) {
        if (value == null) return null;
        String cleaned = value.trim().toLowerCase(Locale.ROOT);
        return cleaned.isEmpty() ? null : cleaned;
    }

    record Result(
            boolean newPersonalBest,
            double previousPersonalBestLb,
            double newPersonalBestLb,
            boolean newSpecies,
            boolean newVariant,
            String variant) {
        private static final Result NONE = new Result(false, 0, 0, false, false, null);
    }
}
