# FishOnMC Tracker

FishOnMC Tracker is a local companion app for the FishOnMC Minecraft server. It includes the fish compendium, locations, bait/setup references, individual catch history, and an Everything Compendium with 30 objectives per fully attainable fish/location: Caught, five sizes, four variants, and twenty exact size-by-variant combinations.

This is an unofficial community project. It is not affiliated with or endorsed by FishOnMC, Mojang, or Microsoft.

## Local launch

1. Copy `fishonmc-tracker.config.example.json` to `fishonmc-tracker.config.json`.
2. Replace the example instance path with your FishOnMC Minecraft instance path.
3. Run `Open-FishOnMC-Tracker.cmd`.

The launcher requires Windows and Node.js 20 or newer. The included catch collector requires Minecraft 1.21.11, Fabric Loader, Fabric API, FishOnMC Extras, and Java 21; see its bundled README for exact versions.

The app binds to `127.0.0.1` only. Checklist and catch history are stored in your browser. The optional catch collector writes structured catches inside the selected Minecraft instance; the Tracker only reads them.

This public repository intentionally excludes the private progression guide, walkthrough, research archive, local configuration, runtime logs, and player data.

## Data status

The bundled reference snapshot includes 17 locations and 361 fish. Newly released Nile River fields that have not yet been confirmed are labeled `Unverified` rather than inferred. The Tracker links its FishOnMC Wiki sources in the interface.

## License and attribution

Tracker and catch-collector source code is available under the [MIT License](LICENSE). Original replacement artwork is licensed separately under CC BY-NC-SA 4.0. FishOnMC Wiki-derived text, facts, and media retain the wiki's CC BY-SA 4.0 terms. See [RIGHTS.md](RIGHTS.md) for scope, attribution, trademarks, and bundled-project notices.
