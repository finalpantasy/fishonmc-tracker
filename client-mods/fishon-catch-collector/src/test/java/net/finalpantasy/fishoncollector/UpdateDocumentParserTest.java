package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.Optional;
import org.junit.jupiter.api.Test;

final class UpdateDocumentParserTest {
    private static final String VALID = """
            {
              "schemaVersion": 1,
              "modId": "fishon-catch-collector",
              "channels": {
                "stable": {
                  "1.21.11": {
                    "version": "0.4.2",
                    "releaseUrl": "https://github.com/finalpantasy/fishon-catch-collector/releases/tag/v0.4.2"
                  }
                }
              }
            }
            """;

    @Test
    void selectsOnlyTheExactChannelAndMinecraftVersion() {
        UpdateDocument document = UpdateDocumentParser.parse(VALID).orElseThrow();

        assertEquals(
                new CompatibleRelease(
                        "0.4.2",
                        URI.create("https://github.com/finalpantasy/fishon-catch-collector/releases/tag/v0.4.2")),
                document.compatibleRelease("stable", "1.21.11").orElseThrow());
        assertTrue(document.compatibleRelease("stable", "1.21.12").isEmpty());
        assertTrue(document.compatibleRelease("beta", "1.21.11").isEmpty());
    }

    @Test
    void rejectsMalformedWrongIdentityUnsafeAndOversizedDocuments() {
        assertTrue(UpdateDocumentParser.parse("not json").isEmpty());
        assertTrue(UpdateDocumentParser.parse(VALID.replace("\"schemaVersion\": 1", "\"schemaVersion\": 2")).isEmpty());
        assertTrue(UpdateDocumentParser.parse(VALID.replace("fishon-catch-collector", "other-mod")).isEmpty());
        assertTrue(UpdateDocumentParser.parse(VALID.replace("https://github.com", "http://github.com")).isEmpty());
        assertTrue(UpdateDocumentParser.parse(VALID.replace("finalpantasy", "lookalike")).isEmpty());
        assertTrue(UpdateDocumentParser.parse(" ".repeat(UpdateDocumentParser.MAX_DOCUMENT_CHARS + 1)).isEmpty());
    }

    @Test
    void rejectsIncompleteOrInvalidVersions() {
        assertTrue(UpdateDocumentParser.parse(VALID.replace("\"version\": \"0.4.2\",", "")).isEmpty());
        assertTrue(UpdateDocumentParser.parse(VALID.replace("0.4.2", "definitely-not-a-version")).isEmpty());
        assertTrue(UpdateDocumentParser.parse(VALID.replace("\"releaseUrl\":", "\"missingReleaseUrl\":")).isEmpty());
    }
}
