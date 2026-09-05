package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

final class FishStatsEventMapperTest {
    @Test
    void mapsKnownWeatherAndTreatsClearAsInactive() {
        FishStatsSignalSnapshot.EventState rain = FishStatsEventMapper.fromWeather("Rain");
        FishStatsSignalSnapshot.EventState clear = FishStatsEventMapper.fromWeather("Sunny / Clear");

        assertEquals("rain", rain.key());
        assertTrue(rain.active());
        assertEquals("clear", clear.key());
        assertFalse(clear.active());
    }

    @Test
    void unknownOrBlankWeatherFailsClosed() {
        assertEquals(null, FishStatsEventMapper.fromWeather("mystery glyph"));
        assertEquals(null, FishStatsEventMapper.fromWeather(" "));
    }
}
