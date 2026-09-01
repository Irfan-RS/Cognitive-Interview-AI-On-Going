from abc import ABC, abstractmethod


class TTSProvider(ABC):
    content_type: str = "audio/mpeg"

    @abstractmethod
    async def synthesize(self, text: str) -> bytes:
        """Return audio bytes for the given text, in self.content_type."""
        raise NotImplementedError
