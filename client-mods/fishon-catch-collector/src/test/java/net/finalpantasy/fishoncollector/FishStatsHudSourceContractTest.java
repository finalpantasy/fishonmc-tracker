package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

final class FishStatsHudSourceContractTest {
    @Test
    void registersARealHudRendererInsteadOfAnotherFoerTextWidget() throws Exception {
        Path source = Path.of("src/client/java/net/finalpantasy/fishoncollector/FishStatsHudRenderer.java");

        assertTrue(Files.isRegularFile(source), "dedicated Fish Stats HUD renderer must exist");
        String text = Files.readString(source);
        assertTrue(text.contains("HudElementRegistry.attachElementAfter"));
        assertTrue(text.contains("drawPanel"));
        assertTrue(text.contains("drawDistributionGrid"));
        assertTrue(text.contains("drawCategoryBadge"), "rarity and size initials must render as compact badges");
        assertTrue(text.contains("drawRewardsTable"), "rewards must use one consistent ALL / SES / DRY table");
        assertTrue(text.contains("drawStatusBadges"), "persistent practical warnings must stay compact near the title");
        assertTrue(text.contains("drawLastOrAlert"), "temporary alerts must reuse the existing LAST region");
        assertTrue(text.contains("FishStatsSignalPoller"), "live read-only signals must feed the HUD");
        assertTrue(text.contains("rewardRow(graphics, font, \"PET\""));
        assertTrue(text.contains("allTime.itemDry(\"armorShard\")"));
        assertTrue(text.contains("allTime.itemDry(\"package\")"));
        assertTrue(text.contains("allTime.itemDry(\"chummer\")"));
        assertTrue(!text.contains("\"PET DRY\""), "pet dry must not be a one-off standalone metric");
        assertTrue(text.contains("emptyMetric"), "empty session values must be quiet dashes instead of noisy zeroes");
        assertTrue(text.contains("pose().scale"), "default font must be scaled with the compact widget");
        Path layout = Path.of("src/main/java/net/finalpantasy/fishoncollector/FishStatsHudLayout.java");
        assertTrue(Files.isRegularFile(layout));
        assertTrue(Files.readString(layout).contains("0.27F"), "HUD must sit below the player and pet panels");
        assertTrue(Files.isRegularFile(Path.of("src/main/java/net/finalpantasy/fishoncollector/FishStatsSession.java")));
        assertTrue(Files.isRegularFile(Path.of("src/main/java/net/finalpantasy/fishoncollector/ExtrasStatsSnapshot.java")));
        String client = Files.readString(Path.of(
                "src/client/java/net/finalpantasy/fishoncollector/FishOnCatchCollectorClient.java"));
        assertTrue(client.contains("FishStatsHudRenderer.initialize"));
        assertTrue(client.contains("FishStatsHudRenderer.record"));
    }
}
