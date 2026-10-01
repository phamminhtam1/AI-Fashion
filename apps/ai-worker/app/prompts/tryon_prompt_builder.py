from typing import Optional
from ..models.schemas import GarmentMetadata, VisibilityFlag

PROMPT_VERSION = "v3-kie-sunburst"

PROMPT_FULL_BODY = """Use Image 1 as the target person.
Use Image 2 as the exact garment reference.

Perform a full-body virtual try-on.

Preserve the person's:
- face
- identity
- hairstyle
- skin tone
- body proportions
- pose
- hands
- legs
- background

Dress the person in the exact garment from Image 2.

Preserve the garment's exact:
- color
- structure
- collar
- sleeves
- buttons
- pattern
- fabric
- proportions

Adapt only the garment geometry naturally to the person's body.

Do not redesign the product.
Do not alter the person's identity.
Do not change unrelated clothing unless required.

Photorealistic fashion e-commerce virtual try-on."""

PROMPT_THREE_QUARTER = """
Perform a three-quarter-body virtual try-on.

Image 1 is the person/background reference.
Image 2 is the garment design reference.

Preserve the original framing of Image 1.
Do not extend the body beyond the original frame.
Do not invent missing body parts.

Replace only the clothing regions required by the garment in Image 2.

Preserve from Image 1:
- face
- identity
- hairstyle
- body proportions
- pose
- arms and hands
- background
- camera framing

CRITICAL GARMENT PRESERVATION:
Treat Image 2 as the source of truth for garment geometry.

Preserve the garment's:
- category
- silhouette
- overall proportions
- relative length
- hemline position relative to the body
- waistline position
- neckline
- sleeve length
- fit
- volume
- cut
- layering structure
- colors
- patterns
- trims
- decorative details

Do NOT reshape, lengthen, shorten, widen, narrow, or restyle the garment
to resemble the clothing originally worn in Image 1.

The original clothes in Image 1 must not influence the new garment's
length, silhouette, or proportions.

Fit the garment naturally to the person's body while preserving the
design geometry of Image 2.

If the garment from Image 2 reveals body regions that were previously
covered by the original clothing, reconstruct only those newly visible
body regions in a realistic and anatomically consistent way.

Do not extend the image canvas.
Do not invent body parts outside the existing frame.

Priority order:
1. preserve identity and pose
2. preserve garment design and proportions from Image 2
3. maintain realistic body anatomy
4. preserve background and framing
"""

PROMPT_UPPER_BODY = """Perform an upper-body virtual try-on.

Image 1 does not contain a complete full-body view.

Do not generate or invent a full body.

Preserve the original crop and framing.

Replace only the upper-body clothing with the exact garment from Image 2.

Preserve:
- face
- identity
- hairstyle
- shoulders
- arms
- torso proportions
- pose
- background

Do not modify unrelated lower-body regions."""

PROMPT_FACE_ONLY = """Use Image 1 as the facial identity reference.

Create a realistic upper-body fashion portrait of the same person wearing the exact garment from Image 2.

Preserve:
- facial identity
- hairstyle
- skin tone

Because Image 1 contains only a face/head crop, generate a natural upper-body fashion portrait.

Do not claim to preserve the original body proportions.

Preserve the garment as accurately as possible."""


class TryOnPromptBuilder:
    @staticmethod
    def get_prompt_version() -> str:
        return PROMPT_VERSION

    @staticmethod
    def build_prompt(
        visibility_flag: VisibilityFlag,
        metadata: Optional[GarmentMetadata] = None,
    ) -> str:
        if visibility_flag == VisibilityFlag.FULL_BODY:
            base_prompt = PROMPT_FULL_BODY
        elif visibility_flag == VisibilityFlag.THREE_QUARTER:
            base_prompt = PROMPT_THREE_QUARTER
        elif visibility_flag == VisibilityFlag.UPPER_BODY:
            base_prompt = PROMPT_UPPER_BODY
        elif visibility_flag == VisibilityFlag.FACE_ONLY:
            base_prompt = PROMPT_FACE_ONLY
        else:
            # Fallback for unexpected flags
            base_prompt = PROMPT_UPPER_BODY

        # Add garment specific context if available
        details = []
        if metadata:
            if metadata.garment_type:
                details.append(f"Garment item: {metadata.garment_type}")
            if metadata.primary_color:
                details.append(f"Color: {metadata.primary_color}")
            if metadata.pattern:
                details.append(f"Pattern: {metadata.pattern}")

        if details:
            extra_ctx = "\n\nAdditional Garment Context:\n" + "\n".join(f"- {d}" for d in details)
            return base_prompt + extra_ctx

        return base_prompt
