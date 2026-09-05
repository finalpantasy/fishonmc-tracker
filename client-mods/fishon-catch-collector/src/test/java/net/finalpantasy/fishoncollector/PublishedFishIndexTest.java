package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

final class PublishedFishIndexTest {
    @Test
    void loadsTheGeneratedCurrentSnapshot() throws Exception {
        try (InputStream input = getClass().getResourceAsStream("/fishon-published-maxima.json")) {
            PublishedFishIndex index = PublishedFishIndex.load(input);
            PublishedFishIndex.PublishedFish fish = index.find("eyespot-bowfin").orElseThrow();

            assertEquals("2026-08-29", index.snapshot());
            assertEquals(338, index.size());
            assertEquals("Eyespot Bowfin", fish.displayName());
            assertEquals(21.5, fish.maximumWeightLb());
            assertTrue(index.find("not-a-fish").isEmpty());
        }
    }

    @Test
    void mapsInvalidMaximaToUnavailable() {
        PublishedFishIndex index = load("""
                {"schemaVersion":1,"snapshot":"test","fish":[
                  {"normalizedId":"a","displayName":"A","maximumWeightLb":-1},
                  {"normalizedId":"b","displayName":"B","maximumWeightLb":null}
                ]}
                """);
        assertEquals(null, index.find("a").orElseThrow().maximumWeightLb());
        assertEquals(null, index.find("b").orElseThrow().maximumWeightLb());
    }

    @Test
    void rejectsUnsupportedSchemasAndDuplicateIds() {
        assertThrows(IllegalArgumentException.class, () -> load(
                "{\"schemaVersion\":2,\"snapshot\":\"test\",\"fish\":[]}"));
        assertThrows(IllegalArgumentException.class, () -> load("""
                {"schemaVersion":1,"snapshot":"test","fish":[
                  {"normalizedId":"a","displayName":"A","maximumWeightLb":1},
                  {"normalizedId":"a","displayName":"Again","maximumWeightLb":2}
                ]}
                """));
    }

    private static PublishedFishIndex load(String json) {
        return PublishedFishIndex.load(new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8)));
    }
}
