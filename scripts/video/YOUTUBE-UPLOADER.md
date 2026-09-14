# Private YouTube uploader

`youtube-uploader.mjs` runs on Ripley and uploads only renders that have an
adjacent `.youtube.json` sidecar. This prevents test renders from being sent
to the channel accidentally. Uploads default to `private` and are resumable.

Example sidecar next to a render:

```json
{
  "file": "AI_Fear_Final_1080p.mp4",
  "title": "How I'm Afraid of AI",
  "description": "A talking-head video about my concerns around AI.",
  "tags": ["artificial intelligence", "AI", "technology"],
  "categoryId": "22",
  "privacyStatus": "private",
  "madeForKids": false
}
```

The file path may also be absolute, but it must remain under the configured
video root. The uploader records its state and any resumable upload session in
`~/.config/sd-video-youtube/state.json`; OAuth credentials are stored separately
in `token.json` with mode 0600.

The first authorization is interactive. After that, the user does not need to
be present for uploads or YouTube processing checks. A future publishing step
should remain an explicit review decision rather than changing a private upload
to public automatically.
