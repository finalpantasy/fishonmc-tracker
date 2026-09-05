package net.finalpantasy.fishoncollector;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

public final class CatchbookTooltipModel {
    private static final List<String> COMPLETIONS = List.of(
            "normal", "albino", "melanistic", "trophy", "gigantic", "fabled");

    private CatchbookTooltipModel() {}

    public static List<TooltipLine> render(
            TooltipFish fish,
            PublishedFishIndex published,
            CatchbookIndex catchbook,
            boolean expanded,
            CatchbookTooltipConfig config) {
        if (fish == null || published == null || catchbook == null || config == null || !config.catchbookTooltips()) {
            return List.of();
        }
        Optional<CatchbookIndex.SpeciesSummary> summary = catchbook.species(fish.normalizedId());
        Optional<PublishedFishIndex.PublishedFish> publishedFish = published.find(fish.normalizedId());
        List<TooltipLine> lines = new ArrayList<>();
        lines.add(line(Tone.HEADING, "YOUR CATCHBOOK"));
        if (expanded) renderExpanded(lines, fish, summary, publishedFish, catchbook, config);
        else renderCompact(lines, fish, summary, publishedFish, config);
        return List.copyOf(lines);
    }

    private static void renderCompact(
            List<TooltipLine> lines,
            TooltipFish fish,
            Optional<CatchbookIndex.SpeciesSummary> summary,
            Optional<PublishedFishIndex.PublishedFish> published,
            CatchbookTooltipConfig config) {
        List<String> primary = new ArrayList<>();
        summary.ifPresent(value -> {
            Integer rank = value.rank(fish.weightLb());
            if (rank != null) primary.add("#" + rank + " OF " + value.observedCount());
        });
        percentage(fish, published, config).ifPresent(value -> primary.add(value + " OF PUBLISHED MAX"));
        if (!primary.isEmpty()) lines.add(line(Tone.VALUE, String.join(" • ", primary)));

        summary.ifPresent(value -> {
            List<String> secondary = new ArrayList<>();
            if (value.maximumLb() != null) secondary.add("PB: " + pounds(value.maximumLb()));
            secondary.add("VARIANTS: " + completionCount(value.variants()) + "/" + COMPLETIONS.size());
            lines.add(line(Tone.VALUE, String.join(" • ", secondary)));
        });
        if (summary.isEmpty()) lines.add(line(Tone.VALUE, "NO LOGGED CATCHES • VARIANTS: 0/" + COMPLETIONS.size()));
        lines.add(line(Tone.MUTED, "HOLD SHIFT FOR RECORDS & SETUP"));
    }

    private static void renderExpanded(
            List<TooltipLine> lines,
            TooltipFish fish,
            Optional<CatchbookIndex.SpeciesSummary> summary,
            Optional<PublishedFishIndex.PublishedFish> published,
            CatchbookIndex catchbook,
            CatchbookTooltipConfig config) {
        summary.ifPresent(value -> {
            Integer rank = value.rank(fish.weightLb());
            String rankText = rank == null ? "" : " • WEIGHT RANK: #" + rank;
            lines.add(line(Tone.VALUE, "CAUGHT: " + value.observedCount() + rankText));
            if (value.minimumLb() != null && value.meanLb() != null && fish.weightLb() != null && value.maximumLb() != null) {
                lines.add(line(Tone.VALUE, "PERSONAL: " + number(value.minimumLb()) + " / " + number(value.meanLb())
                        + " / " + number(fish.weightLb()) + " / " + pounds(value.maximumLb())));
                lines.add(line(Tone.MUTED, "MIN / AVG / THIS / MAX"));
            }
        });
        if (summary.isEmpty()) {
            String current = fish.weightLb() == null ? "UNKNOWN" : pounds(fish.weightLb());
            lines.add(line(Tone.VALUE, "CAUGHT: 0 • THIS: " + current));
            lines.add(line(Tone.MUTED, "NO LOGGED PERSONAL RECORDS"));
        }
        if (config.showPublishedMaximum()) {
            published.flatMap(value -> Optional.ofNullable(value.maximumWeightLb())).ifPresent(maximum -> {
                List<String> values = new ArrayList<>();
                values.add("PUBLISHED MAX: " + pounds(maximum));
                percentage(fish, published, config).ifPresent(value -> values.add("THIS: " + value));
                lines.add(line(Tone.VALUE, String.join(" • ", values)));
            });
        }
        Set<String> variants = summary.map(CatchbookIndex.SpeciesSummary::variants).orElse(Set.of());
        lines.add(variantLine("VARIANTS: ", variants, 0, 2));
        lines.add(variantLine("", variants, 2, 4));
        lines.add(variantLine("", variants, 4, 6));

        Optional<CatchObservation> exactEvent = fish.eventId() == null
                ? Optional.empty()
                : catchbook.event(fish.eventId());
        if (config.showCapturedSetup()) {
            if (exactEvent.isPresent()) renderSetup(lines, exactEvent.orElseThrow().setup());
            else lines.add(line(Tone.MUTED, "SETUP: NOT CAPTURED FOR THIS ITEM"));
        }
        if (isFirstCompletion(fish, summary)) lines.add(line(Tone.COMPLETE, "NEW COLLECTION PROGRESS"));
    }

