UPDATE "collections"
SET "gallery_images" = ("gallery_images" #>> '{}')::jsonb,
	"updated_at" = now()
WHERE jsonb_typeof("gallery_images") = 'string'
	AND "slug" IN (
		'noir-de-vin',
		'fall-in-style',
		'femme-libre',
		'verdant-muse',
		'elevated-essentials',
		'coastal-rhythm',
		'soft-pillars',
		'strike-a-style',
		'sunkissed-era'
	);
