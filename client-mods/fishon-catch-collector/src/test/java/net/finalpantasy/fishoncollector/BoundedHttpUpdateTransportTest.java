package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.net.URI;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import org.junit.jupiter.api.Test;

final class BoundedHttpUpdateTransportTest {
    private static final URI URI_OK = URI.create(
            "https://raw.githubusercontent.com/finalpantasy/fishon-catch-collector/main/update.json");

    @Test
    void acceptsBoundedSuccessfulUtf8Response() {
        BoundedHttpUpdateTransport transport = new BoundedHttpUpdateTransport((uri, timeout, userAgent) ->
                CompletableFuture.completedFuture(new BoundedHttpUpdateTransport.Response(
                        200, "{\"ok\":true}".getBytes(StandardCharsets.UTF_8))));

        assertEquals("{\"ok\":true}", transport.fetch(URI_OK).join());
    }

    @Test
    void rejectsNonHttpsNonSuccessOversizedAndTimeoutResponses() {
        BoundedHttpUpdateTransport ok = new BoundedHttpUpdateTransport((uri, timeout, userAgent) ->
                CompletableFuture.completedFuture(new BoundedHttpUpdateTransport.Response(200, new byte[0])));
        assertThrows(CompletionException.class, () -> ok.fetch(URI.create("http://example.com/update.json")).join());

        BoundedHttpUpdateTransport denied = new BoundedHttpUpdateTransport((uri, timeout, userAgent) ->
                CompletableFuture.completedFuture(new BoundedHttpUpdateTransport.Response(429, new byte[0])));
        assertThrows(CompletionException.class, () -> denied.fetch(URI_OK).join());

        BoundedHttpUpdateTransport huge = new BoundedHttpUpdateTransport((uri, timeout, userAgent) ->
                CompletableFuture.completedFuture(new BoundedHttpUpdateTransport.Response(
                        200, new byte[BoundedHttpUpdateTransport.MAX_RESPONSE_BYTES + 1])));
        assertThrows(CompletionException.class, () -> huge.fetch(URI_OK).join());

        BoundedHttpUpdateTransport timeout = new BoundedHttpUpdateTransport((uri, duration, userAgent) ->
                CompletableFuture.failedFuture(new HttpTimeoutException("test")));
        assertThrows(CompletionException.class, () -> timeout.fetch(URI_OK).join());
    }
}
