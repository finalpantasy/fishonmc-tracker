package net.finalpantasy.fishoncollector;

import java.io.Reader;
import java.io.Writer;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.Properties;

public final class UpdateCheckCache {
    private final Path path;

    public UpdateCheckCache(Path path) {
        this.path = path == null ? null : path.toAbsolutePath().normalize();
    }

    public Optional<State> load(String channel, String minecraftVersion) {
        if (path == null || !Files.isRegularFile(path) || channel == null || minecraftVersion == null) {
            return Optional.empty();
        }
        try {
            Properties properties = new Properties();
            try (Reader reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
                properties.load(reader);
            }
            if (!channel.equals(properties.getProperty("channel"))) return Optional.empty();
            if (!minecraftVersion.equals(properties.getProperty("minecraftVersion"))) return Optional.empty();
            Instant checkedAt = Instant.parse(properties.getProperty("checkedAt"));
            boolean hasRelease = Boolean.parseBoolean(properties.getProperty("hasRelease", "true"));
            CompatibleRelease release = null;
            if (hasRelease) {
                String version = properties.getProperty("version");
                URI releaseUrl = URI.create(properties.getProperty("releaseUrl"));
                if (!CollectorVersion.isValid(version) || !UpdateDocumentParser.isAllowedReleaseUri(releaseUrl)) {
                    return Optional.empty();
                }
                release = new CompatibleRelease(version, releaseUrl);
            }
            return Optional.of(new State(checkedAt, channel, minecraftVersion, release));
        } catch (RuntimeException | java.io.IOException error) {
            return Optional.empty();
        }
    }

    public void save(State state) {
        if (path == null || state == null) return;
        try {
            Path parent = path.getParent();
            if (parent != null) Files.createDirectories(parent);
            Properties properties = new Properties();
            properties.setProperty("checkedAt", state.checkedAt().toString());
            properties.setProperty("channel", state.channel());
            properties.setProperty("minecraftVersion", state.minecraftVersion());
            properties.setProperty("hasRelease", Boolean.toString(state.release() != null));
            if (state.release() != null) {
                properties.setProperty("version", state.release().version());
                properties.setProperty("releaseUrl", state.release().releaseUrl().toString());
            }
            try (Writer writer = Files.newBufferedWriter(
                    path,
                    StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE,
                    StandardOpenOption.TRUNCATE_EXISTING,
                    StandardOpenOption.WRITE)) {
                properties.store(writer, "FishOn Catch Collector update cache");
            }
        } catch (RuntimeException | java.io.IOException ignored) {
            // Update checking is optional and must never affect collection or startup.
        }
    }

    public boolean isFresh(State state, Instant now, Duration interval) {
        if (state == null || now == null || interval == null || interval.isNegative() || interval.isZero()) {
            return false;
        }
        Instant expiresAt;
        try {
            expiresAt = state.checkedAt().plus(interval);
        } catch (RuntimeException error) {
            return false;
        }
        return now.isBefore(expiresAt);
    }

    public record State(
            Instant checkedAt,
            String channel,
            String minecraftVersion,
            CompatibleRelease release) {}
}
