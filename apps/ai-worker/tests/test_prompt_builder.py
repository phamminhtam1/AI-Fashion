from app.models.schemas import GarmentMetadata, VisibilityFlag
from app.prompts.tryon_prompt_builder import TryOnPromptBuilder


def test_prompt_builder_full_body():
    prompt = TryOnPromptBuilder.build_prompt(VisibilityFlag.FULL_BODY)
    assert "full-body virtual try-on" in prompt.lower()
    assert "Preserve the person's" in prompt
    assert "Preserve the garment's exact" in prompt


def test_prompt_builder_upper_body():
    prompt = TryOnPromptBuilder.build_prompt(VisibilityFlag.UPPER_BODY)
    assert "upper-body virtual try-on" in prompt.lower()
    assert "Do not generate or invent a full body" in prompt
    assert "Preserve the original crop and framing" in prompt


def test_prompt_builder_face_only():
    prompt = TryOnPromptBuilder.build_prompt(VisibilityFlag.FACE_ONLY)
    assert "facial identity reference" in prompt.lower()
    assert "upper-body fashion portrait" in prompt.lower()
    assert "Do not claim to preserve the original body proportions" in prompt


def test_prompt_builder_with_garment_metadata():
    metadata = GarmentMetadata(
        category="tops",
        garment_type="silk blouse",
        primary_color="emerald green",
        pattern="floral",
    )
    prompt = TryOnPromptBuilder.build_prompt(VisibilityFlag.FULL_BODY, metadata)
    assert "Garment item: silk blouse" in prompt
    assert "Color: emerald green" in prompt
    assert "Pattern: floral" in prompt
