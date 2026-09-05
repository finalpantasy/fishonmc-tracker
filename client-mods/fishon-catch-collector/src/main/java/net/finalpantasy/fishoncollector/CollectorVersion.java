package net.finalpantasy.fishoncollector;

import net.fabricmc.loader.api.SemanticVersion;

public final class CollectorVersion {
    private CollectorVersion() {}

    public static boolean isValid(String value) {
        return parse(value) != null;
    }

    public static boolean isNewer(String candidate, String installed) {
        SemanticVersion candidateVersion = parse(candidate);
        SemanticVersion installedVersion = parse(installed);
        if (candidateVersion == null || installedVersion == null) return false;
        if (isPrerelease(candidate)) return false;
        return candidateVersion.compareTo(installedVersion) > 0;
    }

    private static SemanticVersion parse(String value) {
        if (value == null || value.isBlank() || "unknown".equalsIgnoreCase(value.trim())) return null;
        try {
            return SemanticVersion.parse(value.trim());
        } catch (Exception error) {
            return null;
        }
    }

    private static boolean isPrerelease(String value) {
        String normalized = value == null ? "" : value.trim();
        int build = normalized.indexOf('+');
        String withoutBuild = build >= 0 ? normalized.substring(0, build) : normalized;
        return withoutBuild.indexOf('-') >= 0;
    }
}
