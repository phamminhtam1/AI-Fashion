import hashlib
import os
from pathlib import Path
from typing import Optional
import httpx
from ..config import settings


class StorageService:
    @staticmethod
    def compute_sha256(data: bytes) -> str:
        return hashlib.sha256(data).hexdigest()

    @staticmethod
    async def load_image_bytes(
        file_path: Optional[str] = None,
        url: Optional[str] = None,
    ) -> bytes:
        if file_path and os.path.exists(file_path):
            with open(file_path, "rb") as f:
                return f.read()

        if url:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                return resp.content

        raise ValueError("Neither valid file_path nor url was provided or file does not exist")

    @staticmethod
    def save_bytes(data: bytes, target_path: str) -> str:
        Path(os.path.dirname(target_path)).mkdir(parents=True, exist_ok=True)
        with open(target_path, "wb") as f:
            f.write(data)
        return target_path

    @staticmethod
    def get_tmp_path(filename: str) -> str:
        return os.path.join(settings.ai_tmp_dir, filename)

    @staticmethod
    def get_upload_path(relative_path: str) -> str:
        return os.path.join(settings.shared_upload_dir, relative_path)
