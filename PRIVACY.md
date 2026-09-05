# Privacy

FishOnMC Tracker runs locally and serves its interface only on `127.0.0.1`. It reads the selected instance's FishOnMC Extras profile files, `logs/latest.log`, and `config/fishon-catch-collector/catches.jsonl` when those files exist. It does not expose control endpoints, raw chat, player names, commands, tokens, or credentials.

Browser progress stays in local storage unless you export a backup. Runtime logs and local configuration are excluded from the release manifest and ignored by the included `.gitignore`.
