package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

final class ModMetadataTest {
    @Test
    void metadataIsClientOnlyAndRequiresTheExactSupportedGameStack() throws Exception {
        String metadata = resource("/fabric.mod.json");

        assertTrue(metadata.contains("\"id\": \"fishon-catch-collector\""));
        assertTrue(metadata.contains("\"environment\": \"client\""));
        assertTrue(metadata.contains("\"minecraft\": \"~1.21.11\""));
        assertTrue(metadata.contains("\"fabricloader\": \">=0.19.3\""));
        assertTrue(metadata.contains("\"fabric-api\": \">=0.141.6+1.21.11\""));
        assertTrue(metadata.contains("\"fishonmcextras\": \"0.3.7+1.21.11\""));
        assertTrue(metadata.contains("https://github.com/finalpantasy/fishon-catch-collector"));
        assertTrue(metadata.contains("fishon-catch-collector.client.mixins.json"));
        assertFalse(metadata.toLowerCase().contains("server"));
    }

    @Test
    void requiredMixinTargetsOnlyTheExtrasCatchEvent() throws Exception {
        String mixin = resource("/fishon-catch-collector.client.mixins.json");

        assertTrue(mixin.contains("\"required\": true"));
        assertTrue(mixin.contains("net.finalpantasy.fishoncollector.mixin"));
        assertTrue(mixin.contains("ExtrasOnCatchMixin"));
        assertFalse(mixin.contains("ResourcePackPriorityMixin"));
        assertFalse(mixin.contains("packet"));
        assertFalse(mixin.contains("input"));
        assertFalse(mixin.contains("camera"));
    }

    private static String resource(String name) throws IOException {
        try (InputStream input = ModMetadataTest.class.getResourceAsStream(name)) {
            if (input == null) throw new AssertionError(name + " has not been created yet");
            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
