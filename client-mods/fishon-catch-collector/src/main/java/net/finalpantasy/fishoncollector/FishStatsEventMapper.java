package net.finalpantasy.fishoncollector;

import java.util.Locale;

final class FishStatsEventMapper {
    private FishStatsEventMapper() {}

    static FishStatsSignalSnapshot.EventState fromWeather(String weather) {
        if (weather == null || weather.isBlank()) return null;
        String value = weather.trim().toLowerCase(Locale.ROOT);
        if (value.contains("rainbow")) return active("rainbow", "Rainbow");
        if (value.contains("supercell")) return active("supercell", "Supercell");
        if (value.contains("thunder") || value.contains("storm") || value.contains("lightning")) {
            return active("thunderstorm", "Thunderstorm");
        }
        if (value.contains("blood moon")) return active("blood-moon", "Blood Moon");
        if (value.contains("blue moon")) return active("blue-moon", "Blue Moon");
        if (value.contains("supermoon") || value.contains("super moon")) return active("supermoon", "Supermoon");
        if (value.contains("full moon")) return active("full-moon", "Full Moon");
        if (value.contains("gold rush") || value.contains("prospect")) return active("gold-rush", "Gold Rush");
        if (value.contains("bloom")) return active("blooming-oasis", "Blooming Oasis");
        if (value.contains("fabled")) return active("fabled", "Fabled Weather");
        if (value.contains("rain") || value.contains("shower")) return active("rain", "Rain");
        if (value.contains("clear") || value.contains("sunny") || value.equals("sun")) {
            return new FishStatsSignalSnapshot.EventState("clear", "Clear", false, null, null);
        }
        return null;
    }

    private static FishStatsSignalSnapshot.EventState active(String key, String label) {
        return new FishStatsSignalSnapshot.EventState(key, label, true, null, null);
    }
}
