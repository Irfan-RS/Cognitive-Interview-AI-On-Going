import asyncio
import shutil
import subprocess
import tempfile
from pathlib import Path

from app.providers.tts.base import TTSProvider


class LocalTTSProvider(TTSProvider):
    """Offline fallback so the app is testable with zero cloud setup: uses
    the OS's built-in speech engine (SAPI5 on Windows via pyttsx3, espeak-ng
    on Linux). Lower voice quality than Google Cloud TTS, but no API key and
    no network."""

    content_type = "audio/wav"

    async def synthesize(self, text: str) -> bytes:
        return await asyncio.to_thread(self._synthesize_sync, text)

    def _synthesize_sync(self, text: str) -> bytes:
        # pyttsx3's Linux driver pipes espeak's output through ffmpeg to make a
        # WAV, and ffmpeg isn't in slim container images — save_to_file then
        # writes nothing at all and the read fails with FileNotFoundError.
        # espeak-ng writes WAV itself, so call it directly where it exists.
        if shutil.which("espeak-ng"):
            return self._synthesize_espeak(text)
        return self._synthesize_pyttsx3(text)

    @staticmethod
    def _synthesize_espeak(text: str) -> bytes:
        with tempfile.TemporaryDirectory() as tmp_dir:
            out_path = Path(tmp_dir) / "speech.wav"
            subprocess.run(
                ["espeak-ng", "-w", str(out_path), "--stdin"],
                input=text.encode("utf-8"),
                check=True,
                capture_output=True,
                timeout=30,
            )
            return out_path.read_bytes()

    def _synthesize_pyttsx3(self, text: str) -> bytes:
        import pyttsx3

        # SAPI5 is a COM component, and this runs on an asyncio worker thread
        # where COM was never initialised — without this the engine raises
        # "CoInitialize has not been called" and question audio fails.
        # No-op on non-Windows, where pyttsx3 uses espeak/nsss instead.
        com_initialised = False
        try:
            import pythoncom  # type: ignore[import-not-found]

            pythoncom.CoInitialize()
            com_initialised = True
        except Exception:  # noqa: BLE001 - not Windows, or pywin32 absent
            pass

        try:
            with tempfile.TemporaryDirectory() as tmp_dir:
                out_path = Path(tmp_dir) / "speech.wav"
                engine = pyttsx3.init()
                engine.save_to_file(text, str(out_path))
                engine.runAndWait()
                return out_path.read_bytes()
        finally:
            if com_initialised:
                try:
                    pythoncom.CoUninitialize()
                except Exception:  # noqa: BLE001
                    pass
