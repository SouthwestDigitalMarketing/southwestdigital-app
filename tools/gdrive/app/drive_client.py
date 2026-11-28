"""Google Drive API access (OAuth, installed-app flow).

One-time setup is documented in bin/gdrive --setup-help. The refresh token,
once obtained, lives in ~/.config/mailroom/drive-token.json (mode 600) and
is reused silently after that -- no browser involved on later runs.
"""
import json
import os
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
CONFIG_DIR = Path.home() / ".config" / "mailroom"
CLIENT_SECRET_PATH = CONFIG_DIR / "drive-client-secret.json"
TOKEN_PATH = CONFIG_DIR / "drive-token.json"


def _save_token(creds: Credentials) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    TOKEN_PATH.write_text(creds.to_json())
    os.chmod(TOKEN_PATH, 0o600)


def get_credentials(run_authorization: bool = False) -> Credentials:
    creds = None
    if TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
    if creds and creds.valid:
        return creds
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        _save_token(creds)
        return creds
    if not run_authorization:
        raise RuntimeError(
            "No valid Drive token on file. Run: gdrive --authorize"
        )
    if not CLIENT_SECRET_PATH.exists():
        raise RuntimeError(
            f"Missing OAuth client secret at {CLIENT_SECRET_PATH}. "
            "Run: gdrive --setup-help"
        )
    flow = InstalledAppFlow.from_client_secrets_file(
        str(CLIENT_SECRET_PATH), SCOPES
    )
    creds = flow.run_local_server(port=0, open_browser=False, prompt="consent")
    _save_token(creds)
    return creds


def drive_service(run_authorization: bool = False):
    creds = get_credentials(run_authorization=run_authorization)
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def most_recent_file(service, query: str | None = None) -> dict:
    params = {
        "pageSize": 1,
        "orderBy": "createdTime desc",
        "fields": "files(id,name,mimeType,createdTime,modifiedTime,size,webViewLink,owners(emailAddress))",
        "q": "trashed = false" + (f" and ({query})" if query else ""),
    }
    result = service.files().list(**params).execute()
    files = result.get("files", [])
    if not files:
        raise RuntimeError("No files found in Drive.")
    return files[0]


GOOGLE_NATIVE_EXPORTS = {
    "application/vnd.google-apps.document": (
        "text/plain",
        ".txt",
    ),
    "application/vnd.google-apps.spreadsheet": (
        "text/csv",
        ".csv",
    ),
}


def download_file(service, file_meta: dict, dest_dir: Path) -> Path:
    dest_dir.mkdir(parents=True, exist_ok=True)
    mime_type = file_meta["mimeType"]
    name = file_meta["name"]
    file_id = file_meta["id"]

    if mime_type in GOOGLE_NATIVE_EXPORTS:
        export_mime, suffix = GOOGLE_NATIVE_EXPORTS[mime_type]
        data = service.files().export(fileId=file_id, mimeType=export_mime).execute()
        out_path = dest_dir / (name + suffix)
        out_path.write_bytes(data)
        return out_path

    request = service.files().get_media(fileId=file_id)
    data = request.execute()
    out_path = dest_dir / name
    out_path.write_bytes(data)
    return out_path
