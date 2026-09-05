package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

final class ServerGateTest {
    @Test
    void acceptsOnlyTheExactFishOnMcHostWithAnOptionalValidPort() {
        assertTrue(ServerGate.isAllowed("play.fishonmc.net"));
        assertTrue(ServerGate.isAllowed("PLAY.FISHONMC.NET"));
        assertTrue(ServerGate.isAllowed("play.fishonmc.net:25565"));

        assertFalse(ServerGate.isAllowed(null));
        assertFalse(ServerGate.isAllowed(""));
        assertFalse(ServerGate.isAllowed("fishonmc.net"));
        assertFalse(ServerGate.isAllowed("play.fishonmc.net.evil.example"));
        assertFalse(ServerGate.isAllowed("evilplay.fishonmc.net"));
        assertFalse(ServerGate.isAllowed("https://play.fishonmc.net"));
        assertFalse(ServerGate.isAllowed("play.fishonmc.net:not-a-port"));
        assertFalse(ServerGate.isAllowed("play.fishonmc.net:0"));
        assertFalse(ServerGate.isAllowed("play.fishonmc.net:65536"));
        assertFalse(ServerGate.isAllowed("localhost"));
    }
}
