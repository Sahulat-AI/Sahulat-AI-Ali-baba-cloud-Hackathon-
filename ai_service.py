import logging
import os

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are Sahulat AI, a bilingual Pakistani government services assistant.
Help citizens understand government procedures in simple Urdu or English.
Give clear step-by-step instructions.
Explain required documents, fees, processing steps, and where applicable, the relevant government office or online portal.
Do not invent information. When information is unavailable or uncertain, clearly say so.
Match the language used by the user.
"""

# Models to try in order if the configured model is unavailable.
FALLBACK_MODELS = [
    "gemini-3.6-flash",
    "gemini-2.5-flash",
    "gemini-1.5-flash",
]


def _get_api_key():
    """Return the Gemini API key from environment variables."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "AI configuration error: GEMINI_API_KEY environment variable is not set. "
            "Please configure your .env file with a valid Google Gemini API key."
        )
    return api_key


def _get_model():
    """Return the preferred Gemini model identifier from environment variables."""
    return os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")


def _call_model(client, model: str, question: str, lang_hint: str):
    """Call a single Gemini model and return its text response."""
    logger.info("Trying Gemini model '%s'", model)

    response = client.models.generate_content(
        model=model,
        contents=question,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT + "\n" + lang_hint,
            temperature=0.4,
            max_output_tokens=2048,
        ),
    )

    answer = response.text
    if not answer:
        raise RuntimeError("AI service returned an empty response.")

    return answer.strip()


def ask(question: str, language: str = "en") -> str:
    """
    Send a question to Google Gemini and return the AI response.

    Tries the configured model first, then falls back through FALLBACK_MODELS
    if the model is unavailable due to high demand or other transient issues.

    Parameters
    ----------
    question : str
        The user's question about Pakistani government services.
    language : str
        Language hint — "ur" for Urdu, "en" for English.

    Returns
    -------
    str
        The AI-generated response text.

    Raises
    ------
    RuntimeError
        If the API key is missing or all model calls fail.
    """
    api_key = _get_api_key()
    preferred_model = _get_model()

    if language == "ur":
        lang_hint = (
            "You MUST reply entirely in simple, clear Urdu (Pakistani Urdu). "
            "Do not use English words unless they are commonly used in Urdu."
        )
    else:
        lang_hint = "Reply in simple English."

    client = genai.Client(api_key=api_key)

    # Build the ordered list of models to try (preferred first, then fallbacks).
    models_to_try = [preferred_model]
    for fallback in FALLBACK_MODELS:
        if fallback not in models_to_try:
            models_to_try.append(fallback)

    last_error = None

    for model in models_to_try:
        try:
            answer = _call_model(client, model, question, lang_hint)
            logger.info("Successfully used model '%s'", model)
            return answer
        except Exception as exc:
            logger.warning("Model '%s' failed: %s", model, exc)
            last_error = exc
            # Continue to the next fallback model.

    # All models failed.
    logger.error("All Gemini models failed. Last error: %s", last_error)
    raise RuntimeError(f"AI service call failed: {last_error}") from last_error
