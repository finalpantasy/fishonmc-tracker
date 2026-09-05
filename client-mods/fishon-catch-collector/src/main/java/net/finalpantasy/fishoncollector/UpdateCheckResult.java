package net.finalpantasy.fishoncollector;

import java.util.Optional;

public record UpdateCheckResult(Status status, CompatibleRelease compatibleRelease) {
    public enum Status {
        DISABLED,
        CURRENT,
        UPDATE_AVAILABLE,
        UNAVAILABLE
    }

    public Optional<CompatibleRelease> release() {
        return Optional.ofNullable(compatibleRelease);
    }

    static UpdateCheckResult disabled() {
        return new UpdateCheckResult(Status.DISABLED, null);
    }

    static UpdateCheckResult unavailable() {
        return new UpdateCheckResult(Status.UNAVAILABLE, null);
    }

    static UpdateCheckResult evaluate(String installedVersion, CompatibleRelease release) {
        if (release == null || !CollectorVersion.isValid(installedVersion)) return unavailable();
        return CollectorVersion.isNewer(release.version(), installedVersion)
                ? new UpdateCheckResult(Status.UPDATE_AVAILABLE, release)
                : new UpdateCheckResult(Status.CURRENT, release);
    }
}
