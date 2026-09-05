package net.finalpantasy.fishoncollector;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;

public final class BoundedHttpUpdateTransport implements UpdateTransport {
    public static final int MAX_RESPONSE_BYTES = 16_384;
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(3);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(5);
    private final RequestExecutor executor;
    private final String userAgent;

    public BoundedHttpUpdateTransport(String collectorVersion) {
        this(new JdkRequestExecutor(), "FishOn-Catch-Collector/" + safeVersion(collectorVersion));
    }

    BoundedHttpUpdateTransport(RequestExecutor executor) {
        this(executor, "FishOn-Catch-Collector/test");
    }

    private BoundedHttpUpdateTransport(RequestExecutor executor, String userAgent) {
        this.executor = executor;
        this.userAgent = userAgent;
    }

    @Override
    public CompletableFuture<String> fetch(URI uri) {
        if (!isAllowedMetadataUri(uri)) {
            return CompletableFuture.failedFuture(new IllegalArgumentException("HTTPS metadata URL required"));
        }
        Duration requestTimeout = REQUEST_TIMEOUT;
        return executor.execute(uri, requestTimeout, userAgent).thenApply(response -> {
            if (response == null || response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new CompletionException(new IllegalStateException("Unexpected update response"));
            }
            byte[] body = response.body();
            if (body == null || body.length == 0 || body.length > MAX_RESPONSE_BYTES) {
                throw new CompletionException(new IllegalStateException("Invalid update response size"));
            }
            try {
                return StandardCharsets.UTF_8.newDecoder()
                        .onMalformedInput(CodingErrorAction.REPORT)
                        .onUnmappableCharacter(CodingErrorAction.REPORT)
                        .decode(ByteBuffer.wrap(body))
                        .toString();
            } catch (CharacterCodingException error) {
                throw new CompletionException(error);
            }
        });
    }

    private static boolean isAllowedMetadataUri(URI uri) {
        return uri != null
                && "https".equalsIgnoreCase(uri.getScheme())
                && "raw.githubusercontent.com".equalsIgnoreCase(uri.getHost())
                && uri.getUserInfo() == null
                && uri.getPort() == -1
                && uri.getQuery() == null
                && uri.getFragment() == null
                && "/finalpantasy/fishon-catch-collector/main/update.json".equals(uri.getPath());
    }

    private static String safeVersion(String value) {
        if (value == null || !value.matches("[0-9A-Za-z.+_-]{1,64}")) return "unknown";
        return value;
    }

    @FunctionalInterface
    interface RequestExecutor {
        CompletableFuture<Response> execute(URI uri, Duration timeout, String userAgent);
    }

    record Response(int statusCode, byte[] body) {}

    private static final class JdkRequestExecutor implements RequestExecutor {
        private final HttpClient client = HttpClient.newBuilder()
                .connectTimeout(CONNECT_TIMEOUT)
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();

        @Override
        public CompletableFuture<Response> execute(URI uri, Duration timeout, String userAgent) {
            HttpRequest request = HttpRequest.newBuilder(uri)
                    .timeout(timeout)
                    .header("Accept", "application/json")
                    .header("User-Agent", userAgent)
                    .GET()
                    .build();
            return client.sendAsync(request, HttpResponse.BodyHandlers.ofByteArray())
                    .thenApply(response -> new Response(response.statusCode(), response.body()));
        }
    }
}
