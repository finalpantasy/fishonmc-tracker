package net.finalpantasy.fishoncollector;

import java.net.URI;
import java.nio.file.Path;
import java.time.Clock;
import java.util.concurrent.atomic.AtomicBoolean;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.minecraft.ChatFormatting;
import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.ClickEvent;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.MutableComponent;

final class CollectorUpdateClient {
    private static final URI METADATA_URI = URI.create(
            "https://raw.githubusercontent.com/finalpantasy/fishon-catch-collector/main/update.json");
    private static final AtomicBoolean INITIALIZED = new AtomicBoolean();
    private static final AtomicBoolean NOTIFIED = new AtomicBoolean();
    private static volatile CompatibleRelease pendingRelease;
    private static volatile String installedVersion = "unknown";

    private CollectorUpdateClient() {}

    static void initialize(Path configDirectory, String collectorVersion, String minecraftVersion) {
        if (configDirectory == null || !INITIALIZED.compareAndSet(false, true)) return;
        installedVersion = collectorVersion == null ? "unknown" : collectorVersion;
        Path updateDirectory = configDirectory.resolve("fishon-catch-collector");
        UpdateCheckConfig config = UpdateCheckConfig.load(updateDirectory.resolve("update-check.properties"));
        if (!config.enabled()) return;

        ClientTickEvents.END_CLIENT_TICK.register(CollectorUpdateClient::notifyWhenReady);

        UpdateCheckService service = new UpdateCheckService(
                config,
                new UpdateCheckCache(updateDirectory.resolve("update-cache.properties")),
                new BoundedHttpUpdateTransport(installedVersion),
                METADATA_URI,
                Clock.systemUTC());
        service.check(installedVersion, minecraftVersion).thenAccept(result -> {
            if (result.status() != UpdateCheckResult.Status.UPDATE_AVAILABLE) return;
            result.release().ifPresent(release -> {
                pendingRelease = release;
                Minecraft client = Minecraft.getInstance();
                client.execute(() -> notifyWhenReady(client));
            });
        });
    }

    private static void notifyWhenReady(Minecraft client) {
        CompatibleRelease release = pendingRelease;
        if (client == null || client.player == null || release == null || NOTIFIED.get()) return;
        if (!NOTIFIED.compareAndSet(false, true)) return;

        MutableComponent message = Component.literal("[FishOn Collector] ")
                .withStyle(ChatFormatting.GOLD)
                .append(Component.literal("Update available: " + installedVersion + " -> " + release.version() + ". ")
                        .withStyle(ChatFormatting.WHITE))
                .append(Component.literal("[Open GitHub Release]").withStyle(style -> style
                        .withColor(ChatFormatting.AQUA)
                        .withUnderlined(true)
                        .withClickEvent(new ClickEvent.OpenUrl(release.releaseUrl()))));
        client.player.displayClientMessage(message, false);
        pendingRelease = null;
    }
}
