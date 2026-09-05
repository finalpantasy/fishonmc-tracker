package net.finalpantasy.fishoncollector;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.stream.Collectors;

final class FishStatsNotificationCenter {
    private static final int RED = 0xFFFF6262;
    private static final int ORANGE = 0xFFFFA047;
    private static final int GOLD = 0xFFF2D75C;
    private static final int GREEN = 0xFF65E67A;
    private static final int CYAN = 0xFF4DE6E6;
    private static final int MAGENTA = 0xFFF25BEF;
    private final FishStatsNotificationConfig config;
    private final int initialQuestCapacity;
    private final List<Entry> pending = new ArrayList<>();
    private final Map<String, PersistentBadge> persistent = new LinkedHashMap<>();
    private Entry active;
    private long sequence;
    private boolean backpackSeen;
    private int backpackNotifiedBand;
    private boolean baitSeen;
    private String baitName;
    private int baitBand;
    private final Map<String, List<ExtrasQuestSnapshot.Quest>> previousQuests = new LinkedHashMap<>();
    private int learnedQuestCapacity;
    private ExtrasLiveSnapshot.Contest previousContest;
    private boolean contestEarlyFired;
    private boolean contestLateFired;
    private FishStatsSignalSnapshot.EventState previousEvent;
    private boolean eventStartEarlyFired;
    private boolean eventStartLateFired;
    private boolean eventEndLateFired;

    FishStatsNotificationCenter(FishStatsNotificationConfig config) {
        this(config, config == null ? FishStatsNotificationConfig.defaults().questSlots() : config.questSlots());
    }

    FishStatsNotificationCenter(FishStatsNotificationConfig config, int initialQuestCapacity) {
        this.config = config == null ? FishStatsNotificationConfig.defaults() : config;
        this.initialQuestCapacity = Math.max(this.config.questSlots(), initialQuestCapacity);
        this.learnedQuestCapacity = this.initialQuestCapacity;
    }

    synchronized void acceptSignals(FishStatsSignalSnapshot signals, long nowMs) {
        if (signals == null) return;
        acceptBackpack(signals.backpack(), nowMs);
        acceptBait(signals.bait(), nowMs);
        acceptQuests(signals.location(), signals.quests(), nowMs);
        acceptContest(signals.contest(), nowMs);
        acceptEvent(signals.event(), nowMs);
    }

    synchronized int learnedQuestCapacity() {
        return learnedQuestCapacity;
    }

    synchronized void acceptCatch(
            CatchObservation event,
            FishStatsCatchClassifier.Result classification,
            long nowMs) {
        if (event == null || event.fish() == null || classification == null) return;
        CatchObservation.Fish fish = event.fish();
        String fishName = safeUpper(fish.displayName(), "FISH");
        if (classification.newPersonalBest()) {
            enqueue(note(FishStatsNotification.Type.PERSONAL_BEST,
                    "pb:" + safeKey(fish.normalizedId()), 3, GOLD,
                    "NEW PERSONAL BEST", fishName + "  " + weight(classification.previousPersonalBestLb())
                            + " -> " + weight(classification.newPersonalBestLb()), false), nowMs);
        }
        if (classification.newSpecies()) {
            String detail = classification.newVariant()
                    ? safeUpper(classification.variant(), "SPECIAL") + "  " + fishName
                    : fishName;
            enqueue(note(FishStatsNotification.Type.DISCOVERY,
                    "discovery:species:" + safeKey(fish.normalizedId()), 4, CYAN,
                    "NEW CATCHBOOK FISH", detail, false), nowMs);
        } else if (classification.newVariant()) {
            String variant = safeUpper(classification.variant(), "SPECIAL");
            enqueue(note(FishStatsNotification.Type.DISCOVERY,
                    "discovery:variant:" + safeKey(fish.normalizedId()) + ":" + safeKey(classification.variant()), 4, CYAN,
                    "NEW " + variant + " VARIANT", fishName, false), nowMs);
        }
    }

