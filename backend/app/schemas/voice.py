from pydantic import BaseModel


class VoiceCommandRequest(BaseModel):
    command: str  # "repeat" | "rephrase"


class VoiceCommandResponse(BaseModel):
    spoken_text: str
    command: str


class TtsRequest(BaseModel):
    text: str


class MonitoringEventIn(BaseModel):
    session_id: str
    session_question_id: str | None = None
    in_bounds: bool
    gaze_x: float | None = None
    gaze_y: float | None = None
    reason: str | None = None
