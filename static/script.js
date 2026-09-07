/**
 * Sahulat AI — Frontend JavaScript
 * Handles chat interaction, voice input (Web Speech API), and browser text-to-speech.
 */

(function () {
    "use strict";

    // -----------------------------------------------------------------------
    // DOM references
    // -----------------------------------------------------------------------
    const chatBox       = document.getElementById("chatBox");
    const messageInput  = document.getElementById("messageInput");
    const sendBtn       = document.getElementById("sendBtn");
    const micBtn        = document.getElementById("micBtn");
    const langSelect    = document.getElementById("langSelect");
    const loadingSpinner = document.getElementById("loadingSpinner");
    const typingIndicator = document.getElementById("typingIndicator");
    const micStatus     = document.getElementById("micStatus");
    const micStatusText = document.getElementById("micStatusText");

    // Guard: script only runs on the chat page.
    if (!chatBox) return;

    let isWaiting = false;      // True while a request is in-flight.
    let recognition = null;     // SpeechRecognition instance.
    let isSpeaking = false;     // True while TTS is active.
    let currentSpeakBtn = null; // Button associated with current speech.

    // -----------------------------------------------------------------------
    // Utility: scroll chat to bottom
    // -----------------------------------------------------------------------
    function scrollToBottom() {
        const scrollArea = document.querySelector(".sa-chat-scroll-area");
        if (scrollArea) {
            scrollArea.scrollTop = scrollArea.scrollHeight;
        }
    }

    // -----------------------------------------------------------------------
    // Append a user message bubble (right-aligned)
    // -----------------------------------------------------------------------
    function appendUserMessage(text) {
        const wrapper = document.createElement("div");
        wrapper.className = "sa-message mb-3";
        wrapper.innerHTML = `
            <div class="d-flex align-items-start gap-2 justify-content-end">
                <div style="max-width: 85%;">
                    <div class="sa-bubble sa-bubble-user">${escapeHtml(text)}</div>
                    <small class="text-muted d-block mt-1 text-end" style="font-size: 0.7rem;">You · ${formatTime()}</small>
                </div>
                <div class="sa-avatar-user flex-shrink-0">You</div>
            </div>
        `;
        chatBox.appendChild(wrapper);
        scrollToBottom();
    }

    // -----------------------------------------------------------------------
    // Append an AI message bubble (left-aligned) with speak button
    // -----------------------------------------------------------------------
    function appendAiMessage(text, language) {
        const wrapper = document.createElement("div");
        wrapper.className = "sa-message sa-ai-message mb-3";

        const bubbleClass = language === "ur" ? "sa-bubble sa-bubble-ai urdu-text" : "sa-bubble sa-bubble-ai";

        wrapper.innerHTML = `
            <div class="d-flex align-items-start gap-3">
                <div class="sa-avatar-ai flex-shrink-0">🤖</div>
                <div class="flex-grow-1" style="max-width: 85%;">
                    <div class="${bubbleClass}">
                        ${formatAiResponse(text)}
                    </div>
                    <div class="d-flex align-items-center gap-2 mt-2">
                        <button class="btn btn-sm sa-speak-btn" title="Read aloud">
                            <i class="bi bi-volume-up"></i> Listen
                        </button>
                        <small class="text-muted" style="font-size: 0.7rem;">Sahulat AI · ${formatTime()}</small>
                    </div>
                </div>
            </div>
        `;
        chatBox.appendChild(wrapper);

        // Wire the speak button
        const speakBtn = wrapper.querySelector(".sa-speak-btn");
        speakBtn.addEventListener("click", () => speakText(text, language, speakBtn));

        scrollToBottom();
    }

    // -----------------------------------------------------------------------
    // Append an error message
    // -----------------------------------------------------------------------
    function appendError(message) {
        const wrapper = document.createElement("div");
        wrapper.className = "sa-message mb-3";
        wrapper.innerHTML = `
            <div class="d-flex justify-content-center">
                <div class="alert alert-warning small mb-0 d-flex align-items-center gap-2" role="alert">
                    <i class="bi bi-exclamation-triangle-fill"></i>
                    <span>${escapeHtml(message)}</span>
                </div>
            </div>
        `;
        chatBox.appendChild(wrapper);
        scrollToBottom();
    }

    // -----------------------------------------------------------------------
    // Format AI response (basic markdown-like formatting)
    // -----------------------------------------------------------------------
    function formatAiResponse(text) {
        // Escape first
        let safe = escapeHtml(text);
        // Bold: **text**
        safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        // Italic: *text*
        safe = safe.replace(/\*(.+?)\*/g, "<em>$1</em>");
        // Numbered lists: add subtle styling
        safe = safe.replace(/^(\d+\.\s.+)$/gm, '<div class="sa-list-item">$1</div>');
        // Line breaks preserved
        safe = safe.replace(/\n/g, "<br>");
        return safe;
    }

    // -----------------------------------------------------------------------
    // HTML escape helper
    // -----------------------------------------------------------------------
    function escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    // -----------------------------------------------------------------------
    // Format current time (HH:MM)
    // -----------------------------------------------------------------------
    function formatTime() {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    // -----------------------------------------------------------------------
    // Show / hide loading and typing indicators
    // -----------------------------------------------------------------------
    function showLoading() {
        if (typingIndicator) typingIndicator.classList.remove("d-none");
        if (loadingSpinner) loadingSpinner.classList.add("d-none");
        scrollToBottom();
    }

    function hideLoading() {
        if (typingIndicator) typingIndicator.classList.add("d-none");
        if (loadingSpinner) loadingSpinner.classList.add("d-none");
    }

    // -----------------------------------------------------------------------
    // Send a message to the backend
    // -----------------------------------------------------------------------
    async function sendMessage(text) {
        if (!text.trim() || isWaiting) return;

        const language = langSelect ? langSelect.value : "en";

        appendUserMessage(text);
        messageInput.value = "";
        messageInput.style.height = "auto";

        isWaiting = true;
        sendBtn.disabled = true;
        showLoading();

        try {
            const response = await fetch("/ask", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text, language: language }),
            });

            const data = await response.json();

            if (data.success && data.response) {
                appendAiMessage(data.response, data.language || language);
            } else {
                appendError(data.error || "Something went wrong. Please try again.");
            }
        } catch (err) {
            console.error("Network error:", err);
            appendError("Unable to reach Sahulat AI. Please check your connection and try again.");
        } finally {
            hideLoading();
            isWaiting = false;
            sendBtn.disabled = false;
            messageInput.focus();
        }
    }

    // -----------------------------------------------------------------------
    // Event: Send button click
    // -----------------------------------------------------------------------
    sendBtn.addEventListener("click", () => {
        sendMessage(messageInput.value.trim());
    });

    // -----------------------------------------------------------------------
    // Event: Enter key to send (Shift+Enter for newline)
    // -----------------------------------------------------------------------
    messageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(messageInput.value.trim());
        }
    });

    // -----------------------------------------------------------------------
    // Auto-resize textarea
    // -----------------------------------------------------------------------
    messageInput.addEventListener("input", () => {
        messageInput.style.height = "auto";
        const maxH = 130;
        messageInput.style.height = Math.min(messageInput.scrollHeight, maxH) + "px";
    });

    // -----------------------------------------------------------------------
    // Event: Service shortcut buttons
    // -----------------------------------------------------------------------
    document.querySelectorAll(".sa-shortcut-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const question = btn.getAttribute("data-question");
            if (question) {
                // Auto-set language to English for shortcut questions.
                if (langSelect) langSelect.value = "en";
                sendMessage(question);
            }
        });
    });

    // -----------------------------------------------------------------------
    // Text-to-Speech — Browser-only (Web Speech API)
    // -----------------------------------------------------------------------
    function stopSpeaking() {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        isSpeaking = false;
        resetSpeakButton();
    }

    function resetSpeakButton() {
        if (currentSpeakBtn) {
            currentSpeakBtn.innerHTML = '<i class="bi bi-volume-up"></i> Listen';
            currentSpeakBtn.classList.remove("sa-stop-btn");
            currentSpeakBtn.classList.add("sa-speak-btn");
            currentSpeakBtn.title = "Read aloud";
            currentSpeakBtn = null;
        }
    }

    function setButtonToStop(btn) {
        btn.innerHTML = '<i class="bi bi-stop-fill"></i> Stop';
        btn.classList.remove("sa-speak-btn");
        btn.classList.add("sa-stop-btn");
        btn.title = "Stop speaking";
        currentSpeakBtn = btn;
    }

    // -----------------------------------------------------------------------
    // Clean AI markdown before speaking (#, -, *, etc.)
    // -----------------------------------------------------------------------
    function cleanSpeechText(text) {
        if (!text) return "";
        return text
            // Remove headings (#, ##, etc.)
            .replace(/^#{1,6}\s+/gm, "")
            // Remove bold/italic markers but keep the text
            .replace(/\*\*(.+?)\*\*/g, "$1")
            .replace(/\*(.+?)\*/g, "$1")
            .replace(/__(.+?)__/g, "$1")
            .replace(/_(.+?)_/g, "$1")
            // Remove inline code backticks
            .replace(/`(.+?)`/g, "$1")
            // Remove blockquote markers
            .replace(/^>\s*/gm, "")
            // Remove bullet/list markers at line start
            .replace(/^[-*+]\s+/gm, "")
            // Turn "1. " list markers into "1 " so TTS says the number cleanly
            .replace(/^(\d+)\.\s+/gm, "$1 ")
            // Remove images
            .replace(/!\[.*?\]\(.*?\)/g, "")
            // Keep only the label for links
            .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
            // Remove horizontal rules
            .replace(/^[=-]{3,}\s*$/gm, "")
            // Collapse multiple line breaks and extra spaces
            .replace(/\n{2,}/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function speakText(text, language, btn) {
        // If the same button is clicked while speaking, stop it.
        if (currentSpeakBtn === btn && isSpeaking) {
            stopSpeaking();
            return;
        }

        // Stop any currently active speech first.
        stopSpeaking();

        // Strip markdown so the voice does not read "hash", "dash", "asterisk", etc.
        const speechText = cleanSpeechText(text);
        if (!speechText) {
            showMicStatus("Nothing to speak.", true);
            return;
        }

        // Use the browser's built-in text-to-speech.
        speakWithBrowserTTS(speechText, language, btn);
    }

    function getVoices() {
        if (!window.speechSynthesis) return [];
        return window.speechSynthesis.getVoices();
    }

    function findBestVoice(language) {
        const voices = getVoices();
        if (voices.length === 0) return null;

        if (language === "ur") {
            const priorities = ["ur-PK", "ur-IN", "ur"];
            for (const prefix of priorities) {
                const match = voices.find((v) =>
                    v.lang.toLowerCase().startsWith(prefix.toLowerCase())
                );
                if (match) return match;
            }
            return voices.find((v) =>
                /urdu/i.test(v.name) || /urdu/i.test(v.lang)
            );
        }

        return (
            voices.find((v) => v.lang.toLowerCase().startsWith("en-us")) ||
            voices.find((v) => v.lang.toLowerCase().startsWith("en"))
        );
    }

    function speakWithBrowserTTS(text, language, btn) {
        if (!window.speechSynthesis) {
            showMicStatus("Sorry, your browser does not support text-to-speech.", true);
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = language === "ur" ? "ur-PK" : "en-US";
        utterance.rate = language === "ur" ? 0.82 : 0.95;
        utterance.pitch = 1;

        const voice = findBestVoice(language);
        if (voice) utterance.voice = voice;

        utterance.onstart = () => {
            isSpeaking = true;
            setButtonToStop(btn);
        };

        utterance.onend = () => {
            isSpeaking = false;
            resetSpeakButton();
        };

        utterance.onerror = () => {
            isSpeaking = false;
            resetSpeakButton();
            showMicStatus("Text-to-speech failed. Your device may not have a voice for this language.", true);
        };

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    }

    if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = () => {
            getVoices();
        };
    }

    // -----------------------------------------------------------------------
    // Event: Existing speak buttons (welcome message)
    // -----------------------------------------------------------------------
    document.querySelectorAll(".sa-speak-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const text = btn.getAttribute("data-text");
            if (text) speakText(text, langSelect ? langSelect.value : "en", btn);
        });
    });

    // -----------------------------------------------------------------------
    // Speech Recognition (Web Speech API)
    // -----------------------------------------------------------------------
    function initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            micBtn.disabled = true;
            micBtn.title = "Speech recognition is not supported in this browser.";
            showMicStatus("Speech recognition is not supported in this browser. Try Chrome or Edge.", true);
            return;
        }

        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            micBtn.classList.add("recording");
            micBtn.innerHTML = '<i class="bi bi-mic-mute-fill"></i>';
            showMicStatus("Listening… speak now", false);
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            messageInput.value = transcript;
            messageInput.style.height = "auto";
            messageInput.style.height = Math.min(messageInput.scrollHeight, 130) + "px";
            messageInput.focus();
            hideMicStatus();
        };

        recognition.onerror = (event) => {
            console.warn("Speech recognition error:", event.error);
            if (event.error === "not-allowed") {
                showMicStatus("Microphone permission denied. Please allow microphone access.", true);
            } else if (event.error === "no-speech") {
                showMicStatus("No speech detected. Please try again.", false);
            } else if (event.error === "audio-capture") {
                showMicStatus("No microphone found. Please connect a microphone.", true);
            } else {
                showMicStatus("Speech recognition error. Please try again.", false);
            }
            resetMicButton();
        };

        recognition.onend = () => {
            resetMicButton();
        };
    }

    function resetMicButton() {
        micBtn.classList.remove("recording");
        micBtn.innerHTML = '<i class="bi bi-mic-fill"></i>';
    }

    function showMicStatus(msg, isError) {
        micStatus.classList.remove("d-none");
        micStatus.classList.toggle("text-danger", isError);
        micStatus.classList.toggle("text-success", !isError);
        micStatusText.textContent = msg;
    }

    function hideMicStatus() {
        micStatus.classList.add("d-none");
    }

    // -----------------------------------------------------------------------
    // Event: Microphone button toggle
    // -----------------------------------------------------------------------
    micBtn.addEventListener("click", () => {
        if (!recognition) {
            showMicStatus("Speech recognition is not available.", true);
            return;
        }

        const language = langSelect ? langSelect.value : "en";
        recognition.lang = language === "ur" ? "ur-PK" : "en-US";

        try {
            recognition.start();
        } catch (err) {
            // Already started — abort and restart
            recognition.abort();
            setTimeout(() => {
                try { recognition.start(); } catch (e) { console.warn(e); }
            }, 200);
        }
    });

    // -----------------------------------------------------------------------
    // Initialise
    // -----------------------------------------------------------------------
    initSpeechRecognition();
    messageInput.focus();

})();
