package net.finalpantasy.fishoncollector;

import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Properties;

public record CatchbookTooltipConfig(
        boolean catchbookTooltips,
        boolean expandedDetailsRequireShift,
        boolean showCapturedSetup,
        boolean showPublishedMaximum) {
    private static final String DEFAULT_TEXT = """
            catchbookTooltips=true
            expandedDetailsRequireShift=true
            showCapturedSetup=true
            showPublishedMaximum=true
            """;

    public static CatchbookTooltipConfig defaults() {
        return new CatchbookTooltipConfig(true, true, true, true);
    }

    public static CatchbookTooltipConfig load(Path path) {
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
            CatchbookTooltipConfig defaults = defaults();
            return new CatchbookTooltipConfig(
                    bool(properties, "catchbookTooltips", defaults.catchbookTooltips),
                    bool(properties, "expandedDetailsRequireShift", defaults.expandedDetailsRequireShift),
                    bool(properties, "showCapturedSetup", defaults.showCapturedSetup),
                    bool(properties, "showPublishedMaximum", defaults.showPublishedMaximum));
        } catch (IOException | RuntimeException error) {
            return defaults();
        }
    }

    private static boolean bool(Properties properties, String key, boolean fallback) {
        String value = properties.getProperty(key);
        if (value == null) return fallback;
        if ("true".equalsIgnoreCase(value.trim())) return true;
        if ("false".equalsIgnoreCase(value.trim())) return false;
        return fallback;
    }
}
