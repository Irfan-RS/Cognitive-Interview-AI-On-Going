from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas.resume import ResumeParseResponse
from app.services import resume_service

router = APIRouter(prefix="/resume", tags=["resume"])


@router.post("/parse", response_model=ResumeParseResponse)
async def parse_resume(file: UploadFile = File(...)):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file upload")

    try:
        text = resume_service.extract_text(content, file.filename or "")
    except resume_service.UnsupportedFileTypeError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    except resume_service.ResumeParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    keywords, sections_found = resume_service.extract_focus_keywords(text)
    if not keywords:
        raise HTTPException(
            status_code=422,
            detail=(
                "Couldn't find any Experience, Skills, Projects, Certifications, Leadership, "
                "or Achievements content in this resume — try a different file, or enter keywords manually."
            ),
        )

    projects = resume_service.extract_projects(text)
    return ResumeParseResponse(keywords=keywords, sections_found=sections_found, projects=projects)
