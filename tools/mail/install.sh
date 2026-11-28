#!/usr/bin/env bash
# Install SWapp's mail tools on ripley from origin/main (or the ref given).
# Copies tools/mail to ~/.local/share/swapp-mail, writes the ~/.local/bin
# commands, seeds Tom's lists in ~/.config/mailroom once, and installs the
# calendar-notify and mail-retain units. Safe to run again after each merge.
set -euo pipefail

DEST="$HOME/.local/share/swapp-mail"
BIN="$HOME/.local/bin"
UNITS="$HOME/.config/systemd/user"
LISTS="$HOME/.config/mailroom"
CALENDAR_PY="$HOME/.local/share/mailroom-calendar/venv/bin/python"

main() {
  local repo ref tmp
  repo=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
  ref=${1:-origin/main}
  git -C "$repo" fetch -q origin
  tmp=$(mktemp -d "$DEST.new.XXXXXX")
  git -C "$repo" archive "$ref" tools/mail | tar -x -C "$tmp" --strip-components=2
  rm -rf "$DEST.old"
  if [[ -d "$DEST" ]]; then mv "$DEST" "$DEST.old"; fi
  mv "$tmp" "$DEST"
  rm -rf "$DEST.old"

  # Tom's lists and rules: Donna adds to them, so they live outside the install.
  mkdir -p "$LISTS"
  for file in spam-never-block.json mail-sort-rules.json; do
    [[ -e "$LISTS/$file" ]] || cp "$DEST/config/$file" "$LISTS/$file"
  done

  # Commands exec the installed path, so each tool still finds its app/ and config/.
  mkdir -p "$BIN"
  for command in mail text mail-retain zoho-html-draft; do
    printf '#!/usr/bin/env bash\nexec %q "$@"\n' "$DEST/bin/$command" > "$BIN/$command.new"
  done
  for command in cal calendar; do
    printf '#!/usr/bin/env bash\nexec %q %q "$@"\n' "$CALENDAR_PY" "$DEST/bin/calendar" > "$BIN/$command.new"
  done
  for command in mail text mail-retain zoho-html-draft cal calendar; do
    chmod +x "$BIN/$command.new"
    rm -f "$BIN/$command"
    mv "$BIN/$command.new" "$BIN/$command"
  done

  mkdir -p "$UNITS"
  cp "$DEST/systemd/calendar-notify.service" "$DEST/systemd/mail-retain.service" \
    "$DEST/systemd/mail-retain.timer" "$UNITS/"
  systemctl --user daemon-reload
  systemctl --user enable -q calendar-notify.service mail-retain.timer
  systemctl --user restart calendar-notify.service
  echo "Installed $(git -C "$repo" rev-parse --short "$ref") to $DEST"
}

main "$@"
