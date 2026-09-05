package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

final class CatchbookTooltipSourceContractTest {
    @Test
    void callbackIsRegisteredReadOnlyServerGatedAndRenderIoFree() throws Exception {
        String source = Files.readString(
                Path.of("src", "client", "java", "net", "finalpantasy", "fishoncollector", "CatchbookTooltipAppender.java"),
                StandardCharsets.UTF_8);

        assertTrue(source.contains("ItemTooltipCallback.EVENT.register"));
        assertTrue(source.contains("InputConstants.isKeyDown"));
        assertTrue(source.contains("ServerGate.isAllowed"));
        assertTrue(source.contains("YOUR CATCHBOOK"));
        assertTrue(source.contains("ExtrasTooltipFrameAdapter.borderComponent"));
        assertTrue(source.contains("TooltipFrameIntegrator.integrate"));
        assertTrue(source.contains("CatchbookTooltipPlacement.markNextTooltip"));
        assertFalse(source.contains("contains(HEADING)) return"));
        assertFalse(source.contains("lines.add(Component.literal(DIVIDER)"));
        assertFalse(source.contains("java.nio.file"));
        assertFalse(source.contains("Files."));
        assertFalse(source.contains("Socket"));
        assertFalse(source.contains("HttpClient"));
        assertFalse(source.contains("sendCommand"));
        assertFalse(source.contains("sendChat"));
        assertFalse(source.contains("packet"));
        assertFalse(source.contains("keyPress"));
    }
}
