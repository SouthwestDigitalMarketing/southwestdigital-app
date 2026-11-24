"""Local voicemail transcription using Ripley's existing faster-whisper venv."""
from pathlib import Path
import os
import subprocess
import sys
import numpy as np
from faster_whisper import WhisperModel


def main():
    audio, output = map(Path, sys.argv[1:])
    # Decode with the installed ffmpeg rather than faster-whisper's PyAV
    # adapter, which is incompatible with Ripley's current PyAV version.
    decoded = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(audio), "-f", "f32le", "-ar", "16000", "-ac", "1", "-"],
        capture_output=True, timeout=60, check=True,
    )
    samples = np.frombuffer(decoded.stdout, dtype=np.float32)
    model = WhisperModel(os.environ.get("SWAPP_WHISPER_MODEL", "base.en"), device="cpu", compute_type="int8")
    segments, _ = model.transcribe(samples, beam_size=5, vad_filter=True)
    text = "\n".join(segment.text.strip() for segment in segments)
    temporary = output.with_suffix(".tmp")
    temporary.write_text(text)
    os.chmod(temporary, 0o600)
    temporary.replace(output)


if __name__ == "__main__":
    main()
