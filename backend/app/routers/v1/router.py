from fastapi import APIRouter

from app.routers.v1 import admin_questions, answers, health, monitoring, sessions, voice

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(sessions.router)
api_router.include_router(answers.router)
api_router.include_router(voice.router)
api_router.include_router(monitoring.router)
api_router.include_router(admin_questions.router)
