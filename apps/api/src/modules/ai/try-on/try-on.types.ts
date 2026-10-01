export type TryOnStatus =
  | "CREATED"
  | "QUEUED"
  | "CLASSIFYING_USER"
  | "USER_CLASSIFIED"
  | "PREPARING_GARMENT"
  | "SUBMITTING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";

export type VisibilityFlag =
  | "FACE_ONLY"
  | "UPPER_BODY"
  | "THREE_QUARTER"
  | "FULL_BODY"
  | "INVALID";

export type AIAssetType = "USER_INPUT" | "GARMENT_EXTRACTED" | "TRYON_RESULT";

export interface GarmentMetadata {
  category?: string;
  garment_type?: string;
  primary_color?: string;
  sleeve_length?: string;
  neckline?: string;
  length?: string;
  pattern?: string;
  has_buttons?: boolean;
  [key: string]: unknown;
}

export interface AiWorkerGenerateRequest {
  job_id: string;
  user_image_path?: string;
  user_image_url?: string;
  product_image_path?: string;
  product_image_url?: string;
  variant_id: string;
  visibility_flag?: VisibilityFlag | null;
  cached_garment_path?: string | null;
  cached_garment_url?: string | null;
  cached_garment_metadata?: GarmentMetadata | null;
}

export interface AiWorkerGenerateResponse {
  job_id: string;
  status: "completed" | "failed";
  visibility_flag: VisibilityFlag;
  classifier?: {
    person_count: number;
    face_visible: boolean;
    upper_body_visible: boolean;
    lower_body_visible: boolean;
    feet_visible: boolean;
    occlusion_level: string;
    confidence: number;
  };
  garment?: {
    reused_cache: boolean;
    storage_key?: string;
    output_path?: string;
    sha256?: string;
    metadata?: GarmentMetadata;
  };
  result_storage_key?: string;
  result_path?: string;
  result_url?: string;
  prompt_version?: string;
  error_code?: string;
  error_message?: string;
}

export interface TryOnJobPayload {
  jobId: string;
}
