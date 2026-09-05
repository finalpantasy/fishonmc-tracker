package net.finalpantasy.fishoncollector;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

final class ExtrasStatsSnapshot {
    private final int fishTotal;
    private final Map<String, Map<String, Stat>> fishData;
    private final int petTotal;
    private final int petDry;
    private final Map<String, Stat> itemData;

    private ExtrasStatsSnapshot(
            int fishTotal,
            Map<String, Map<String, Stat>> fishData,
            int petTotal,
            int petDry,
            Map<String, Stat> itemData) {
        this.fishTotal = Math.max(0, fishTotal);
        this.fishData = fishData;
        this.petTotal = Math.max(0, petTotal);
        this.petDry = Math.max(0, petDry);
        this.itemData = itemData;
    }

    static ExtrasStatsSnapshot empty() {
        return new ExtrasStatsSnapshot(0, Map.of(), 0, 0, Map.of());
    }

    static ExtrasStatsSnapshot fromJson(String json) {
        try {
            JsonObject root = JsonParser.parseString(json).getAsJsonObject();
            int total = integer(root, "fishTotal");
            Map<String, Map<String, Stat>> fish = parseFishData(root.getAsJsonObject("fishData"));
            int pets = integer(root, "petTotal");
            int petCaughtOn = latestCaughtOn(root.getAsJsonObject("petData"));
            Map<String, Stat> items = parseStats(root.getAsJsonObject("itemData"));
            return new ExtrasStatsSnapshot(total, fish, pets, total - petCaughtOn, items);
        } catch (RuntimeException ignored) {
            return empty();
        }
    }

    int fishTotal() { return fishTotal; }
    int petTotal() { return petTotal; }
    int petDry() { return petDry; }

    int fishCount(String category, String field) {
        return fishStat(category, field).amount();
    }

    int fishDry(String category, String field) {
        return Math.max(0, fishTotal - fishStat(category, field).caughtOn());
    }

    double fishPercent(String category, String field) {
        return fishTotal > 0 ? fishCount(category, field) * 100.0 / fishTotal : 0;
    }

    int itemCount(String item) { return itemData.getOrDefault(item, Stat.ZERO).amount(); }
    int itemDry(String item) { return Math.max(0, fishTotal - itemData.getOrDefault(item, Stat.ZERO).caughtOn()); }

    Map<String, Integer> rewardCounts() {
        Map<String, Integer> rewards = new HashMap<>();
        rewards.put("pet", petTotal);
        itemData.forEach((key, stat) -> rewards.put(key, Math.max(0, stat.amount())));
        return Collections.unmodifiableMap(rewards);
    }

    private Stat fishStat(String category, String field) {
        return fishData.getOrDefault(category, Map.of()).getOrDefault(field, Stat.ZERO);
    }

    private static Map<String, Map<String, Stat>> parseFishData(JsonObject object) {
        if (object == null) return Map.of();
        Map<String, Map<String, Stat>> output = new HashMap<>();
        for (Map.Entry<String, JsonElement> entry : object.entrySet()) {
            if (entry.getValue().isJsonObject()) output.put(entry.getKey(), parseStats(entry.getValue().getAsJsonObject()));
        }
        return Collections.unmodifiableMap(output);
    }

    private static Map<String, Stat> parseStats(JsonObject object) {
        if (object == null) return Map.of();
        Map<String, Stat> output = new HashMap<>();
        for (Map.Entry<String, JsonElement> entry : object.entrySet()) {
            if (!entry.getValue().isJsonObject()) continue;
            JsonObject stat = entry.getValue().getAsJsonObject();
            output.put(entry.getKey(), new Stat(integer(stat, "amount"), integer(stat, "caughtOn")));
        }
        return Collections.unmodifiableMap(output);
    }

    private static int latestCaughtOn(JsonObject petData) {
        if (petData == null) return 0;
        int latest = 0;
        for (JsonElement category : petData.asMap().values()) {
            if (!category.isJsonObject()) continue;
            for (Stat stat : parseStats(category.getAsJsonObject()).values()) latest = Math.max(latest, stat.caughtOn());
        }
        return latest;
    }

    private static int integer(JsonObject object, String key) {
        if (object == null || !object.has(key) || !object.get(key).isJsonPrimitive()) return 0;
        try {
            return object.get(key).getAsInt();
        } catch (RuntimeException ignored) {
            return 0;
        }
    }

    private record Stat(int amount, int caughtOn) {
        private static final Stat ZERO = new Stat(0, 0);
    }
}
