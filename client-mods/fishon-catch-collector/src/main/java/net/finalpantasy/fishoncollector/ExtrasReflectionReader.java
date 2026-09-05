package net.finalpantasy.fishoncollector;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public final class ExtrasReflectionReader {
    private ExtrasReflectionReader() {}

    public static Optional<CatchNormalizer.RawCatch> readCurrentCatch(String extrasVersion) {
        try {
            Object catching = singleton("dannypx.foe.handler.logic.CatchingHandler");
            Object inventory = singleton("dannypx.foe.handler.logic.InventoryHandler");
            Object boss = singleton("dannypx.foe.handler.fetch.BossEventHandler");
            return read(catching, inventory, boss, extrasVersion);
        } catch (ReflectiveOperationException | LinkageError ignored) {
            return Optional.empty();
        }
    }

    static Optional<ExtrasLiveSnapshot> readLiveState() {
        try {
            Object inventory = singleton("dannypx.foe.handler.logic.InventoryHandler");
            Object boss = singleton("dannypx.foe.handler.fetch.BossEventHandler");
            Object timers = singleton("dannypx.foe.handler.store.CustomTimerDataHandler");
            return readLive(inventory, boss, timers, System.currentTimeMillis() / 1000L);
        } catch (ReflectiveOperationException | LinkageError ignored) {
            return Optional.empty();
        }
    }

    static Optional<ExtrasLiveSnapshot> readLive(
            Object inventoryHandler,
            Object bossHandler,
            Object timerDataHandler,
            long epochSeconds) {
        try {
            Object rod = optionalInvoke(inventoryHandler, "getCurrentFishingRod");
            ExtrasLiveSnapshot.Bait bait = readBait(rod);
            String location = componentText(optionalInvoke(bossHandler, "getLocation"));
            String weather = componentText(optionalInvoke(bossHandler, "getWeather"));
            ExtrasLiveSnapshot.Contest contest = readContest(timerDataHandler, epochSeconds);
            if (bait == null && location == null && weather == null && contest == null) return Optional.empty();
            return Optional.of(new ExtrasLiveSnapshot(location, weather, bait, contest));
        } catch (RuntimeException ignored) {
            return Optional.empty();
        }
    }

    static Optional<CatchNormalizer.RawCatch> read(
            Object catchingHandler,
            Object inventoryHandler,
            Object bossHandler,
            String extrasVersion) {
        try {
            Object fish = field(catchingHandler, "lastCaughtFish");
            if (fish == null) return Optional.empty();
            String displayName = componentText(invoke(fish, "getName"));
            if (displayName == null || displayName.isBlank()) return Optional.empty();

            Object rod = optionalInvoke(inventoryHandler, "getCurrentFishingRod");
            Object pet = optionalInvoke(inventoryHandler, "getCurrentPet");
            Object rawId = optionalInvoke(fish, "getID");
            BaitCapture bait = baitCapture(rod);
            return Optional.of(new CatchNormalizer.RawCatch(
                    rawId == null ? null : rawId.toString(),
                    displayName,
                    stringValue(optionalInvoke(fish, "getRarity")),
                    stringValue(optionalInvoke(fish, "getVariant")),
                    stringValue(optionalInvoke(fish, "getFishSize")),
                    numberValue(optionalInvoke(fish, "getWeight")),
                    numberValue(optionalInvoke(fish, "getLength")),
                    componentText(optionalInvoke(bossHandler, "getLocation")),
                    componentText(optionalInvoke(bossHandler, "getSubLocation")),
                    componentText(optionalInvoke(bossHandler, "getWeather")),
                    componentText(optionalInvoke(bossHandler, "getTime")),
                    componentText(optionalInvoke(bossHandler, "getTemperature")),
                    firstTagName(optionalInvoke(rod, "getPoleItem")),
                    firstTagName(optionalInvoke(rod, "getReelItem")),
                    firstTagName(optionalInvoke(rod, "getLineItem")),
                    bait.name(),
                    List.of(),
                    tagName(pet),
                    extrasVersion,
                    bait.state(),
                    "unavailable"));
        } catch (ReflectiveOperationException | RuntimeException ignored) {
            return Optional.empty();
        }
    }

    private static Object singleton(String className) throws ReflectiveOperationException {
        Class<?> type = Class.forName(className, false, ExtrasReflectionReader.class.getClassLoader());
        return invoke(type, null, "instance");
    }

    private static Object field(Object target, String name) throws ReflectiveOperationException {
        if (target == null) return null;
        Class<?> type = target.getClass();
        while (type != null) {
            try {
                Field field = type.getDeclaredField(name);
                field.setAccessible(true);
                return field.get(target);
            } catch (NoSuchFieldException ignored) {
                type = type.getSuperclass();
            }
        }
        throw new NoSuchFieldException(name);
    }

    private static Object invoke(Object target, String name) throws ReflectiveOperationException {
        if (target == null) return null;
        return invoke(target.getClass(), target, name);
    }

    private static Object invoke(Class<?> type, Object target, String name) throws ReflectiveOperationException {
        Method method = type.getMethod(name);
        method.setAccessible(true);
        return method.invoke(target);
    }

    private static Object optionalInvoke(Object target, String name) {
        try {
            return invoke(target, name);
        } catch (ReflectiveOperationException | RuntimeException ignored) {
            return null;
        }
    }

    private static String componentText(Object component) {
        Object value = optionalInvoke(component, "getString");
        return stringValue(value);
    }

    private static String firstTagName(Object value) {
        if (!(value instanceof Iterable<?> iterable)) return null;
        for (Object item : iterable) {
            String name = tagName(item);
            if (name != null && !name.isBlank()) return name;
        }
        return null;
    }

    private static ExtrasLiveSnapshot.Bait readBait(Object rod) {
        BaitCapture capture = baitCapture(rod);
        if (capture.name() == null) return null;
        Object active = optionalInvoke(rod, "getActiveBait");
        if (!(active instanceof Iterable<?> iterable)) return null;
        for (Object tag : iterable) {
            String name = tagName(tag);
            if (name == null || name.isBlank()) continue;
            int count = intValue(optionalInvoke(tag, "getCount"));
            boolean disabled = booleanValue(optionalInvoke(rod, "getDisableBait"));
            return new ExtrasLiveSnapshot.Bait(name, count, disabled);
        }
        return null;
    }

    private static BaitCapture baitCapture(Object rod) {
        if (rod == null) return new BaitCapture(null, "unavailable");
        Object active = optionalInvoke(rod, "getActiveBait");
        if (!(active instanceof Iterable<?> iterable)) return new BaitCapture(null, "unavailable");
        boolean disabled = booleanValue(optionalInvoke(rod, "getDisableBait"));
        for (Object tag : iterable) {
            String name = tagName(tag);
            if (name != null && !name.isBlank()) {
                return new BaitCapture(name, disabled ? "disabled" : "observed");
            }
        }
        return new BaitCapture(null, disabled ? "disabled" : "none");
    }

    private static ExtrasLiveSnapshot.Contest readContest(Object timerDataHandler, long epochSeconds) {
        Object model = optionalInvoke(timerDataHandler, "getCustomTimerData");
        Object timersObject;
        try {
            timersObject = field(model, "timerList");
        } catch (ReflectiveOperationException ignored) {
            return null;
        }
        if (!(timersObject instanceof Map<?, ?> timers)) return null;
        Object timer = timers.get("Contest Timer");
        if (timer == null || !booleanValue(optionalInvoke(timer, "isUseTimer")) || !booleanValue(optionalInvoke(timer, "isPeriod"))) return null;
        long onSeconds = intValue(optionalInvoke(timer, "getTimer"));
        long offSeconds = intValue(optionalInvoke(timer, "getOffTimer"));
        long offsetSeconds = signedIntValue(optionalInvoke(timer, "getOffset"));
        long cycle = onSeconds + offSeconds;
        if (onSeconds <= 0 || offSeconds <= 0 || cycle <= 0) return null;
        long position = Math.floorMod(epochSeconds + offsetSeconds, cycle);
        boolean active = position < onSeconds;
        return active
                ? new ExtrasLiveSnapshot.Contest(true, 0, onSeconds - position)
                : new ExtrasLiveSnapshot.Contest(false, cycle - position, 0);
    }

    private static String tagName(Object tag) {
        return componentText(optionalInvoke(tag, "getName"));
    }

    private static String stringValue(Object value) {
        return value == null ? null : value.toString();
    }

    private static Double numberValue(Object value) {
        if (value instanceof Float number) return Double.valueOf(Float.toString(number));
        if (value instanceof Number number) return number.doubleValue();
        return null;
    }

    private static int intValue(Object value) {
        return value instanceof Number number ? Math.max(0, number.intValue()) : 0;
    }

    private static int signedIntValue(Object value) {
        return value instanceof Number number ? number.intValue() : 0;
    }

    private static boolean booleanValue(Object value) {
        return value instanceof Boolean flag && flag;
    }

    private record BaitCapture(String name, String state) {}
}