    private static void renderSetup(List<TooltipLine> lines, CatchObservation.Setup setup) {
        if (setup == null) return;
        String bait = cleanUpper(setup.bait());
        String pet = cleanUpper(setup.pet());
        String reel = cleanUpper(setup.reel());
        String line = cleanUpper(setup.line());
        if (bait == null && pet == null && reel == null && line == null) return;
        lines.add(line(Tone.HEADING, "CAUGHT WITH"));
        if (bait != null) lines.add(line(Tone.VALUE, "BAIT: " + bait));
        if (pet != null) lines.add(line(Tone.VALUE, "PET: " + pet));
        if (reel != null) lines.add(line(Tone.VALUE, "REEL: " + reel));
        if (line != null) lines.add(line(Tone.VALUE, "LINE: " + line));
    }

    private static TooltipLine variantLine(String prefix, Set<String> variants, int from, int to) {
        List<TooltipSpan> spans = new ArrayList<>();
        if (!prefix.isEmpty()) spans.add(new TooltipSpan(prefix, Tone.HEADING));
        for (int index = from; index < to; index++) {
            if (index > from) spans.add(new TooltipSpan(" • ", Tone.MUTED));
            String variant = COMPLETIONS.get(index);
            boolean complete = variants.contains(variant);
            spans.add(new TooltipSpan(
                    variant.toUpperCase(Locale.ROOT) + (complete ? " ✓" : " □"),
                    complete ? Tone.COMPLETE : Tone.INCOMPLETE));
        }
        return new TooltipLine(spans);
    }

    private static boolean isFirstCompletion(
            TooltipFish fish,
            Optional<CatchbookIndex.SpeciesSummary> summary) {
        if (fish.eventId() == null || summary.isEmpty()) return false;
        List<String> keys = new ArrayList<>();
        keys.add(fish.variant());
        if ("gigantic".equals(fish.size())) keys.add("gigantic");
        for (String key : keys) {
            if (summary.orElseThrow().firstEventId(key).filter(fish.eventId()::equals).isPresent()) return true;
        }
        return false;
    }

    private static Optional<String> percentage(
            TooltipFish fish,
            Optional<PublishedFishIndex.PublishedFish> published,
            CatchbookTooltipConfig config) {
        if (!config.showPublishedMaximum() || fish.weightLb() == null || published.isEmpty()) return Optional.empty();
        Double maximum = published.orElseThrow().maximumWeightLb();
        if (maximum == null || !Double.isFinite(maximum) || maximum <= 0) return Optional.empty();
        double percent = fish.weightLb() / maximum * 100.0;
        return Optional.of(percent >= 100
                ? String.format(Locale.US, "%.0f%%", percent)
                : String.format(Locale.US, "%.1f%%", percent));
    }

    private static int completionCount(Set<String> variants) {
        int count = 0;
        for (String completion : COMPLETIONS) if (variants.contains(completion)) count++;
        return count;
    }

    private static String pounds(double value) {
        return number(value) + "LB";
    }

    private static String number(double value) {
        return String.format(Locale.US, "%.2f", value);
    }

    private static String cleanUpper(String value) {
        if (value == null) return null;
        String cleaned = value.trim().replaceAll("\\s+", " ");
        return cleaned.isEmpty() ? null : cleaned.toUpperCase(Locale.ROOT);
    }

    private static TooltipLine line(Tone tone, String text) {
        return new TooltipLine(List.of(new TooltipSpan(text, tone)));
    }

    public enum Tone { HEADING, LABEL, VALUE, COMPLETE, INCOMPLETE, MUTED }

    public record TooltipSpan(String text, Tone tone) {
        public TooltipSpan {
            text = text == null ? "" : text;
            tone = tone == null ? Tone.LABEL : tone;
        }
    }

    public record TooltipLine(List<TooltipSpan> spans) {
        public TooltipLine {
            spans = List.copyOf(spans == null ? List.of() : spans);
        }

        public String plainText() {
            StringBuilder output = new StringBuilder();
            for (TooltipSpan span : spans) output.append(span.text());
            return output.toString();
        }
    }
}
