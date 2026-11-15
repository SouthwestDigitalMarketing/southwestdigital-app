# Send to ripley (Android)

A small Android app that sends picked videos and pictures to the phone receiver
on ripley (`scripts/phone_intake.py`), in the background. It replaces keeping the
`/send` web page open: phone browsers stop uploads when the screen changes apps,
and the ripley page is plain http, so background web APIs are not available.

- One pick is one batch, and one batch becomes one episode (same as the web page).
- 8 MiB pieces through `/upload-status` and `PUT /upload?offset=`; a stop resumes
  from what ripley already has.
- Runs as a WorkManager data-sync foreground job with a progress notification
  (Pause, Cancel). Pause/Resume/Cancel also in the app. Cancel calls `POST /cancel`,
  which deletes the half-sent batch on ripley (refused once everything arrived).
- Files ripley already has (same name and byte size) are not sent again; the app
  shows "already on ripley, not sent again".
- `swappsend://pick` opens the app straight to the picker.

## Build (on ripley)

Tools: Java 17 (`mise use -g java@temurin-17`), Android SDK in `~/Android/Sdk`
(`platforms;android-35`, `build-tools;35.0.0`).

`ripley.properties` (git-ignored) holds the receiver URL, a long-lived send
signature (`sexp`, `ssig` from `phone_intake.py --sign-session`) and the signing
keystore. The real one lives in `~/.config/swapp-send-app/` (mode 600) and is
symlinked here. Rotating `PHONE_INTAKE_SECRET` revokes the app; rebuild after.

```bash
cd android/phone-send
ANDROID_HOME=~/Android/Sdk ./gradlew assembleRelease
cp app/build/outputs/apk/release/app-release.apk ~/.local/share/swapp-phone-intake/send-to-ripley.apk
```

The receiver serves it at `/app.apk?exp=..&sig=..` (a signed send-page link with
`/send` replaced by `/app.apk`). Same signing key every build, so updates install
over the old app.

## Tested

2026-11-15 on an Android 15 emulator (Pixel 6 image) against a test receiver:
background send, byte-identical arrival, pause holds, resume continues from the
byte it stopped at, duplicate reused (hard link), cancel removes the batch.
