from fastapi import APIRouter, Depends, Response

from app.providers.tts.base import TTSProvider
from app.providers.tts.factory import get_tts_provider
from app.schemas.voice import TtsRequest
from app.services import voice_service

router = APIRouter(prefix="/voice", tags=["voice"])


@router.post("/tts")
async def synthesize(req: TtsRequest, tts: TTSProvider = Depends(get_tts_provider)):
    audio_bytes = await voice_service.synthesize_speech(tts, req.text)
    return Response(content=audio_bytes, media_type=tts.content_type)
