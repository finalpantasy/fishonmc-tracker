package net.finalpantasy.fishoncollector;

import com.google.gson.Gson;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;

public final class CatchbookIndex {
    private static final Gson GSON = new Gson();

    private final Map<String, CatchObservation> events;
    private final Map<String, SpeciesSummary> species;
    private final int malformedRows;

    private CatchbookIndex(Map<String, CatchObservation> events, int malformedRows) {
        this.events = Collections.unmodifiableMap(new LinkedHashMap<>(events));
        this.species = Collections.unmodifiableMap(buildSpecies(this.events.values()));
        this.malformedRows = malformedRows;
    }

    public static CatchbookIndex empty() {
        return new CatchbookIndex(Map.of(), 0);
    }

    public static CatchbookIndex fromJsonLines(Stream<String> lines) {
        if (lines == null) return empty();
        Map<String, CatchObservation> events = new LinkedHashMap<>();
        int[] malformed = {0};
        lines.forEach(line -> {
            try {
                CatchObservation event = GSON.fromJson(line, CatchObservation.class);
                if (!valid(event)) {
                    malformed[0]++;
                    return;
                }
                events.putIfAbsent(event.eventId(), event);
            } catch (RuntimeException error) {
                malformed[0]++;
            }
        });
        return new CatchbookIndex(events, malformed[0]);
    }

    public CatchbookIndex with(CatchObservation event) {
        if (!valid(event)) return this;
        if (events.containsKey(event.eventId())) return this;
        Map<String, CatchObservation> next = new LinkedHashMap<>(events);
        next.put(event.eventId(), event);
        return new CatchbookIndex(next, malformedRows);
    }

    public Optional<SpeciesSummary> species(String normalizedFishId) {
        return Optional.ofNullable(species.get(clean(normalizedFishId)));
    }

    public Optional<CatchObservation> event(String eventId) {
        return Optional.ofNullable(events.get(eventId));
    }

    public int malformedRows() {
        return malformedRows;
    }

    public int eventCount() {
        return events.size();
    }

    public double personalBestWeightLb() {
        return events.values().stream()
                .map(CatchObservation::fish)
                .filter(java.util.Objects::nonNull)
                .map(CatchObservation.Fish::weightLb)
                .filter(CatchbookIndex::positiveFinite)
                .mapToDouble(Double::doubleValue)
                .max()
                .orElse(0);
    }

    private static boolean valid(CatchObservation event) {
        return event != null
                && (event.schemaVersion() == 1 || event.schemaVersion() == 2)
                && clean(event.eventId()) != null
                && event.eventId().startsWith("collectorcatch-")
                && event.fish() != null
                && clean(event.fish().normalizedId()) != null
                && event.source() != null
                && "observed".equals(clean(event.source().confidence()));
    }

    private static Map<String, SpeciesSummary> buildSpecies(Iterable<CatchObservation> events) {
        Map<String, List<CatchObservation>> groups = new LinkedHashMap<>();
        for (CatchObservation event : events) {
            String id = clean(event.fish().normalizedId());
            groups.computeIfAbsent(id, ignored -> new ArrayList<>()).add(event);
        }
        Map<String, SpeciesSummary> output = new LinkedHashMap<>();
        for (Map.Entry<String, List<CatchObservation>> entry : groups.entrySet()) {
            output.put(entry.getKey(), summarize(entry.getValue()));
        }
        return output;
    }

    private static SpeciesSummary summarize(List<CatchObservation> observations) {
        List<Double> weights = observations.stream()
                .map(event -> event.fish().weightLb())
                .filter(CatchbookIndex::positiveFinite)
                .sorted()
                .toList();
        Set<String> variants = new LinkedHashSet<>();
        Map<String, String> firstEventIds = new LinkedHashMap<>();
        for (CatchObservation event : observations) {
            String variant = clean(event.fish().variant());
            if (variant != null) {
                variants.add(variant);
                firstEventIds.putIfAbsent(variant, event.eventId());
            }
            String size = clean(event.fish().size());
            if ("gigantic".equals(size)) {
                variants.add("gigantic");
                firstEventIds.putIfAbsent("gigantic", event.eventId());
            }
        }
        Double minimum = weights.isEmpty() ? null : weights.getFirst();
        Double maximum = weights.isEmpty() ? null : weights.getLast();
        Double mean = weights.isEmpty()
                ? null
                : weights.stream().mapToDouble(Double::doubleValue).average().orElseThrow();
        Double median = weights.isEmpty()
                ? null
                : weights.size() % 2 == 1
                        ? weights.get(weights.size() / 2)
                        : (weights.get(weights.size() / 2 - 1) + weights.get(weights.size() / 2)) / 2.0;
        return new SpeciesSummary(
                observations.size(),
                weights,
                minimum,
                mean,
                median,
                maximum,
                variants,
                firstEventIds);
    }

    private static boolean positiveFinite(Double value) {
        return value != null && Double.isFinite(value) && value > 0;
    }

    private static String clean(String value) {
        if (value == null) return null;
        String cleaned = value.trim().toLowerCase(Locale.ROOT);
        return cleaned.isEmpty() ? null : cleaned;
    }

    public record SpeciesSummary(
            int observedCount,
            List<Double> weightsLb,
            Double minimumLb,
            Double meanLb,
            Double medianLb,
            Double maximumLb,
            Set<String> variants,
            Map<String, String> firstEventIds) {
        public SpeciesSummary {
            weightsLb = List.copyOf(weightsLb);
            variants = Set.copyOf(variants);
            firstEventIds = Map.copyOf(firstEventIds);
        }

        public int weightedCount() {
            return weightsLb.size();
        }

        public Integer rank(Double weightLb) {
            if (!positiveFinite(weightLb) || weightsLb.isEmpty()) return null;
            int heavier = 0;
            for (Double observed : weightsLb) if (observed > weightLb) heavier++;
            return heavier + 1;
        }

        public Optional<String> firstEventId(String completionKey) {
            return Optional.ofNullable(firstEventIds.get(clean(completionKey)));
        }
    }
}
