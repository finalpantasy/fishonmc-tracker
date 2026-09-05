package net.finalpantasy.fishoncollector;

import java.lang.reflect.Method;
import java.util.Optional;

public final class FishTooltipReader {
    private FishTooltipReader() {}

    public static Optional<TooltipFish> read(Object itemStack) {
        if (itemStack == null) return Optional.empty();
        try {
            Class<?> validator = Class.forName(
                    "dannypx.foe.item.ValidateItem",
                    false,
                    FishTooltipReader.class.getClassLoader());
            Method isFish = null;
            for (Method method : validator.getMethods()) {
                if (method.getName().equals("isFish")
                        && method.getParameterCount() == 1
                        && method.getParameterTypes()[0].isAssignableFrom(itemStack.getClass())) {
                    isFish = method;
                    break;
                }
            }
            if (isFish == null) return Optional.empty();
            Object pair = isFish.invoke(null, itemStack);
            if (!Boolean.TRUE.equals(optionalInvoke(pair, "value1"))) return Optional.empty();
            return fromFishTag(optionalInvoke(pair, "value2"));
        } catch (ReflectiveOperationException | LinkageError | RuntimeException ignored) {
            return Optional.empty();
        }
    }

    static Optional<TooltipFish> fromFishTag(Object fishTag) {
        if (fishTag == null) return Optional.empty();
        try {
            String displayName = componentText(invoke(fishTag, "getName"));
            if (displayName == null || displayName.isBlank()) return Optional.empty();
            Object rawId = optionalInvoke(fishTag, "getID");
            String eventId = rawId == null ? null : CollectorEventId.fromRaw(rawId.toString());
            return Optional.of(new TooltipFish(
                    CatchNormalizer.normalizedFishId(displayName),
                    eventId,
                    numberValue(optionalInvoke(fishTag, "getWeight")),
                    stringValue(optionalInvoke(fishTag, "getVariant")),
                    stringValue(optionalInvoke(fishTag, "getFishSize"))));
        } catch (ReflectiveOperationException | RuntimeException ignored) {
            return Optional.empty();
        }
    }

    private static Object invoke(Object target, String methodName) throws ReflectiveOperationException {
        if (target == null) return null;
        Method method = target.getClass().getMethod(methodName);
        method.setAccessible(true);
        return method.invoke(target);
    }

    private static Object optionalInvoke(Object target, String methodName) {
        try {
            return invoke(target, methodName);
        } catch (ReflectiveOperationException | RuntimeException ignored) {
            return null;
        }
    }

    private static String componentText(Object component) {
        return stringValue(optionalInvoke(component, "getString"));
    }

    private static String stringValue(Object value) {
        return value == null ? null : value.toString();
    }

    private static Double numberValue(Object value) {
        if (value instanceof Float number) return Double.valueOf(Float.toString(number));
        if (value instanceof Number number) return number.doubleValue();
        return null;
    }
}
