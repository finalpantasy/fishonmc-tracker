package net.finalpantasy.fishoncollector;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

public final class UpdateDocumentParser {
    public static final int MAX_DOCUMENT_CHARS = 16_384;
    private static final String MOD_ID = "fishon-catch-collector";
    private static final String RELEASE_PATH_PREFIX = "/finalpantasy/fishon-catch-collector/releases/tag/";

    private UpdateDocumentParser() {}

    public static Optional<UpdateDocument> parse(String json) {
        if (json == null || json.isBlank() || json.length() > MAX_DOCUMENT_CHARS) return Optional.empty();
        try {
            JsonElement rootElement = JsonParser.parseString(json);
            if (!rootElement.isJsonObject()) return Optional.empty();
            JsonObject root = rootElement.getAsJsonObject();
            if (requiredInt(root, "schemaVersion") != 1) return Optional.empty();
            if (!MOD_ID.equals(requiredString(root, "modId"))) return Optional.empty();
            JsonObject channelsObject = requiredObject(root, "channels");

            Map<String, Map<String, CompatibleRelease>> channels = new LinkedHashMap<>();
            for (Map.Entry<String, JsonElement> channelEntry : channelsObject.entrySet()) {
                if (!channelEntry.getValue().isJsonObject()) return Optional.empty();
                Map<String, CompatibleRelease> versions = new LinkedHashMap<>();
                for (Map.Entry<String, JsonElement> versionEntry
                        : channelEntry.getValue().getAsJsonObject().entrySet()) {
                    if (!versionEntry.getValue().isJsonObject()) return Optional.empty();
                    JsonObject releaseObject = versionEntry.getValue().getAsJsonObject();
                    String version = requiredString(releaseObject, "version");
                    String releaseUrl = requiredString(releaseObject, "releaseUrl");
                    if (!CollectorVersion.isValid(version)) return Optional.empty();
                    URI uri = URI.create(releaseUrl);
                    if (!isAllowedReleaseUri(uri)) return Optional.empty();
                    versions.put(versionEntry.getKey(), new CompatibleRelease(version, uri));
                }
                channels.put(channelEntry.getKey(), Map.copyOf(versions));
            }
            if (channels.isEmpty()) return Optional.empty();
            return Optional.of(new UpdateDocument(1, MOD_ID, Map.copyOf(channels)));
        } catch (RuntimeException error) {
            return Optional.empty();
        }
    }

    static boolean isAllowedReleaseUri(URI uri) {
        if (uri == null
                || !"https".equalsIgnoreCase(uri.getScheme())
                || !"github.com".equalsIgnoreCase(uri.getHost())
                || uri.getUserInfo() != null
                || uri.getPort() != -1
                || uri.getQuery() != null
                || uri.getFragment() != null) {
            return false;
        }
        String path = uri.getPath();
        return path != null && path.startsWith(RELEASE_PATH_PREFIX) && path.length() > RELEASE_PATH_PREFIX.length();
    }

    private static JsonObject requiredObject(JsonObject object, String key) {
        JsonElement element = object.get(key);
        if (element == null || !element.isJsonObject()) throw new IllegalArgumentException(key);
        return element.getAsJsonObject();
    }

    private static String requiredString(JsonObject object, String key) {
        JsonElement element = object.get(key);
        if (element == null || !element.isJsonPrimitive() || !element.getAsJsonPrimitive().isString()) {
            throw new IllegalArgumentException(key);
        }
        String value = element.getAsString().trim();
        if (value.isEmpty() || value.length() > 512) throw new IllegalArgumentException(key);
        return value;
    }

    private static int requiredInt(JsonObject object, String key) {
        JsonElement element = object.get(key);
        if (element == null || !element.isJsonPrimitive() || !element.getAsJsonPrimitive().isNumber()) {
            throw new IllegalArgumentException(key);
        }
        return element.getAsInt();
    }
}
