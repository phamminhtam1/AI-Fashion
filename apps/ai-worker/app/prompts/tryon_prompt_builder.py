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

REFERENCE ROLES:
- Image 1 = person, identity, pose, body, framing, and background reference.
- Image 2 = garment design and garment shape reference.

PRESERVE FROM IMAGE 1:
- face and identity
- hairstyle
- body proportions
- pose
- arms and hands
- background
- camera framing

GARMENT TRANSFER:
Replace the original clothing in Image 1 with the garment from Image 2.

Use Image 2 as the source of truth for:
- garment category
- construction
- silhouette
- length
- waist placement
- neckline
- sleeve length
- fit
- volume
- cut
- materials
- color
- seams
- trims
- decorative details

CRITICAL SHAPE PRESERVATION:
Preserve the garment’s contour and width progression across the body.

Match the garment’s relative width and fit at:
- bust
- waist
- high hip
- full hip
- upper thigh
- knee
- calf
- hem

Preserve whether each garment area is:
- body-hugging
- slim-fit
- straight
- softly relaxed
- flared
- voluminous

Do not reinterpret a fitted garment as a looser garment.
Do not reinterpret a straight garment as a flared garment.
Do not add extra drape, flare, or outward volume.

For lower-body garments, preserve the hem circumference relative to the hip and knee width from Image 2.

Do not use the original clothing silhouette in Image 1 as a guide.

BODY RECONSTRUCTION:
If the new garment exposes body regions that were covered in Image 1,
reconstruct those newly visible regions realistically and anatomically.

Do not change the person's body shape to fit the garment.
Fit the garment to the body, not the body to the garment.

FRAMING:
Preserve the original framing of Image 1.
Do not extend the canvas.
Do not invent body parts outside the frame.

EDIT SCOPE:
Modify only the pixels necessary to render:
- the new garment
- natural garment-body interaction
- newly exposed body regions

Keep unrelated regions unchanged.

PRIORITY:
1. identity and pose
2. garment shape fidelity
3. garment design fidelity
4. realistic anatomy
5. background and framing
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
