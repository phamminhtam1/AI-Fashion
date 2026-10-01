import pytest
from app.models.schemas import ClassifierOutput, VisibilityFlag
from app.classifiers.openai_classifier import OpenAIClassifier


def test_classifier_parses_face_only():
    data = {
        "visibility_flag": "FACE_ONLY",
        "person_count": 1,
        "face_visible": True,
        "upper_body_visible": False,
        "lower_body_visible": False,
        "feet_visible": False,
        "occlusion_level": "low",
        "confidence": 0.95,
    }
    output = ClassifierOutput.model_validate(data)
    assert output.visibility_flag == VisibilityFlag.FACE_ONLY
    assert output.face_visible is True
    assert output.upper_body_visible is False


def test_classifier_parses_full_body():
    data = {
        "visibility_flag": "FULL_BODY",
        "person_count": 1,
        "face_visible": True,
        "upper_body_visible": True,
        "lower_body_visible": True,
        "feet_visible": True,
        "occlusion_level": "low",
        "confidence": 0.99,
    }
    output = ClassifierOutput.model_validate(data)
    assert output.visibility_flag == VisibilityFlag.FULL_BODY
    assert output.feet_visible is True


def test_classifier_invalid_flag():
    data = {
        "visibility_flag": "INVALID",
        "person_count": 0,
        "face_visible": False,
        "upper_body_visible": False,
        "lower_body_visible": False,
        "feet_visible": False,
        "occlusion_level": "high",
        "confidence": 0.40,
    }
    output = ClassifierOutput.model_validate(data)
    assert output.visibility_flag == VisibilityFlag.INVALID


def test_openai_classifier_mock_mode():
    import asyncio
    classifier = OpenAIClassifier(api_key="")
    # Mock mode should return FULL_BODY by default
    res = asyncio.run(classifier.classify(b"fake-image-bytes"))
    assert res.visibility_flag == VisibilityFlag.FULL_BODY
    assert res.confidence >= 0.9
