package net.finalpantasy.fishoncollector;

import java.util.ArrayList;
import java.util.List;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.MutableComponent;

final class TooltipFrameIntegrator {
    private static final String CATCHBOOK_HEADING = "YOUR CATCHBOOK";

    private TooltipFrameIntegrator() {}

    static boolean integrate(List<Component> lines, Component border, List<Component> additions) {
        if (lines == null || border == null || additions == null || additions.isEmpty()) return false;
        String borderText = border.getString().trim();
        if (borderText.isEmpty()) return false;

        removeExistingCatchbook(lines);
        int footer = lines.size() - 1;
        if (footer < 0) return false;
        Component separator = findAnglerSectionDivider(lines);
        if (separator == null) separator = findPreviousDecoration(lines, footer);
        List<Component> framed = new ArrayList<>();
        if (separator != null) framed.add(separator.copy());
        for (Component addition : additions) {
            if (addition == null) continue;
            framed.add(frameLine(border, addition));
        }
        if (framed.isEmpty()) return false;
        lines.addAll(footer, framed);
        return true;
    }

    /**
     * FishOn Extras prefixes every content row with its styled border glyph and three spaces.
     * Keeping the same prefix makes added rows participate in the existing green background and
     * side frame instead of falling back to Minecraft's purple tooltip background.
     */
    private static Component frameLine(Component border, Component content) {
        MutableComponent prefix = Component.literal(border.getString().trim())
                .withStyle(border.getStyle())
                .append("   ");
        return prefix.append(content.copy());
    }

    private static void removeExistingCatchbook(List<Component> lines) {
        int heading = -1;
        for (int index = 0; index < lines.size(); index++) {
            Component line = lines.get(index);
            if (line != null && line.getString().contains(CATCHBOOK_HEADING)) {
                heading = index;
                break;
            }
        }
        if (heading < 0) return;

        int footer = lines.size() - 1;
        if (heading >= footer) return;

        int start = heading;
        Component separator = findAnglerSectionDivider(lines);
        if (heading > 0 && separator != null
                && lines.get(heading - 1).getString().equals(separator.getString())) {
            start--;
        } else if (heading > 0 && isDecorationOnly(lines.get(heading - 1))) {
            start--;
        }
        lines.subList(start, footer).clear();
    }

    private static Component findAnglerSectionDivider(List<Component> lines) {
        for (int index = 1; index < lines.size(); index++) {
            Component line = lines.get(index);
            if (line != null && line.getString().toUpperCase(java.util.Locale.ROOT).contains("ANGLER:")) {
                return lines.get(index - 1);
            }
        }
        return null;
    }

    private static Component findPreviousDecoration(List<Component> lines, int footer) {
        for (int index = footer - 1; index >= 0; index--) {
            if (isDecorationOnly(lines.get(index))) return lines.get(index);
        }
        return null;
    }

    private static boolean isDecorationOnly(Component line) {
        if (line == null) return false;
        String text = line.getString();
        if (text == null || text.isBlank()) return true;
        return text.codePoints().noneMatch(Character::isLetterOrDigit);
    }
}
