package net.finalpantasy.fishoncollector;

import java.net.URI;
import java.util.Objects;

public record CompatibleRelease(String version, URI releaseUrl) {
    public CompatibleRelease {
        version = Objects.requireNonNull(version, "version").trim();
        releaseUrl = Objects.requireNonNull(releaseUrl, "releaseUrl");
    }
}
