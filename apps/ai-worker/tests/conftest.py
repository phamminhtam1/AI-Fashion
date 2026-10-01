import pytest
from app.config import settings

@pytest.fixture(autouse=True)
def enable_mock_mode_for_tests():
    original = settings.ai_mock_mode
    settings.ai_mock_mode = True
    yield
    settings.ai_mock_mode = original
