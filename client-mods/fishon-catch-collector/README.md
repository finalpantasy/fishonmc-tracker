# FishOn Catch Collector

FishOn Catch Collector is an **unofficial, client-only** Fabric mod for Minecraft 1.21.11. It records
your own FishOnMC catches to a private local ledger, adds personal catchbook information to FishOn fish
tooltips, and provides a compact fishing-statistics HUD.

It is not affiliated with or endorsed by FishOnMC, Mojang, or Microsoft.

## Features

- Records structured personal catches after FishOnMC Extras has already recognized them.
- Tracks species, rarity, variant, size, weight, length, location, environmental context, and the
  equipment context FishOnMC Extras exposes at catch time.
- Adds compact personal records, weight rank, published-maximum comparison, and observed variant
  completion inside valid FishOn fish tooltips.
- Shows an expanded local catchbook view while Shift is held.
- Provides a compact fishing HUD with session totals, rarity/size counts, rewards, dry streaks, local
  records, discoveries, backpack/bait warnings, quest status, contests, and observed events.
- Writes append-only JSON Lines that the separate local FishOnMC Tracker can read.
- Quietly checks for newer compatible collector releases and displays a clickable local message.

The mod does not automate casting, reeling, movement, tension, inventory actions, or any other gameplay.

## Requirements

- Minecraft 1.21.11
- Fabric Loader 0.19.3 or newer compatible release
- Fabric API 0.141.6+1.21.11 or newer compatible release
- FishOnMC Extras 0.3.7+1.21.11
- Java 21

The mod is client-only and should not be installed on a server.

## Installation

1. Install the required Minecraft/Fabric stack.
2. Download the normal `fishon-catch-collector-<version>.jar` from the latest GitHub Release. Do not
   install the `-sources.jar`.
3. Close Minecraft.
4. Remove any older FishOn Catch Collector JAR from the instance's `mods` directory.
5. Place the new JAR in `mods` and restart Minecraft.

Removing the JAR disables the mod. It does not delete the local catch ledger.

## Local catch data

Accepted catches are appended to:

```text
<Minecraft instance>/config/fishon-catch-collector/catches.jsonl
```

Each line is one complete JSON object. The writer uses stable event IDs to suppress duplicates across
restarts and forces each accepted append to disk. Malformed historical rows are not rewritten.

The collector runs only when the connected multiplayer host is exactly `play.fishonmc.net`, optionally
followed by a valid port. Single-player, Realms, unrelated servers, malformed addresses, and lookalike
suffixes are rejected.

## Tooltip configuration

The following file is created automatically:

```text
<Minecraft instance>/config/fishon-catchbook-tooltips.properties
```

Defaults:

```properties
catchbookTooltips=true
expandedDetailsRequireShift=true
showCapturedSetup=true
showPublishedMaximum=true
```

The published maximum is a dated reference value, not a guaranteed server cap or live server record.
Personal ranks and records use only catches actually observed by this collector.

## HUD notification configuration

The fishing HUD creates:

```text
<Minecraft instance>/config/fishon-stats-notifications.properties
```

It contains independent toggles and thresholds for backpack capacity, bait, quests, contests, events,
personal bests, discoveries, and correlated rewards. Unknown or unavailable FishOnMC Extras state does
not create an alert.

## Update checks

The collector checks a small public JSON document in this repository for a newer **Minecraft-compatible**
stable release. Checks are asynchronous, occur at most once every 24 hours by default, and fail silently
when offline or when metadata is malformed.

If an update exists, the client displays one local message per game session containing the installed and
latest versions plus a clickable GitHub Release link. The message is not sent to the server. The checker
does not fetch or install JARs.

Configuration is created at:

```text
<Minecraft instance>/config/fishon-catch-collector/update-check.properties
```

Defaults:

```properties
updateChecks=true
updateChannel=stable
updateCheckIntervalHours=24
```

Set `updateChecks=false` to prevent all update-network activity.

## Privacy

Catch rows may contain:

- a local derived event ID and local session ID;
- catch timestamp;
- fish name, rarity, variant, size, weight, and length;
- FishOn location, sub-location, bounded environmental fields, and temperature;
- active pole, reel, line, bait, and pet when available from FishOnMC Extras;
- collector, Minecraft, and FishOnMC Extras versions;
- bounded field-quality statuses.

The raw fish item UUID is hashed locally and is not written. The collector does not record player name,
player UUID, coordinates, raw NBT, raw chat, nearby players, general inventory contents, access tokens,
or unrelated client state.

Update requests use a fixed non-identifying User-Agent containing only the collector version. They do
not include usernames, UUIDs, server addresses, catches, statistics, paths, hardware information,
telemetry identifiers, or credentials.

No catch data is uploaded by this project.

## Safety boundary

FishOn Catch Collector contains no code for:

- automated casting, reeling, tension, movement, camera control, or AFK behavior;
- keyboard or mouse input;
- commands or server-visible chat;
- inventory selection or mutation;
- custom gameplay packets, reconnect logic, or remote control;
- telemetry or automatic software installation.

Its FishOnMC integration observes FishOnMC Extras' existing catch callback after Extras has processed the
catch, reads a bounded set of existing fields, and performs a local append.

## Building from source

Use Java 21:

```powershell
java -version
./gradlew.bat clean test build --no-daemon
```

On Linux/macOS:

```bash
./gradlew clean test build --no-daemon
```

Remapped and source JARs are written to `build/libs/`. Release checksums are attached to each GitHub
Release.

## Verification

The automated suite covers the exact-host gate, privacy-bounded normalization, durable appends, restart
deduplication, FishOnMC Extras-shaped fixtures, catchbook calculations, HUD layout and notifications,
configuration safety, client-only metadata, update compatibility, version comparison, cache intervals,
bounded HTTPS behavior, opt-out, offline failure, and forbidden server-visible updater behavior.

## Development disclosure

`finalpantasy` directed the design, requirements, safety boundaries, visual behavior, testing, and release
decisions. OpenAI Codex was used extensively to assist with implementation, research, documentation, and
automated verification. Complete source is published for players and server staff to inspect.

## License

FishOn Catch Collector is available under the [MIT License](LICENSE).
