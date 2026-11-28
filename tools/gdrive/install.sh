#!/usr/bin/env bash
# Install gdrive (read-only Google Drive) from origin/main (or the ref given)
# on the machine that holds its sign-in, dalliance today. Copies tools/gdrive
# to ~/.local/share/swapp-gdrive, keeps its libraries in a venv beside it
# (rebuilt only when requirements.txt changes), writes ~/.local/bin/gdrive.
set -euo pipefail

DEST="$HOME/.local/share/swapp-gdrive"
VENV="$HOME/.local/share/swapp-gdrive-venv"
BIN="$HOME/.local/bin"

main() {
  local repo ref tmp want
  # SWAPP_REPO lets it run from a copy outside the checkout.
  repo=${SWAPP_REPO:-$(git -C "$(dirname "$0")" rev-parse --show-toplevel)}
  ref=${1:-origin/main}
  git -C "$repo" fetch -q origin
  tmp=$(mktemp -d "$DEST.new.XXXXXX")
  git -C "$repo" archive "$ref" tools/gdrive | tar -x -C "$tmp" --strip-components=2
  rm -rf "$DEST.old"
  if [[ -d "$DEST" ]]; then mv "$DEST" "$DEST.old"; fi
  mv "$tmp" "$DEST"
  rm -rf "$DEST.old"

  want=$(sha256sum "$DEST/requirements.txt" | cut -d' ' -f1)
  if [[ ! -x "$VENV/bin/python" || "$(cat "$VENV/.requirements" 2>/dev/null)" != "$want" ]]; then
    rm -rf "$VENV"
    python3 -m venv "$VENV"
    "$VENV/bin/pip" install -q -r "$DEST/requirements.txt"
    echo "$want" > "$VENV/.requirements"
  fi

  mkdir -p "$BIN"
  printf '#!/usr/bin/env bash\nexec %q %q "$@"\n' "$VENV/bin/python" "$DEST/bin/gdrive" > "$BIN/gdrive.new"
  chmod +x "$BIN/gdrive.new"
  rm -f "$BIN/gdrive"
  mv "$BIN/gdrive.new" "$BIN/gdrive"
  echo "Installed gdrive $(git -C "$repo" rev-parse --short "$ref") to $DEST"
}

main "$@"