    synchronized void acceptRewardDeltas(Map<String, Integer> deltas, long nowMs) {
        if (deltas == null) return;
        String detail = deltas.entrySet().stream()
                .filter(entry -> entry.getValue() != null && entry.getValue() > 0)
                .sorted(Comparator.comparingInt((Map.Entry<String, Integer> entry) -> rewardOrder(entry.getKey()))
                        .thenComparing(Map.Entry::getKey))
                .map(entry -> entry.getValue() + " " + rewardLabel(entry.getKey(), entry.getValue()))
                .collect(Collectors.joining("  +  "));
        if (detail.isBlank()) return;
        boolean multiple = deltas.values().stream().filter(value -> value != null && value > 0).count() > 1;
        enqueue(note(FishStatsNotification.Type.REWARD, "reward:" + sequence, 4, MAGENTA,
                multiple ? "RARE REWARDS" : "RARE REWARD", detail, false), nowMs);
    }

    synchronized void enqueue(FishStatsNotification notification, long nowMs) {
        if (notification == null || notification.key().isBlank() || !config.enabled() || !config.typeEnabled(notification.type())) return;
        advance(nowMs);
        if (active != null && active.notification.key().equals(notification.key())) {
            active = Entry.active(notification, nowMs, notification.durationMs(), active.sequence);
            return;
        }
        for (int index = 0; index < pending.size(); index++) {
            Entry entry = pending.get(index);
            if (entry.notification.key().equals(notification.key())) {
                pending.set(index, Entry.pending(notification, notification.durationMs(), entry.sequence));
                return;
            }
        }
        if (active == null) {
            active = Entry.active(notification, nowMs, notification.durationMs(), sequence++);
        } else if (notification.priority() < active.notification.priority()) {
            long remaining = Math.max(1, active.expiresAtMs - nowMs);
            pending.add(Entry.pending(active.notification, remaining, active.sequence));
            active = Entry.active(notification, nowMs, notification.durationMs(), sequence++);
        } else {
            pending.add(Entry.pending(notification, notification.durationMs(), sequence++));
        }
        trimCapacity();
    }

    synchronized void setPersistent(PersistentBadge badge) {
        if (badge != null && badge.key() != null && !badge.key().isBlank()) persistent.put(badge.key(), badge);
    }

    synchronized void clearPersistent(String key) {
        if (key != null) persistent.remove(key);
    }

    synchronized View view(long nowMs) {
        advance(nowMs);
        return new View(active == null ? null : active.notification, visibleBadges());
    }

    synchronized void reset() {
        active = null;
        pending.clear();
        persistent.clear();
        sequence = 0;
        backpackSeen = false;
        backpackNotifiedBand = 0;
        baitSeen = false;
        baitName = null;
        baitBand = 0;
        previousQuests.clear();
        learnedQuestCapacity = initialQuestCapacity;
        previousContest = null;
        contestEarlyFired = false;
        contestLateFired = false;
        previousEvent = null;
        eventStartEarlyFired = false;
        eventStartLateFired = false;
        eventEndLateFired = false;
    }

    private void acceptBackpack(FishStatsSignalSnapshot.Backpack backpack, long nowMs) {
        if (backpack == null || backpack.capacity() <= 0) return;
        int percent = backpack.percent();
        int band = backpackBand(percent, backpack.occupied() == backpack.capacity());
        String backpackLabel = band == 3 ? "BAG FULL" : "BAG " + percent + "%";
        updateConditionBadge("backpack", backpackLabel, band, band >= 2 ? RED : ORANGE, 1);
        if (!backpackSeen) {
            backpackSeen = true;
            backpackNotifiedBand = band;
            return;
        }
        if (percent < config.backpackRearmPercent()) backpackNotifiedBand = 0;
        if (band > backpackNotifiedBand) {
            String key = band == 3 ? "backpack:full" : band == 2 ? "backpack:red" : "backpack:amber";
            String title = band == 3 ? "BACKPACK FULL" : band == 2 ? "BACKPACK ALMOST FULL" : "BACKPACK NEARLY FULL";
            enqueue(note(FishStatsNotification.Type.BACKPACK, key, band == 3 ? 1 : 7,
                    band >= 2 ? RED : ORANGE, title,
                    backpack.occupied() + "/" + backpack.capacity() + " SLOTS", band >= 1), nowMs);
            backpackNotifiedBand = band;
        }
    }

