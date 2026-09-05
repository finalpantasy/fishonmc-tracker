package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.network.chat.Component;
import org.junit.jupiter.api.Test;

final class TooltipFrameIntegrationTest {
    @Test
    void additionsInheritTheExtrasBorderGlyphAndStayInsideTheClosingFrame() {
        List<Component> lines = new ArrayList<>(List.of(
                Component.literal("Fish name"),
                Component.literal("\uE000Weight: 1.00lb"),
                Component.literal("\uE000────────"),
                Component.literal("\uE000Rod: Standard"),
                Component.literal("\uE001────────\uE002")));
        Component border = Component.literal("\uE000");
        List<Component> additions = List.of(
                Component.literal("YOUR CATCHBOOK"),
                Component.literal("1 CAUGHT"));

        boolean integrated = invoke(lines, border, additions);

        assertTrue(integrated);
        assertEquals(List.of(
                "Fish name",
                "\uE000Weight: 1.00lb",
                "\uE000────────",
                "\uE000Rod: Standard",
                "\uE000────────",
                "\uE000   YOUR CATCHBOOK",
                "\uE000   1 CAUGHT",
                "\uE001────────\uE002"), lines.stream().map(Component::getString).toList());
    }

    @Test
    void reintegrationReplacesTheCachedCatchbookBlockInsteadOfKeepingTheCompactVersion() {
        List<Component> lines = new ArrayList<>(List.of(
                Component.literal("Fish name"),
                Component.literal("\uE000────────"),
                Component.literal("\uE000Rod: Standard"),
                Component.literal("\uE001────────\uE002")));
        Component border = Component.literal("\uE000");

        assertTrue(invoke(lines, border, List.of(
                Component.literal("YOUR CATCHBOOK"),
                Component.literal("HOLD SHIFT FOR DETAILS"))));
        assertTrue(invoke(lines, border, List.of(
                Component.literal("YOUR CATCHBOOK"),
                Component.literal("PERSONAL: 1 / 1 / 1"),
                Component.literal("VARIANTS: NORMAL ✓"))));

        assertEquals(1, lines.stream().filter(line -> line.getString().contains("YOUR CATCHBOOK")).count());
        assertEquals(0, lines.stream().filter(line -> line.getString().contains("HOLD SHIFT")).count());
        assertEquals(1, lines.stream().filter(line -> line.getString().contains("PERSONAL:")).count());
        assertEquals(1, lines.stream().filter(line -> line.getString().contains("VARIANTS:")).count());
    }

    @Test
    void realFishOnFrameUsesTheFinalLoreLineAndAnglerSectionDivider() {
        List<Component> lines = new ArrayList<>(List.of(
                Component.literal("Fish name"),
                Component.literal("\uE000Weight: 1.00lb"),
                Component.literal("\uE000frame-separator"),
                Component.literal("\uE000FISH GROUP: PANFISHES"),
                Component.literal("\uE000section-separator"),
                Component.literal("\uE000Angler: Test_Angler"),
                Component.literal("\uE000Date: 08/30/2026"),
                Component.literal("\uE000Rod: Standard"),
                Component.literal("\uE001frame-footer\uE002")));

        boolean integrated = invoke(
                lines,
                Component.literal("\uE000"),
                List.of(Component.literal("YOUR CATCHBOOK")));

        assertTrue(integrated);
        assertEquals(List.of(
                "Fish name",
                "\uE000Weight: 1.00lb",
                "\uE000frame-separator",
                "\uE000FISH GROUP: PANFISHES",
                "\uE000section-separator",
                "\uE000Angler: Test_Angler",
                "\uE000Date: 08/30/2026",
                "\uE000Rod: Standard",
                "\uE000section-separator",
                "\uE000   YOUR CATCHBOOK",
                "\uE001frame-footer\uE002"), lines.stream().map(Component::getString).toList());
    }

    @Test
    void everyCatchbookRowReceivesExactlyOneExtrasBorderPrefix() {
        List<Component> lines = new ArrayList<>(List.of(
                Component.literal("Fish name"),
                Component.literal("\uE000section-separator"),
                Component.literal("\uE000Angler: Test_Angler"),
                Component.literal("\uE001frame-footer\uE002")));

        assertTrue(invoke(lines, Component.literal("\uE000"), List.of(
                Component.literal("YOUR CATCHBOOK"),
                Component.literal("PB: 1.00LB"),
                Component.literal("VARIANTS: 1/6"))));

        List<String> catchbookRows = lines.stream()
                .map(Component::getString)
                .filter(line -> line.contains("YOUR CATCHBOOK") || line.contains("PB:") || line.contains("VARIANTS:"))
                .toList();
        assertEquals(List.of(
                "\uE000   YOUR CATCHBOOK",
                "\uE000   PB: 1.00LB",
                "\uE000   VARIANTS: 1/6"), catchbookRows);
    }

    private static boolean invoke(List<Component> lines, Component border, List<Component> additions) {
        try {
            Class<?> type = Class.forName("net.finalpantasy.fishoncollector.TooltipFrameIntegrator");
            Method method = type.getDeclaredMethod("integrate", List.class, Component.class, List.class);
            method.setAccessible(true);
            return (boolean) method.invoke(null, lines, border, additions);
        } catch (ReflectiveOperationException error) {
            throw new AssertionError("TooltipFrameIntegrator is unavailable", error);
        }
    }
}
