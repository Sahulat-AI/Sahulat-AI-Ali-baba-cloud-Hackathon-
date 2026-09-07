import os
import logging

from dotenv import load_dotenv
from flask import Flask, render_template, request, jsonify

import ai_service

load_dotenv()

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Flask application
# ---------------------------------------------------------------------------
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "sahulat-ai-dev-secret-key")


# ---------------------------------------------------------------------------
# Routes — Pages
# ---------------------------------------------------------------------------

@app.route("/")
def home():
    """Render the landing page."""
    return render_template("home.html")


@app.route("/chat")
def chat():
    """Render the chat interface."""
    return render_template("chat.html")


@app.route("/about")
def about():
    """Render the about page."""
    return render_template("about.html")


# ---------------------------------------------------------------------------
# Routes — API
# ---------------------------------------------------------------------------

@app.route("/ask", methods=["POST"])
def ask():
    """
    Receive a question from the chat interface and return the AI response.

    Expected JSON body:
        { "message": "...", "language": "en" | "ur" }

    Response JSON:
        { "success": true, "response": "...", "language": "..." }
    """
    # --- Validate input -------------------------------------------------------
    data = request.get_json(silent=True)
    if not data or not data.get("message", "").strip():
        return jsonify({
            "success": False,
            "error": "No message provided. Please type or speak a question.",
        }), 400

    message = data["message"].strip()
    language = data.get("language", "en").strip()
    if language not in ("en", "ur"):
        language = "en"

    # --- Query AI -------------------------------------------------------------
    try:
        ai_response = ai_service.ask(message, language)
    except RuntimeError as exc:
        logger.error("AI service error: %s", exc)
        return jsonify({
            "success": False,
            "error": f"The AI service is currently unavailable: {exc}",
        }), 503

    return jsonify({
        "success": True,
        "response": ai_response,
        "language": language,
    })


# ---------------------------------------------------------------------------
# Error handlers
# ---------------------------------------------------------------------------

@app.errorhandler(404)
def not_found(_error):
    return render_template("base.html", error="Page not found."), 404


@app.errorhandler(500)
def server_error(_error):
    return render_template("base.html", error="Internal server error."), 500


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "True").lower() in ("true", "1", "yes")
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=debug)
