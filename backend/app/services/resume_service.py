import re
from io import BytesIO


class ResumeParseError(Exception):
    pass


class UnsupportedFileTypeError(ResumeParseError):
    pass


# Only these sections drive question selection — a resume's Summary/Overview/
# Education (college name, GPA) describe the candidate, they don't say what to
# actually quiz them on, so they're deliberately excluded rather than diluting
# the keyword pool with generic filler.
FOCUS_SECTIONS: dict[str, list[str]] = {
    "experience": ["experience", "work experience", "professional experience", "employment history", "employment"],
    "skills": ["skills", "technical skills", "core skills", "key skills"],
    "projects": ["projects", "personal projects", "academic projects", "key projects"],
    "certifications": ["certifications", "certificates", "licenses", "licenses  certifications"],
    "leadership": ["leadership", "leadership experience"],
    "achievements": ["achievements", "accomplishments", "awards", "honors", "honors  awards"],
}
IGNORE_SECTION_HEADERS: set[str] = {
    "summary", "professional summary", "objective", "career objective", "profile", "about", "about me",
    "overview", "education", "academic background", "academic details", "contact", "contact information",
    "personal information", "references", "hobbies", "interests", "languages", "declaration",
}
_ALL_FOCUS_HEADERS: set[str] = {alias for aliases in FOCUS_SECTIONS.values() for alias in aliases}


def extract_text(content: bytes, filename: str) -> str:
    suffix = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if suffix == "pdf":
        return _extract_pdf(content)
    if suffix == "docx":
        return _extract_docx(content)
    if suffix in ("txt", "md"):
        return content.decode("utf-8", errors="ignore")
    raise UnsupportedFileTypeError(f"Unsupported file type '.{suffix}' — upload a PDF, DOCX, or TXT resume.")


def _extract_pdf(content: bytes) -> str:
    from pypdf import PdfReader

    try:
        reader = PdfReader(BytesIO(content))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception as exc:
        raise ResumeParseError("Couldn't read this PDF — it may be scanned/image-based or corrupted.") from exc


def _extract_docx(content: bytes) -> str:
    import docx

    try:
        document = docx.Document(BytesIO(content))
        return "\n".join(p.text for p in document.paragraphs)
    except Exception as exc:
        raise ResumeParseError("Couldn't read this DOCX file — it may be corrupted.") from exc


def _normalize_header(line: str) -> str | None:
    """Returns a normalized section key if this line reads as a resume section
    heading (short, label-like), else None."""
    stripped = line.strip().strip(":").strip()
    if not stripped or len(stripped) > 40:
        return None
    normalized = re.sub(r"[^a-z& ]", "", stripped.lower()).replace("&", "").strip()
    normalized = re.sub(r"\s+", " ", normalized)
    if not normalized:
        return None
    if normalized in _ALL_FOCUS_HEADERS or normalized in IGNORE_SECTION_HEADERS:
        return normalized
    return None


def _section_group(header: str) -> str | None:
    for group, aliases in FOCUS_SECTIONS.items():
        if header in aliases:
            return group
    return None


def _split_into_phrases(text: str) -> list[str]:
    # Bullets/commas/semicolons/pipes commonly separate discrete resume items;
    # a long run-on line without any of those still gets split on sentence
    # boundaries so one giant bullet doesn't become "one keyword".
    rough = re.split(r"[\n•▪●○•,;|]+", text)
    phrases = []
    for chunk in rough:
        chunk = chunk.strip(" -.\t")
        if not chunk:
            continue
        if len(chunk) > 80:
            phrases.extend(s.strip(" -.") for s in re.split(r"(?<=[.!?])\s+", chunk) if s.strip(" -."))
        else:
            phrases.append(chunk)
    return phrases


def _segment_by_section(text: str) -> tuple[dict[str, list[str]], list[str]]:
    current_group: str | None = None
    buffers: dict[str, list[str]] = {group: [] for group in FOCUS_SECTIONS}
    sections_found: list[str] = []

    for line in text.splitlines():
        header = _normalize_header(line)
        if header is not None:
            current_group = _section_group(header)
            if current_group and current_group not in sections_found:
                sections_found.append(current_group)
            continue
        if current_group:
            buffers[current_group].append(line)

    return buffers, sections_found


def extract_focus_keywords(text: str, *, limit: int = 60) -> tuple[list[str], list[str]]:
    """Section-aware extraction: only text under Experience/Skills/Projects/
    Certifications/Leadership/Achievements headings feeds the resume-track
    question matching. Returns (keywords, section groups actually found)."""
    buffers, sections_found = _segment_by_section(text)

    combined = "\n".join(line for group in FOCUS_SECTIONS for line in buffers[group])
    phrases = _split_into_phrases(combined)

    seen: set[str] = set()
    keywords: list[str] = []
    for phrase in phrases:
        key = phrase.lower()
        if key in seen or len(phrase) < 2:
            continue
        seen.add(key)
        keywords.append(phrase)
        if len(keywords) >= limit:
            break

    return keywords, sections_found


def _group_into_projects(lines: list[str]) -> list[dict[str, str]]:
    """Groups the Projects section's raw lines into distinct {title, description}
    entries. Most resumes format each project as a short title line followed by
    bulleted description lines — a non-bulleted line starts a new project, and
    bulleted lines that follow accumulate as its description. A project with no
    bullets at all (a one-line-per-project style) uses that line as both."""
    entries: list[dict[str, str]] = []
    current_title: str | None = None
    current_desc: list[str] = []

    def flush():
        if current_title is not None:
            entries.append({
                "title": current_title,
                "description": " ".join(current_desc) if current_desc else current_title,
            })

    for raw_line in lines:
        is_bullet = raw_line.strip().startswith(("-", "*", "•", "▪", "●", "○"))
        clean = raw_line.strip().lstrip("-*•▪●○ \t").strip()
        if not clean:
            continue
        if is_bullet and current_title is not None:
            current_desc.append(clean)
        else:
            flush()
            current_title = clean.rstrip(":")
            current_desc = []
    flush()

    if not entries:
        combined = " ".join(line.strip() for line in lines if line.strip())
        if combined:
            entries = [{"title": "Project", "description": combined}]

    return entries


def extract_projects(text: str, *, limit: int = 6, max_description_chars: int = 600) -> list[dict[str, str]]:
    """Pulls each project out as its own {title, description} entry, rather than
    flattening them into the same keyword pool as Skills/Experience — a static
    question bank can't have a question about THIS candidate's specific project,
    so callers use this to ground freshly-generated project questions instead."""
    buffers, _ = _segment_by_section(text)
    entries = _group_into_projects(buffers.get("projects", []))

    cleaned: list[dict[str, str]] = []
    for entry in entries[:limit]:
        title = entry["title"].strip()[:120]
        description = entry["description"].strip()
        if len(description) > max_description_chars:
            description = description[:max_description_chars].rsplit(" ", 1)[0] + "…"
        if title:
            cleaned.append({"title": title, "description": description})

    return cleaned
