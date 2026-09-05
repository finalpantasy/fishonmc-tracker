package net.finalpantasy.fishoncollector;

record ExtrasLiveSnapshot(String location, String weather, Bait bait, Contest contest) {
    ExtrasLiveSnapshot {
        location = clean(location);
        weather = clean(weather);
    }

    private static String clean(String value) {
        if (value == null) return null;
        String cleaned = value.trim();
        return cleaned.isEmpty() ? null : cleaned;
    }

    record Bait(String name, int count, boolean disabled) {
        Bait {
            name = clean(name);
            count = Math.max(0, count);
        }
    }

    record Contest(boolean active, long secondsToStart, long secondsToEnd) {
        Contest {
            secondsToStart = Math.max(0, secondsToStart);
            secondsToEnd = Math.max(0, secondsToEnd);
        }
    }
}
