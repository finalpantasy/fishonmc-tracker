package net.finalpantasy.fishoncollector;

import java.util.Map;
import java.util.Optional;

public record UpdateDocument(
        int schemaVersion,
        String modId,
        Map<String, Map<String, CompatibleRelease>> channels) {
    public Optional<CompatibleRelease> compatibleRelease(String channel, String minecraftVersion) {
        if (channel == null || minecraftVersion == null || channels == null) return Optional.empty();
        Map<String, CompatibleRelease> versions = channels.get(channel);
        if (versions == null) return Optional.empty();
        return Optional.ofNullable(versions.get(minecraftVersion));
    }
}
