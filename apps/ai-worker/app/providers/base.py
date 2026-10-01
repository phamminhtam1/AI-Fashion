from abc import ABC, abstractmethod
from typing import Optional
from ..models.schemas import GarmentMetadata


class TryOnProvider(ABC):
    @abstractmethod
    async def generate(
        self,
        job_id: str,
        user_image_path: str,
        garment_image_path: str,
        prompt: str,
        metadata: Optional[GarmentMetadata] = None,
        target_output_path: Optional[str] = None,
    ) -> str:
        """Generate virtual try-on result and return output file path or URL."""
        pass
