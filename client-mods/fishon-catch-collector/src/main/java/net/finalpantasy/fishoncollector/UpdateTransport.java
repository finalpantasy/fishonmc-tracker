package net.finalpantasy.fishoncollector;

import java.net.URI;
import java.util.concurrent.CompletableFuture;

@FunctionalInterface
public interface UpdateTransport {
    CompletableFuture<String> fetch(URI uri);
}
