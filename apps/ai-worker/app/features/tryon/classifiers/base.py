from abc import ABC, abstractmethod
from ..models.schemas import ClassifierOutput


class BaseClassifier(ABC):
    @abstractmethod
    async def classify(self, image_bytes: bytes) -> ClassifierOutput:
        """Classify user image framing and visibility."""
        pass
