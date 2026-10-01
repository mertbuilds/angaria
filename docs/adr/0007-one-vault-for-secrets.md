# 0007. One vault item for secrets, a file in dev builds

Accepted, 2026-10-01.

## Context

The desktop app kept a keychain item per secret: the license record and one GİB password per company. It read every company's item at launch, read and rewrote the license item on every license check and hourly recount, and wrote the password item on every keystroke in Ayarlar. macOS ties keychain access to the binary's code identity, and every rebuild of an unsigned dev binary is a new identity, so a dev session asked for keychain access again and again.

## Decision

Every secret lives in one keychain item, service `com.vinena.angaria`, account `vault`, as JSON: `{ v: 1, license?, gibPasswords: { [entityId]: password } }`. The app reads it once per launch, on first need, keeps it in memory and writes only when the serialized content changes. Password typing writes after a 500 ms pause. The license writes on a new status, key, details, expiry or check time; the time seen alone at most once a day. The first launch moves the old items into the vault and deletes them only after the vault is written.

Dev builds (`debug_assertions`) keep the vault in a JSON file with mode 0600 in the app data dir behind the same `vault_read` and `vault_write` commands. `ANGARIA_DEV_KEYCHAIN=1` opts a dev build into the keychain. Release builds always use the keychain.

## Consequences

- A launch costs one keychain read, and only real changes write.
- Dev builds never touch the keychain after their first launch, which moves any old items into the file once.
- Every secret shares one item: a write rewrites all of them, and Windows' 2560-byte credential limit caps the size once Windows ships.
- After a restart the clock check counts from a saved time seen at most a day old.
- ⌘Q within 500 ms of the last keystroke in the password field loses that change: macOS quits without a close event the app could wait on.
- Dev builds and the keychain keep separate vaults, so switching `ANGARIA_DEV_KEYCHAIN` starts from the other store's content.
