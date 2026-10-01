from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "ÉLANE AI Worker"
    app_env: str = "development"
    port: int = 8000
    host: str = "0.0.0.0"

    # Mock mode allows development and tests to run without active credentials
    ai_mock_mode: bool = False

    # Supabase Storage (AI Bucket)
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_ai_bucket: str = "AI"

    # OpenAI Compatible Vision Classifier
    openai_api_key: str = ""
    openai_base_url: str = ""
    openai_vision_model: str = "gp-5.6-sol-max"

    # Kie.ai (GPT Image 2.5 Sunburst) Virtual Try-On Provider
    kie_api_key: str = ""
    kie_base_url: str = "https://api.kie.ai"
    kie_model: str = "gpt-image-2-5-sunburst-image-to-image"
    kie_polling_interval_seconds: float = 3.0
    kie_timeout_seconds: int = 0  # 0 = unlimited polling until completion
    tryon_provider: str = "kie"


settings = Settings()