    private int backpackBand(int percent, boolean full) {
        if (full) return 3;
        if (percent >= config.backpackRedPercent()) return 2;
        if (percent >= config.backpackAmberPercent()) return 1;
        return 0;
    }

    private void acceptBait(ExtrasLiveSnapshot.Bait bait, long nowMs) {
        if (bait == null) return;
        if (bait.disabled() || bait.name() == null) {
            baitSeen = true;
            baitName = null;
            baitBand = 0;
            clearPersistent("bait");
            return;
        }
        String normalized = bait.name().toLowerCase(Locale.ROOT);
        int nextBand = baitBand(bait.count());
        updateConditionBadge("bait", "BAIT " + bait.count(), nextBand, nextBand >= 2 ? RED : ORANGE, 2);
        if (!baitSeen) {
            baitSeen = true;
            baitName = normalized;
            baitBand = nextBand;
            return;
        }
        boolean changed = !normalized.equals(baitName);
        if ((changed && nextBand > 0) || (!changed && nextBand > baitBand)) {
            String level = nextBand == 3 ? "empty" : nextBand == 2 ? "critical" : "low";
            String title = nextBand == 3 ? "BAIT DEPLETED" : nextBand == 2 ? "BAIT ALMOST GONE" : "BAIT RUNNING LOW";
            enqueue(note(FishStatsNotification.Type.BAIT, "bait:" + level + ":" + normalized,
                    nextBand == 3 ? 2 : 7, nextBand >= 2 ? RED : ORANGE,
                    title, bait.name().toUpperCase(Locale.ROOT) + "  " + bait.count() + " LEFT", nextBand > 0), nowMs);
        }
        baitName = normalized;
        baitBand = nextBand;
    }

    private int baitBand(int count) {
        if (count <= 0) return 3;
        if (count <= config.baitCritical()) return 2;
        if (count <= config.baitLow()) return 1;
        return 0;
    }

    private void acceptQuests(String location, ExtrasQuestSnapshot quests, long nowMs) {
        if (location == null || quests == null || !quests.available() || !quests.knowsLocation(location)) return;
        List<ExtrasQuestSnapshot.Quest> current = quests.quests(location);
        learnedQuestCapacity = Math.max(learnedQuestCapacity, current.size());
        boolean emptySlot = current.size() < learnedQuestCapacity;
        updateConditionBadge("quest", "Q", emptySlot ? 1 : 0, ORANGE, 3);
        List<ExtrasQuestSnapshot.Quest> previous = previousQuests.put(location, List.copyOf(current));
        if (previous == null) return;
        boolean previousEmpty = previous.size() < learnedQuestCapacity;
        if (!previousEmpty && emptySlot) {
            enqueue(note(FishStatsNotification.Type.QUEST,
                    "quest:empty:" + location.toLowerCase(Locale.ROOT), 6, ORANGE,
                    "QUEST SLOT EMPTY", current.size() + "/" + learnedQuestCapacity + " ACTIVE", true), nowMs);
        }
        int compared = Math.min(previous.size(), current.size());
        for (int index = 0; index < compared; index++) {
            ExtrasQuestSnapshot.Quest before = previous.get(index);
            ExtrasQuestSnapshot.Quest after = current.get(index);
            if (!before.complete() && after.complete()) {
                String cleanedLocation = location.toLowerCase(Locale.ROOT);
                enqueue(note(FishStatsNotification.Type.QUEST,
                        "quest:complete:" + cleanedLocation + ":" + index,
                        6, GREEN,
                        after.goal().toUpperCase(Locale.ROOT) + " COMPLETE",
                        after.current() + "/" + after.max(), false), nowMs);
            }
        }
    }

