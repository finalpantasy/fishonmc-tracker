package net.finalpantasy.fishoncollector;

import com.google.gson.Gson;
import com.google.gson.JsonParseException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

public final class PublishedFishIndex {
    private static final Gson GSON = new Gson();

    private final String snapshot;
    private final Map<String, PublishedFish> fish;

    private PublishedFishIndex(String snapshot, Map<String, PublishedFish> fish) {
        this.snapshot = snapshot;
        this.fish = Collections.unmodifiableMap(new LinkedHashMap<>(fish));
    }

    public static PublishedFishIndex load(InputStream input) {
        if (input == null) throw new IllegalArgumentException("published fish resource is required");
        try (InputStreamReader reader = new InputStreamReader(input, StandardCharsets.UTF_8)) {
            Resource resource = GSON.fromJson(reader, Resource.class);
            if (resource == null || resource.schemaVersion != 1) {
                throw new IllegalArgumentException("unsupported published fish schema");
            }
            String snapshot = required(resource.snapshot, "snapshot");
            Map<String, PublishedFish> fish = new LinkedHashMap<>();
            if (resource.fish != null) {
                for (ResourceFish row : resource.fish) {
                    if (row == null) throw new IllegalArgumentException("null published fish row");
                    String id = required(row.normalizedId, "normalizedId").toLowerCase(Locale.ROOT);
                    String displayName = required(row.displayName, "displayName");
                    Double maximum = positiveFinite(row.maximumWeightLb) ? row.maximumWeightLb : null;
                    if (fish.putIfAbsent(id, new PublishedFish(id, displayName, maximum)) != null) {
                        throw new IllegalArgumentException("duplicate published fish id");
                    }
                }
            }
            return new PublishedFishIndex(snapshot, fish);
        } catch (JsonParseException error) {
            throw new IllegalArgumentException("malformed published fish resource", error);
        } catch (java.io.IOException error) {
            throw new IllegalArgumentException("published fish resource could not be read", error);
        }
    }

    public Optional<PublishedFish> find(String normalizedId) {
        if (normalizedId == null) return Optional.empty();
        return Optional.ofNullable(fish.get(normalizedId.trim().toLowerCase(Locale.ROOT)));
    }

    public String snapshot() {
        return snapshot;
    }

    public int size() {
        return fish.size();
    }

    private static String required(String value, String field) {
        String cleaned = value == null ? "" : value.trim().replaceAll("\\s+", " ");
        if (cleaned.isEmpty() || cleaned.length() > 160) {
            throw new IllegalArgumentException(field + " is invalid");
        }
        return cleaned;
    }

    private static boolean positiveFinite(Double value) {
        return value != null && Double.isFinite(value) && value > 0;
    }

    public record PublishedFish(String normalizedId, String displayName, Double maximumWeightLb) {}

    private static final class Resource {
        int schemaVersion;
        String snapshot;
        ResourceFish[] fish;
    }

    private static final class ResourceFish {
        String normalizedId;
        String displayName;
        Double maximumWeightLb;
    }
}
