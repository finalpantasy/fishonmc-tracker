package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Constructor;
import java.lang.reflect.Modifier;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

final class ClientEntrypointContractTest {
    @Test
    void fabricCanReflectivelyConstructTheClientEntrypoint() throws Exception {
        Constructor<FishOnCatchCollectorClient> constructor =
                FishOnCatchCollectorClient.class.getDeclaredConstructor();

        assertTrue(
                Modifier.isPublic(constructor.getModifiers()),
                "Fabric's default language adapter requires a public no-argument constructor");
    }

    @Test
    void emittedBuildVersionsComeFromFabricMetadataInsteadOfAHardcodedNormalizerConstant() throws Exception {
        String client = Files.readString(Path.of(
                "src", "client", "java", "net", "finalpantasy", "fishoncollector", "FishOnCatchCollectorClient.java"));
        String normalizer = Files.readString(Path.of(
                "src", "main", "java", "net", "finalpantasy", "fishoncollector", "CatchNormalizer.java"));

        assertTrue(client.contains("getModContainer(\"fishon-catch-collector\")"));
        assertTrue(client.contains("getModContainer(\"minecraft\")"));
        assertTrue(client.contains("CatchNormalizer.normalize(raw, Instant.now(), SESSION_ID, collectorVersion, minecraftVersion)"));
        assertTrue(!normalizer.contains("COLLECTOR_VERSION"));
    }

    @Test
    void updateCheckerIsIsolatedFromCollectorStartup() throws Exception {
        String client = Files.readString(Path.of(
                "src", "client", "java", "net", "finalpantasy", "fishoncollector", "FishOnCatchCollectorClient.java"));

        assertTrue(client.contains("CollectorUpdateClient.initialize(configDirectory, collectorVersion, minecraftVersion)"));
        assertTrue(client.contains("catch (RuntimeException error)"));
        assertTrue(client.contains("Update checking is unavailable"));
    }
}
