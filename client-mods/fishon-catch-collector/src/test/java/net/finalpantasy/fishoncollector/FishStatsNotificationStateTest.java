package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

final class FishStatsNotificationStateTest {
    @TempDir Path temp;

    @Test
    void persistsLearnedQuestCapacityWithoutShrinking() {
        Path path = temp.resolve("state.properties");
        FishStatsNotificationState state = FishStatsNotificationState.load(path, 3);
        state.rememberQuestCapacity(5);
        state.rememberQuestCapacity(4);

        assertEquals(5, FishStatsNotificationState.load(path, 3).questCapacity());
    }
}
