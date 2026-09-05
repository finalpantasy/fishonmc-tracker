package net.finalpantasy.fishoncollector;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Properties;

final class FishStatsNotificationState {
    private final Path path;
    private int questCapacity;

    private FishStatsNotificationState(Path path, int questCapacity) {
        this.path = path;
        this.questCapacity = Math.max(1, questCapacity);
    }

    static FishStatsNotificationState load(Path path, int fallback) {
        int value = Math.max(1, fallback);
        if (path != null && Files.isRegularFile(path)) {
            try (var reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
                Properties properties = new Properties();
                properties.load(reader);
                value = Math.max(value, Integer.parseInt(properties.getProperty("questCapacity", "0").trim()));
            } catch (IOException | RuntimeException ignored) {
                // A missing or partial state file safely falls back to the configured capacity.
            }
        }
        return new FishStatsNotificationState(path, value);
    }

    int questCapacity() {
        return questCapacity;
    }

    void rememberQuestCapacity(int observed) {
        if (observed <= questCapacity) return;
        questCapacity = observed;
        if (path == null) return;
        try {
            Path parent = path.toAbsolutePath().normalize().getParent();
            if (parent != null) Files.createDirectories(parent);
            Files.writeString(path, "questCapacity=" + questCapacity + System.lineSeparator(),
                    StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        } catch (IOException ignored) {
            // Persistence failure must not break HUD rendering.
        }
    }
}
