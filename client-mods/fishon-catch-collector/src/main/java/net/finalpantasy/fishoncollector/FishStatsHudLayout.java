package net.finalpantasy.fishoncollector;

final class FishStatsHudLayout {
    static final int VIRTUAL_WIDTH = 260;
    static final int VIRTUAL_HEIGHT = 346;
    static final float SCALE = 0.64F;
    static final int PANEL_WIDTH = Math.round(VIRTUAL_WIDTH * SCALE);
    static final int PANEL_HEIGHT = Math.round(VIRTUAL_HEIGHT * SCALE);
    private static final int LEFT_MARGIN = 2;
    private static final int CHAT_RESERVE = 116;

    private FishStatsHudLayout() {}

    static Bounds resolve(int screenWidth, int screenHeight) {
        int preferredY = Math.round(screenHeight * 0.27F);
        int maximumY = Math.max(8, screenHeight - PANEL_HEIGHT - CHAT_RESERVE);
        return new Bounds(LEFT_MARGIN, Math.min(preferredY, maximumY), PANEL_WIDTH, PANEL_HEIGHT);
    }

    static Columns columns() {
        return new Columns(8, 38, 61, 85, 108, 134, 164, 187, 211, 234);
    }

    record Bounds(int x, int y, int width, int height) {
        int right() { return x + width; }
        int bottom() { return y + height; }
    }

    record Columns(
            int leftLabel,
            int leftAll,
            int leftPercent,
            int leftSession,
            int leftDry,
            int rightLabel,
            int rightAll,
            int rightPercent,
            int rightSession,
            int rightDry) {}
}
