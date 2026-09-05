package net.finalpantasy.fishoncollector;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class ServerGate {
    private static final String ALLOWED_HOST = "play.fishonmc.net";
    private static final Pattern ADDRESS = Pattern.compile("^([A-Za-z0-9.-]+)(?::([0-9]{1,5}))?$");

    private ServerGate() {}

    public static boolean isAllowed(String address) {
        if (address == null || address.isBlank()) return false;
        Matcher matcher = ADDRESS.matcher(address.trim());
        if (!matcher.matches()) return false;
        if (!ALLOWED_HOST.equals(matcher.group(1).toLowerCase(Locale.ROOT))) return false;
        String portText = matcher.group(2);
        if (portText == null) return true;
        int port;
        try {
            port = Integer.parseInt(portText);
        } catch (NumberFormatException ignored) {
            return false;
        }
        return port >= 1 && port <= 65535;
    }
}
