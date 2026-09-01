from abc import ABC, abstractmethod


class TranscriptSegment:
    __slots__ = ("text", "start", "end")

    def __init__(self, text: str, start: float, end: float):
        self.text = text
        self.start = start
        self.end = end


class TranscriptionResult:
    def __init__(self, text: str, segments: list[TranscriptSegment]):
        self.text = text
        self.segments = segments

    def count_gaps(self, min_gap_seconds: float = 1.2) -> int:
        """Number of silent gaps between recognized speech segments longer
        than min_gap_seconds — a proxy for unnatural pauses in delivery."""
        gaps = 0
        for prev, nxt in zip(self.segments, self.segments[1:]):
            if nxt.start - prev.end >= min_gap_seconds:
                gaps += 1
        return gaps


class STTProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio_path: str) -> TranscriptionResult:
        raise NotImplementedError
