package net.finalpantasy.fishoncollector;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.Minecraft;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class FishOnCatchCollectorClient implements ClientModInitializer {
    private static final Logger LOGGER = LoggerFactory.getLogger("FishOn Catch Collector");
    private static final String SESSION_ID = "session-" + UUID.randomUUID();
    private static final AtomicLong RECORDED = new AtomicLong();
    private static volatile CatchLedgerWriter writer;
    private static volatile CatchbookRuntime catchbookRuntime;
    private static volatile CatchbookTooltipConfig tooltipConfig = CatchbookTooltipConfig.defaults();
    private static volatile String extrasVersion;
    private static volatile String collectorVersion = "unknown";
    private static volatile String minecraftVersion = "unknown";

    @Override
    public void onInitializeClient() {
        Path configDirectory = FabricLoader.getInstance().getConfigDir();
        Path ledger = configDirectory
                .resolve("fishon-catch-collector")
                .resolve("catches.jsonl");
        tooltipConfig = CatchbookTooltipConfig.load(configDirectory
                .resolve("fishon-catchbook-tooltips.properties"));
        collectorVersion = FabricLoader.getInstance().getModContainer("fishon-catch-collector")
                .map(container -> container.getMetadata().getVersion().getFriendlyString())
                .orElse("unknown");
        minecraftVersion = FabricLoader.getInstance().getModContainer("minecraft")
                .map(container -> container.getMetadata().getVersion().getFriendlyString())
                .orElse("unknown");
        extrasVersion = FabricLoader.getInstance().getModContainer("fishonmcextras")
                .map(container -> container.getMetadata().getVersion().getFriendlyString())
                .orElse(null);
        try {
            writer = new CatchLedgerWriter(ledger);
            try (InputStream published = FishOnCatchCollectorClient.class
                    .getResourceAsStream("/fishon-published-maxima.json")) {
                catchbookRuntime = CatchbookRuntime.load(ledger, published);
            }
            LOGGER.info(
                    "Ready: local catch ledger and catchbook tooltips enabled; gameplay controls are not present");
        } catch (IOException error) {
            writer = null;
            LOGGER.error("Catch ledger is unavailable: {}", error.getClass().getSimpleName());
        } catch (RuntimeException error) {
            catchbookRuntime = null;
            LOGGER.error("Catchbook tooltips are unavailable: {}", error.getClass().getSimpleName());
        }
        double personalBest = catchbookRuntime == null
                ? 0
                : catchbookRuntime.snapshot().catchbook().personalBestWeightLb();
        FishStatsHudRenderer.initialize(personalBest);
        CatchbookTooltipAppender.register();
        try {
            CollectorUpdateClient.initialize(configDirectory, collectorVersion, minecraftVersion);
        } catch (RuntimeException error) {
            LOGGER.debug("Update checking is unavailable: {}", error.getClass().getSimpleName());
        }
    }

    public static void recordCurrentCatch() {
        CatchLedgerWriter activeWriter = writer;
        Minecraft minecraft = Minecraft.getInstance();
        if (activeWriter == null || minecraft.getCurrentServer() == null) return;
        if (!ServerGate.isAllowed(minecraft.getCurrentServer().ip)) return;

        ExtrasReflectionReader.readCurrentCatch(extrasVersion).ifPresent(raw -> {
            try {
                CatchObservation event = CatchNormalizer.normalize(raw, Instant.now(), SESSION_ID, collectorVersion, minecraftVersion);
                if (activeWriter.append(event)) {
                    CatchbookRuntime activeRuntime = catchbookRuntime;
                    CatchbookIndex before = activeRuntime == null
                            ? CatchbookIndex.empty()
                            : activeRuntime.snapshot().catchbook();
                    FishStatsCatchClassifier.Result classification =
                            FishStatsCatchClassifier.classify(before, event);
                    if (activeRuntime != null) activeRuntime.record(event);
                    FishStatsHudRenderer.record(event, classification);
                    long count = RECORDED.incrementAndGet();
                    LOGGER.info("Catch recorded locally (session count {})", count);
                }
            } catch (IOException | RuntimeException error) {
                LOGGER.warn("Catch could not be recorded: {}", error.getClass().getSimpleName());
            }
        });
    }

    public static long recordedCount() {
        return RECORDED.get();
    }

    static CatchbookRuntime catchbookRuntime() {
        return catchbookRuntime;
    }

    static CatchbookTooltipConfig tooltipConfig() {
        return tooltipConfig;
    }

    public FishOnCatchCollectorClient() {}
}
