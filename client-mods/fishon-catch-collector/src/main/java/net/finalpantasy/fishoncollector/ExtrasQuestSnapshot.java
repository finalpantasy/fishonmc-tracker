package net.finalpantasy.fishoncollector;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class ExtrasQuestSnapshot {
    private final boolean available;
    private final Map<String, List<Quest>> quests;

    private ExtrasQuestSnapshot(boolean available, Map<String, List<Quest>> quests) {
        this.available = available;
        this.quests = quests;
    }

    static ExtrasQuestSnapshot unavailable() {
        return new ExtrasQuestSnapshot(false, Map.of());
    }

    static ExtrasQuestSnapshot fromJson(String json) {
        try {
            JsonObject root = JsonParser.parseString(json).getAsJsonObject();
            JsonObject questList = root.getAsJsonObject("questList");
            if (questList == null) return unavailable();
            Map<String, List<Quest>> parsed = new LinkedHashMap<>();
            for (Map.Entry<String, JsonElement> location : questList.entrySet()) {
                if (!location.getValue().isJsonArray()) continue;
                List<Quest> rows = new ArrayList<>();
                for (JsonElement element : location.getValue().getAsJsonArray()) {
                    if (!element.isJsonObject()) continue;
                    JsonObject quest = element.getAsJsonObject();
                    String goal = string(quest, "goal");
                    int maximum = integer(quest, "max");
                    int current = integer(quest, "current");
                    if (!goal.isBlank() && maximum > 0) rows.add(new Quest(goal, maximum, current));
                }
                parsed.put(location.getKey(), List.copyOf(rows));
            }
            return new ExtrasQuestSnapshot(true, Collections.unmodifiableMap(parsed));
        } catch (RuntimeException ignored) {
            return unavailable();
        }
    }

    boolean available() { return available; }
    boolean knowsLocation(String location) { return available && location != null && quests.containsKey(location); }
    List<Quest> quests(String location) { return location == null ? List.of() : quests.getOrDefault(location, List.of()); }

    private static String string(JsonObject object, String key) {
        try {
            return object.has(key) ? object.get(key).getAsString() : "";
        } catch (RuntimeException ignored) {
            return "";
        }
    }

    private static int integer(JsonObject object, String key) {
        try {
            return object.has(key) ? Math.max(0, object.get(key).getAsInt()) : 0;
        } catch (RuntimeException ignored) {
            return 0;
        }
    }

    record Quest(String goal, int max, int current) {
        Quest {
            goal = goal == null ? "" : goal;
            max = Math.max(0, max);
            current = Math.max(0, current);
        }

        boolean complete() { return max > 0 && current >= max; }
    }
}
