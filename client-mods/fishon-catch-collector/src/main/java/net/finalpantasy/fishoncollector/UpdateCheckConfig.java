package net.finalpantasy.fishoncollector;

import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Locale;
import java.util.Properties;

public record UpdateCheckConfig(boolean enabled, String channel, int intervalHours) {
    private static final String DEFAULT_TEXT = """
            updateChecks=true
            updateChannel=stable
            updateCheckIntervalHours=24
            """;

    public UpdateCheckConfig {
        channel = normalizeChannel(channel);
        intervalHours = intervalHours >= 1 && intervalHours <= 168 ? intervalHours : 24;
    }

    public static UpdateCheckConfig defaults() {
        return new UpdateCheckConfig(true, "stable", 24);
    }

    public static UpdateCheckConfig load(Path path) {
        if (path == null) return defaults();
        Path normalized = path.toAbsolutePath().normalize();
        try {
            Path parent = normalized.getParent();
            if (parent != null) Files.createDirectories(parent);
            if (!Files.isRegularFile(normalized)) {
                Files.writeString(
                        normalized,
                        DEFAULT_TEXT,
                        StandardCharsets.UTF_8,
                        StandardOpenOption.CREATE_NEW,
                        StandardOpenOption.WRITE);
            }

            Properties properties = new Properties();
            try (Reader reader = Files.newBufferedReader(normalized, StandardCharsets.UTF_8)) {
                properties.load(reader);
            }

            UpdateCheckConfig defaults = defaults();
            return new UpdateCheckConfig(
                    bool(properties, "updateChecks", defaults.enabled),
                    normalizeChannel(properties.getProperty("updateChannel", defaults.channel)),
                    integer(properties, "updateCheckIntervalHours", defaults.intervalHours));
        } catch (IOException | RuntimeException error) {
            return defaults();
        }
    }

    private static String normalizeChannel(String value) {
        if (value == null) return "stable";
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return "stable".equals(normalized) ? normalized : "stable";
    }

    private static boolean bool(Properties properties, String key, boolean fallback) {
        String value = properties.getProperty(key);
        if (value == null) return fallback;
        if ("true".equalsIgnoreCase(value.trim())) return true;
        if ("false".equalsIgnoreCase(value.trim())) return false;
        return fallback;
    }

    private static int integer(Properties properties, String key, int fallback) {
        String value = properties.getProperty(key);
        if (value == null) return fallback;
        try {
            int parsed = Integer.parseInt(value.trim());
            return parsed >= 1 && parsed <= 168 ? parsed : fallback;
        } catch (NumberFormatException error) {
            return fallback;
        }
    }
}
