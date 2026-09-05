package net.finalpantasy.fishoncollector;

import java.lang.reflect.Method;
import java.util.Optional;
import net.minecraft.network.chat.Component;
import net.minecraft.world.item.ItemStack;

final class ExtrasTooltipFrameAdapter {
    private ExtrasTooltipFrameAdapter() {}

    static Optional<Component> borderComponent(ItemStack stack) {
        if (stack == null) return Optional.empty();
        try {
            Class<?> tagObject = Class.forName(
                    "dannypx.foe.item.TagObject",
                    false,
                    ExtrasTooltipFrameAdapter.class.getClassLoader());
            Method getBorder = tagObject.getMethod("getBorderComponent", ItemStack.class);
            Object result = getBorder.invoke(null, stack);
            if (result instanceof Component component && !component.getString().trim().isEmpty()) {
                return Optional.of(component);
            }
        } catch (ReflectiveOperationException | LinkageError | RuntimeException ignored) {
            // Extras drift should leave the stock tooltip untouched.
        }
        return Optional.empty();
    }
}
