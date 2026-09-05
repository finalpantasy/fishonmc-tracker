package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

final class PublicReleaseContractTest {
    @Test
    void publicMetadataMatchesTheBuildVersionAndSupportedGame() throws Exception {
        String properties = Files.readString(Path.of("gradle.properties"));
        Matcher version = Pattern.compile("(?m)^mod_version=(.+)$").matcher(properties);
        assertTrue(version.find());

        UpdateDocument updates = UpdateDocumentParser.parse(Files.readString(Path.of("update.json"))).orElseThrow();
        CompatibleRelease release = updates.compatibleRelease("stable", "1.21.11").orElseThrow();

        assertEquals(version.group(1).trim(), release.version());
        assertTrue(release.releaseUrl().toString().endsWith("/releases/tag/v" + version.group(1).trim()));
    }

    @Test
    void repositoryHasLicenseDocumentationIgnoreRulesAndWorkflows() throws Exception {
        assertTrue(Files.readString(Path.of("LICENSE")).contains("MIT License"));
        String readme = Files.readString(Path.of("README.md"));
        assertTrue(readme.contains("unofficial"));
        assertTrue(readme.contains("Update checks"));
        assertTrue(readme.contains("Privacy"));

        String ignore = Files.readString(Path.of(".gitignore"));
        assertTrue(ignore.contains("build/"));
        assertTrue(ignore.contains("catches.jsonl"));
        assertTrue(Files.isRegularFile(Path.of(".github", "workflows", "ci.yml")));
        assertTrue(Files.isRegularFile(Path.of(".github", "workflows", "release.yml")));
    }

    @Test
    void buildUsesOnlyTheFabricApiModulesTheCollectorImports() throws Exception {
        String build = Files.readString(Path.of("build.gradle"));
        String properties = Files.readString(Path.of("gradle.properties"));

        assertFalse(build.contains("net.fabricmc.fabric-api:fabric-api:"));
        assertTrue(build.contains("fabric-item-api-v1"));
        assertTrue(build.contains("fabric-lifecycle-events-v1"));
        assertTrue(build.contains("fabric-networking-api-v1"));
        assertTrue(build.contains("fabric-rendering-v1"));
        assertTrue(properties.contains("org.gradle.parallel=false"));
    }

    @Test
    void publicTextDoesNotContainMachineSpecificOrCredentialMaterial() throws Exception {
        String readme = Files.readString(Path.of("README.md"));
        String changelog = Files.readString(Path.of("CHANGELOG.md"));
        String combined = readme + "\n" + changelog;

        assertFalse(combined.contains("C:\\Users\\Owner"));
        assertFalse(combined.contains("K:\\My Drive"));
        assertFalse(combined.contains("gho_"));
        assertFalse(combined.contains("catches.jsonl\"") && combined.contains("eventId\""));
    }
}
