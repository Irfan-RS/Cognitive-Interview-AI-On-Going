import asyncio
from functools import lru_cache

from app.providers.stt.base import STTProvider, TranscriptionResult, TranscriptSegment


@lru_cache
def _load_model(model_size: str, device: str, compute_type: str):
    # Imported lazily: faster-whisper pulls in ctranslate2, which is a heavy
    # import we don't want to pay at app startup if STT is never used.
    from faster_whisper import WhisperModel

    return WhisperModel(model_size, device=device, compute_type=compute_type)


class LocalWhisperProvider(STTProvider):
    """CTranslate2-backed local transcription (faster-whisper) — runs fully
    offline on CPU. "base" is a reasonable default for 8GB RAM; "tiny" if
    you need it faster/lighter, "small" if you have RAM to spare."""

    def __init__(self, model_size: str, device: str, compute_type: str):
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type

    async def transcribe(self, audio_path: str) -> TranscriptionResult:
        return await asyncio.to_thread(self._transcribe_sync, audio_path)

    def _transcribe_sync(self, audio_path: str) -> TranscriptionResult:
        model = _load_model(self.model_size, self.device, self.compute_type)
        segments_iter, _info = model.transcribe(audio_path, vad_filter=True)

        segments = [TranscriptSegment(text=s.text.strip(), start=s.start, end=s.end) for s in segments_iter]
        full_text = " ".join(s.text for s in segments).strip()
        return TranscriptionResult(text=full_text, segments=segments)