    private void acceptContest(ExtrasLiveSnapshot.Contest contest, long nowMs) {
        if (contest == null) return;
        if (previousContest == null) {
            previousContest = contest;
            return;
        }
        if (contest.active()) {
            if (!previousContest.active()) {
                contestEarlyFired = false;
                contestLateFired = false;
            }
            previousContest = contest;
            return;
        }
        if (previousContest.active()) {
            contestEarlyFired = false;
            contestLateFired = false;
            previousContest = contest;
            return;
        }
        long previousSeconds = previousContest.secondsToStart();
        if (!contestEarlyFired && previousSeconds > config.contestEarlySeconds()
                && contest.secondsToStart() <= config.contestEarlySeconds()
                && contest.secondsToStart() > config.contestLateSeconds()) {
            enqueue(note(FishStatsNotification.Type.CONTEST, "contest:early", 5, GOLD,
                    "CONTEST STARTING SOON", formatTime(contest.secondsToStart()), false), nowMs);
            contestEarlyFired = true;
        }
        if (!contestLateFired && previousSeconds > config.contestLateSeconds()
                && contest.secondsToStart() <= config.contestLateSeconds()) {
            enqueue(note(FishStatsNotification.Type.CONTEST, "contest:late", 5, GOLD,
                    "CONTEST IN ONE MINUTE", formatTime(contest.secondsToStart()), false), nowMs);
            contestLateFired = true;
        }
        previousContest = contest;
    }

    private void acceptEvent(FishStatsSignalSnapshot.EventState event, long nowMs) {
        if (event == null || event.key() == null) return;
        if (previousEvent == null) {
            previousEvent = event;
            return;
        }
        boolean changed = !event.key().equals(previousEvent.key()) || event.active() != previousEvent.active();
        if (changed && previousEvent.active()) {
            enqueue(note(FishStatsNotification.Type.EVENT, "event:end:" + previousEvent.key(), 5, CYAN,
                    previousEvent.label().toUpperCase(Locale.ROOT) + " ENDED", "EVENT COMPLETE", false), nowMs);
        }
        if (changed && event.active()) {
            enqueue(note(FishStatsNotification.Type.EVENT, "event:start:" + event.key(), 5, CYAN,
                    event.label().toUpperCase(Locale.ROOT) + " STARTED", "SPECIAL EVENT ACTIVE", false), nowMs);
        }
        if (changed) {
            eventStartEarlyFired = false;
            eventStartLateFired = false;
            eventEndLateFired = false;
        } else if (!event.active()) {
            Long before = previousEvent.secondsToStart();
            Long remaining = event.secondsToStart();
            if (before != null && remaining != null) {
                if (!eventStartEarlyFired && before > config.eventEarlySeconds()
                        && remaining <= config.eventEarlySeconds() && remaining > config.eventLateSeconds()) {
                    enqueue(note(FishStatsNotification.Type.EVENT,
                            "event:start-soon:" + event.key() + ":early", 5, CYAN,
                            event.label().toUpperCase(Locale.ROOT) + " STARTING SOON", formatTime(remaining), false), nowMs);
                    eventStartEarlyFired = true;
                }
                if (!eventStartLateFired && before > config.eventLateSeconds()
                        && remaining <= config.eventLateSeconds()) {
                    enqueue(note(FishStatsNotification.Type.EVENT,
                            "event:start-soon:" + event.key() + ":late", 5, CYAN,
                            event.label().toUpperCase(Locale.ROOT) + " IN ONE MINUTE", formatTime(remaining), false), nowMs);
                    eventStartLateFired = true;
                }
            }
        } else {
            Long before = previousEvent.secondsToEnd();
            Long remaining = event.secondsToEnd();
            if (!eventEndLateFired && before != null && remaining != null
                    && before > config.eventLateSeconds() && remaining <= config.eventLateSeconds()) {
                enqueue(note(FishStatsNotification.Type.EVENT,
                        "event:end-soon:" + event.key(), 5, CYAN,
                        event.label().toUpperCase(Locale.ROOT) + " ENDING SOON", formatTime(remaining), false), nowMs);
                eventEndLateFired = true;
            }
        }
        previousEvent = event;
    }

