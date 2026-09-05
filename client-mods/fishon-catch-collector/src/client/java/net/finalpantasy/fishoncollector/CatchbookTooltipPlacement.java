package net.finalpantasy.fishoncollector;

public final class CatchbookTooltipPlacement {
    private static final ThreadLocal<Boolean> NEXT_TOOLTIP = ThreadLocal.withInitial(() -> false);

    private CatchbookTooltipPlacement() {}

    public static void markNextTooltip() {
        NEXT_TOOLTIP.set(true);
    }

    public static boolean consume() {
        boolean marked = NEXT_TOOLTIP.get();
        NEXT_TOOLTIP.set(false);
        return marked;
    }
}
