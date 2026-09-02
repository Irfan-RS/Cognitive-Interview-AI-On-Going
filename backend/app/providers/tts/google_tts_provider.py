import asyncio
from functools import lru_cache

from app.providers.tts.base import TTSProvider


@lru_cache
def _get_client():
    # Cached process-wide: each call otherwise opened a fresh gRPC channel
    # that was never closed, leaking sockets/threads under sustained use.
    from google.cloud import texttospeech

    return texttospeech.TextToSpeechClient()


class GoogleCloudTTSProvider(TTSProvider):
    """Google Cloud Text-to-Speech (free tier — first ~1M/4M chars/month
    depending on voice type, at time of writing). Requires
    GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account JSON key
    with the Cloud Text-to-Speech API enabled."""

    def __init__(self, voice_name: str, language_code: str):
        self.voice_name = voice_name
        self.language_code = language_code

    async def synthesize(self, text: str) -> bytes:
        return await asyncio.to_thread(self._synthesize_sync, text)

    def _synthesize_sync(self, text: str) -> bytes:
        # Imported lazily so the app can boot (and use local TTS) without
        # the google-cloud-texttospeech package being configured.
        from google.cloud import texttospeech

        client = _get_client()
        synthesis_input = texttospeech.SynthesisInput(text=text)
        voice = texttospeech.VoiceSelectionParams(
            language_code=self.language_code,
            name=self.voice_name,
        )
        audio_config = texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3)

        response = client.synthesize_speech(input=synthesis_input, voice=voice, audio_config=audio_config)
        return response.audio_content