    private void updateConditionBadge(String key, String label, int band, int color, int priority) {
        if (band <= 0) clearPersistent(key);
        else setPersistent(new PersistentBadge(key, label, color, priority));
    }

    private FishStatsNotification note(
            FishStatsNotification.Type type,
            String key,
            int priority,
            int color,
            String title,
            String detail,
            boolean persistent) {
        return new FishStatsNotification(type, key, priority, color, title, detail,
                config.displaySeconds() * 1000L, persistent);
    }

    private static String formatTime(long seconds) {
        return String.format(Locale.ROOT, "%d:%02d", seconds / 60, seconds % 60);
    }

    private static String weight(double pounds) {
        return String.format(Locale.ROOT, "%.2f LB", pounds);
    }

    private static String safeUpper(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim().toUpperCase(Locale.ROOT);
    }

    private static String safeKey(String value) {
        return value == null || value.isBlank() ? "unknown" : value.trim().toLowerCase(Locale.ROOT);
    }

    private static int rewardOrder(String key) {
        if ("pet".equals(key)) return 0;
        if ("armorShard".equals(key)) return 1;
        if ("package".equals(key)) return 2;
        if ("chummer".equals(key)) return 3;
        return 10;
    }

    private static String rewardLabel(String key, int count) {
        return switch (key == null ? "" : key) {
            case "pet" -> count == 1 ? "PET" : "PETS";
            case "armorShard" -> count == 1 ? "SHARD" : "SHARDS";
            case "package" -> count == 1 ? "PACK" : "PACKS";
            case "chummer" -> "CHUM";
            default -> safeUpper(key, "DROP");
        };
    }

    private void advance(long nowMs) {
        while (active != null && nowMs >= active.expiresAtMs) {
            long nextStart = active.expiresAtMs;
            active = takeNext(nextStart);
        }
    }

    private Entry takeNext(long startMs) {
        if (pending.isEmpty()) return null;
        pending.sort(Comparator
                .comparingInt((Entry entry) -> entry.notification.priority())
                .thenComparingLong(entry -> entry.sequence));
        Entry next = pending.removeFirst();
        return Entry.active(next.notification, startMs, next.remainingMs, next.sequence);
    }

    private void trimCapacity() {
        while (pending.size() + (active == null ? 0 : 1) > config.queueCapacity()) {
            Entry worst = pending.stream()
                    .max(Comparator
                            .comparingInt((Entry entry) -> entry.notification.priority())
                            .thenComparingLong(entry -> -entry.sequence))
                    .orElse(null);
            if (worst == null) return;
            pending.remove(worst);
        }
    }

    private List<PersistentBadge> visibleBadges() {
        List<PersistentBadge> badges = persistent.values().stream()
                .sorted(Comparator.comparingInt(PersistentBadge::priority).thenComparing(PersistentBadge::key))
                .toList();
        if (badges.size() <= 3) return badges;
        List<PersistentBadge> visible = new ArrayList<>(badges.subList(0, 2));
        visible.add(new PersistentBadge("overflow", "+" + (badges.size() - 2), badges.get(2).color(), Integer.MAX_VALUE));
        return List.copyOf(visible);
    }

    record View(FishStatsNotification active, List<PersistentBadge> badges) {
        View {
            badges = badges == null ? List.of() : List.copyOf(badges);
        }
    }

    record PersistentBadge(String key, String label, int color, int priority) {}

    private static final class Entry {
        private final FishStatsNotification notification;
        private final long remainingMs;
        private final long expiresAtMs;
        private final long sequence;

        private Entry(FishStatsNotification notification, long remainingMs, long expiresAtMs, long sequence) {
            this.notification = notification;
            this.remainingMs = remainingMs;
            this.expiresAtMs = expiresAtMs;
            this.sequence = sequence;
        }

        private static Entry active(FishStatsNotification notification, long startMs, long durationMs, long sequence) {
            return new Entry(notification, durationMs, startMs + durationMs, sequence);
        }

        private static Entry pending(FishStatsNotification notification, long durationMs, long sequence) {
            return new Entry(notification, durationMs, Long.MAX_VALUE, sequence);
        }
    }
}
