package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

final class UpdateCheckerSourceContractTest {
    @Test
    void clientUsesAsyncLocalNotificationWithoutServerVisibleActions() throws Exception {
        Path source = Path.of(
                "src", "client", "java", "net", "finalpantasy", "fishoncollector", "CollectorUpdateClient.java");
        String text = Files.readString(source);

        assertTrue(text.contains("displayClientMessage"));
        assertTrue(text.contains("ClickEvent.OpenUrl"));
        assertTrue(text.contains("thenAccept"));
        assertTrue(text.contains("AtomicBoolean"));
        assertFalse(text.contains("sendChatMessage"));
        assertFalse(text.contains("sendCommand"));
        assertFalse(text.contains("ClientPlayNetworking"));
        assertFalse(text.contains("Serverbound"));
        assertFalse(text.contains("download"));
        assertFalse(text.contains("user.name"));
    }

    @Test
    void transportHasBoundedNonIdentifyingContract() throws Exception {
        String text = Files.readString(Path.of(
                "src", "main", "java", "net", "finalpantasy", "fishoncollector", "BoundedHttpUpdateTransport.java"));

        assertTrue(text.contains("MAX_RESPONSE_BYTES"));
        assertTrue(text.contains("requestTimeout"));
        assertTrue(text.contains("User-Agent"));
        assertFalse(text.contains("Minecraft.getInstance"));
        assertFalse(text.contains("catches.jsonl"));
        assertFalse(text.contains("getCurrentServer"));
        assertFalse(text.contains("System.getenv"));
    }
}
