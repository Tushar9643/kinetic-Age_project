/**
 * InterviewAI Coach - Main JavaScript
 * Handles chat interactions, AI responses, and UI updates
 *
 * SECURE AI SETUP:
 * The OpenAI API key is NOT set anywhere in this file or any frontend file.
 * It must be set as an environment variable named OPENAI_API_KEY on your
 * Netlify site (Site settings → Environment variables), where it's read
 * only by netlify/functions/interview-feedback.js on the server side.
 * The browser only ever talks to that function, never to OpenAI directly.
 */

// ==================== Configuration ====================

const CONFIG = {
    // The API key is NEVER stored here — it lives server-side only, as an
    // environment variable on the Netlify Function at FUNCTION_ENDPOINT.
    // See netlify/functions/interview-feedback.js
    FUNCTION_ENDPOINT: '/.netlify/functions/interview-feedback',
    
    // Fallback interview questions if API is not available
    INTERVIEW_QUESTIONS: [
        "Tell me about a time you faced a difficult challenge and how you overcame it.",
        "What are your greatest strengths and how do they apply to this role?",
        "Describe a situation where you had to work in a team. What was your role?",
        "Tell me about a project you're proud of. What made it successful?",
        "How do you handle criticism or feedback?",
        "What motivates you in your work?",
        "Describe a time you failed. What did you learn?",
        "How do you prioritize tasks when you have multiple deadlines?",
        "Tell me about a time you had to learn something new quickly.",
        "What makes you a good fit for this position?"
    ],

    // Topic-triggered follow-ups for the rule-based fallback mode, so the
    // "next question" is at least loosely connected to what the candidate
    // just talked about, instead of a fully random pick.
    TOPIC_FOLLOWUPS: [
        { keywords: ['team', 'colleague', 'group'], question: "You mentioned working with others — what was the hardest part of coordinating with your team?" },
        { keywords: ['project'], question: "What was the biggest risk or unknown in that project, and how did you handle it?" },
        { keywords: ['fail', 'mistake', 'wrong'], question: "Looking back, what would you do differently if you faced that same situation again?" },
        { keywords: ['lead', 'manage', 'leadership'], question: "How did you get buy-in from people who didn't report to you?" },
        { keywords: ['deadline', 'pressure', 'stress'], question: "How do you decide what to cut when everything feels urgent?" },
        { keywords: ['learn', 'new skill', 'quickly'], question: "What's your process for getting up to speed on something unfamiliar?" },
        { keywords: ['customer', 'client', 'user'], question: "How did you know the solution actually solved the customer's problem?" }
    ]
};

// Tracks whether the server has a live OpenAI key configured. Unknown until
// checkAIHealth() runs (there's no way to know this from the browser alone
// anymore, since the key isn't in client code — that's the whole point).
let aiHealthChecked = false;
let aiConfiguredOnServer = false;

function isAIConfigured() {
    return aiHealthChecked && aiConfiguredOnServer;
}

/**
 * Ask the serverless function whether a live OpenAI key is set server-side.
 * Never reveals the key itself — just a boolean. Fails safe (assumes not
 * configured) if the function isn't reachable, e.g. running index.html
 * directly from disk instead of via `netlify dev` / a Netlify deployment.
 */
async function checkAIHealth() {
    try {
        const res = await fetch(CONFIG.FUNCTION_ENDPOINT, { method: 'GET' });
        if (!res.ok) throw new Error('health check failed');
        const data = await res.json();
        aiConfiguredOnServer = Boolean(data.configured);
    } catch (err) {
        console.warn('AI health check failed (falling back to Practice Mode):', err.message);
        aiConfiguredOnServer = false;
    } finally {
        aiHealthChecked = true;
    }
    return isAIConfigured();
}

// ==================== State Management ====================

const state = {
    currentPage: 'landing',
    messages: [],
    questionCount: 1,
    isTyping: false,
    feedbackGiven: false,
    sessionStartTime: null
};

// ==================== Analytics Tracking ====================

const analytics = {
    init() {
        if (!localStorage.getItem('interviewAI_analytics')) {
            localStorage.setItem('interviewAI_analytics', JSON.stringify({
                totalSessions: 0,
                totalQuestions: 0,
                totalTimeSpent: 0,
                lastVisit: null
            }));
        }
    },
    
    startSession() {
        state.sessionStartTime = Date.now();
        const data = this.getData();
        data.totalSessions++;
        data.lastVisit = new Date().toISOString();
        this.saveData(data);
    },
    
    trackQuestion() {
        const data = this.getData();
        data.totalQuestions++;
        this.saveData(data);
    },
    
    endSession() {
        if (state.sessionStartTime) {
            const timeSpent = Math.floor((Date.now() - state.sessionStartTime) / 1000);
            const data = this.getData();
            data.totalTimeSpent += timeSpent;
            this.saveData(data);
        }
    },
    
    getData() {
        return JSON.parse(localStorage.getItem('interviewAI_analytics') || '{}');
    },
    
    saveData(data) {
        localStorage.setItem('interviewAI_analytics', JSON.stringify(data));
    }
};

// ==================== Feedback System ====================

const feedback = {
    responses: [],
    
    init() {
        if (!localStorage.getItem('interviewAI_feedback')) {
            localStorage.setItem('interviewAI_feedback', JSON.stringify([]));
        }
    },
    
    save(feedbackData) {
        const allFeedback = JSON.parse(localStorage.getItem('interviewAI_feedback') || '[]');
        allFeedback.push({
            ...feedbackData,
            timestamp: new Date().toISOString(),
            questionsPracticed: state.questionCount
        });
        localStorage.setItem('interviewAI_feedback', JSON.stringify(allFeedback));
    },
    
    getAll() {
        return JSON.parse(localStorage.getItem('interviewAI_feedback') || '[]');
    }
};

// ==================== DOM Elements ====================

const elements = {
    landingPage: document.getElementById('landingPage'),
    chatPage: document.getElementById('chatPage'),
    startBtn: document.getElementById('startBtn'),
    chatMessages: document.getElementById('chatMessages'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    micBtn: document.getElementById('micBtn'),
    voiceStatus: document.getElementById('voiceStatus'),
    questionCount: document.getElementById('questionCount'),
    aiAvatar: document.getElementById('aiAvatar'),
    thinkingDots: document.getElementById('thinkingDots'),
    avatarCircle: document.getElementById('avatarCircle'),
    avatarEmoji: document.getElementById('avatarEmoji'),
    avatarStatus: document.getElementById('avatarStatus'),
    shareBtn: document.getElementById('shareBtn'),
    feedbackModal: document.getElementById('feedbackModal'),
    thankYouModal: document.getElementById('thankYouModal'),
    closeModal: document.getElementById('closeModal'),
    closeThankYou: document.getElementById('closeThankYou'),
    submitFeedback: document.getElementById('submitFeedback'),
    skipFeedback: document.getElementById('skipFeedback'),
    continueBtn: document.getElementById('continueBtn'),
    modalQuestionCount: document.getElementById('modalQuestionCount'),
    feedbackText: document.getElementById('feedbackText'),
    aiModeBadge: document.getElementById('aiModeBadge'),
    ratingButtons: null, // Will be set in init
    stars: null // Will be set in init
};

/**
 * Keep the "Practice Mode" / "AI-Powered" badge honest about how the
 * last reply was actually generated — required for transparency.
 */
function updateModeBadge(mode) {
    if (!elements.aiModeBadge) return;
    if (mode === 'ai') {
        elements.aiModeBadge.textContent = 'AI-Powered';
        elements.aiModeBadge.classList.add('mode-ai');
    } else {
        elements.aiModeBadge.textContent = 'Practice Mode';
        elements.aiModeBadge.classList.remove('mode-ai');
    }
}

// ==================== Utility Functions ====================

/**
 * Format time to HH:MM AM/PM
 */
function formatTime(date) {
    return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    });
}

/**
 * Scroll chat to bottom smoothly
 */
function scrollToBottom() {
    elements.chatMessages.scrollTo({
        top: elements.chatMessages.scrollHeight,
        behavior: 'smooth'
    });
}

/**
 * Avatar state controller — this is what makes the avatar a MEANINGFUL
 * part of the experience instead of a static decoration. Every state
 * changes the emoji, the status text under the avatar's name, the
 * circle's color/animation, and gives it a little pulse.
 */
const AVATAR_STATES = {
    idle:      { emoji: '🎯', text: 'Here to help you ace your interview', cls: '' },
    asking:    { emoji: '🗣️', text: 'Go ahead, take your time...',         cls: '' },
    listening: { emoji: '👂', text: "I'm listening...",                    cls: 'state-listening' },
    thinking:  { emoji: '🤔', text: 'Analyzing your answer...',            cls: 'state-thinking' },
    positive:  { emoji: '😊', text: 'Good answer!',                        cls: 'state-positive' },
    excellent: { emoji: '🎉', text: 'Excellent answer!',                   cls: 'state-excellent' },
    improve:   { emoji: '💡', text: "Let's sharpen that up a bit",         cls: 'state-improve' }
};

function updateAvatar(stateName, customText = '') {
    const s = AVATAR_STATES[stateName] || AVATAR_STATES.idle;

    elements.avatarEmoji.textContent = s.emoji;
    elements.avatarStatus.textContent = customText || s.text;

    // Remove all state classes, then apply the current one
    Object.values(AVATAR_STATES).forEach(v => {
        if (v.cls) elements.avatarCircle.classList.remove(v.cls);
    });
    if (s.cls) elements.avatarCircle.classList.add(s.cls);

    // Thinking dots + spin only during "thinking"
    if (stateName === 'thinking') {
        elements.thinkingDots.classList.remove('hidden');
        elements.avatarCircle.classList.add('thinking');
    } else {
        elements.thinkingDots.classList.add('hidden');
        elements.avatarCircle.classList.remove('thinking');
    }

    // Little pulse "reaction" every time the state changes
    elements.avatarCircle.classList.remove('avatar-pulse');
    void elements.avatarCircle.offsetWidth; // restart animation
    elements.avatarCircle.classList.add('avatar-pulse');
}

/**
 * Lightweight heuristic answer analysis — used to decide which reaction
 * the avatar shows. This runs even in fallback (no API key) mode so the
 * avatar's reaction actually reflects the answer, not a fixed script.
 * (When a real OpenAI key is added, this can be replaced by scores
 * returned from the model instead of this heuristic.)
 */
function analyzeAnswer(answer) {
    const text = answer.toLowerCase();
    const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;

    let score = 5; // baseline out of 10

    // Length signal — too short answers rarely show depth
    if (wordCount < 15) score -= 2;
    else if (wordCount >= 15 && wordCount <= 120) score += 1;
    else if (wordCount > 200) score -= 1; // rambling

    // STAR-method / structure signals
    const starHints = ['situation', 'task', 'action', 'result', 'because', 'so that', 'as a result'];
    const starHits = starHints.filter(w => text.includes(w)).length;
    score += Math.min(starHits, 3);

    // Specificity signals — numbers, metrics, named tools/outcomes
    if (/\d/.test(text)) score += 1;
    if (/(percent|%|users|revenue|team of|reduced|increased|improved)/.test(text)) score += 1;

    score = Math.max(1, Math.min(10, score));

    let level;
    if (score >= 8) level = 'excellent';
    else if (score >= 6) level = 'positive';
    else level = 'improve';

    return { score, level };
}

/**
 * Show/hide thinking animation (kept for compatibility, now delegates
 * to updateAvatar so all state changes go through one place).
 */
function setThinking(isThinking) {
    state.isTyping = isThinking;

    if (isThinking) {
        updateAvatar('thinking');
        elements.messageInput.disabled = true;
        elements.sendBtn.disabled = true;
        if (elements.micBtn) elements.micBtn.disabled = true;
    } else {
        elements.messageInput.disabled = false;
        elements.sendBtn.disabled = false;
        if (elements.micBtn && SpeechRecognitionAPIExists()) elements.micBtn.disabled = false;
    }
}

function SpeechRecognitionAPIExists() {
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

// ==================== Message Handling ====================

/**
 * Add a message to the chat
 */
function addMessage(role, content) {
    const message = {
        role: role, // 'user' or 'assistant'
        content: content,
        timestamp: new Date()
    };
    
    state.messages.push(message);
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role === 'user' ? 'user-message' : 'ai-message'}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Convert markdown-style bold to HTML
    let formattedContent = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Split by newlines and create paragraphs
    const paragraphs = formattedContent.split('\n').filter(p => p.trim());
    paragraphs.forEach(p => {
        const para = document.createElement('p');
        para.innerHTML = p;
        contentDiv.appendChild(para);
    });
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = formatTime(message.timestamp);
    
    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(timeDiv);
    
    elements.chatMessages.appendChild(messageDiv);
    
    setTimeout(scrollToBottom, 100);
}

/**
 * Get AI response using OpenAI API.
 * Returns a structured object: { text, scores, mode }
 *   - text: formatted feedback message shown in chat (includes next question)
 *   - scores: { communication, relevance, structure, confidence, overall } out of 10
 *   - mode: 'ai' | 'fallback' — used for the transparency badge and avatar reaction
 */
async function getAIResponse(userMessage) {
    // If the server doesn't have a live key configured, use the rule-based
    // fallback (still real analysis of the answer, not fake static text)
    if (!isAIConfigured()) {
        return getFallbackResponse(userMessage);
    }

    try {
        const response = await fetch(CONFIG.FUNCTION_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answer: userMessage })
        });

        if (!response.ok) {
            throw new Error('Proxy request failed: ' + response.status);
        }

        const parsed = await response.json();

        const s = parsed.scores || {};
        const overall = Math.round(
            ((s.communication || 5) + (s.relevance || 5) + (s.structure || 5) + (s.confidence || 5)) / 4
        );

        const text = `**AI Feedback — Overall: ${overall}/10**

Communication: ${s.communication}/10 · Relevance: ${s.relevance}/10 · Structure: ${s.structure}/10 · Confidence: ${s.confidence}/10

**✅ Strengths**
${(parsed.strengths || []).map(x => `• ${x}`).join('\n')}

**💡 Improve**
${(parsed.improvements || []).map(x => `• ${x}`).join('\n')}

**Next Question:**
${parsed.followUpQuestion}`;

        return {
            text,
            scores: { ...s, overall },
            mode: 'ai'
        };

    } catch (error) {
        console.error('Error calling AI proxy, falling back:', error);
        return getFallbackResponse(userMessage);
    }
}

/**
 * Rule-based fallback: uses the real answer-analysis heuristic (analyzeAnswer)
 * instead of returning fixed static text, and picks a follow-up question that's
 * topically connected to what the candidate actually said.
 */
function getFallbackResponse(userMessage) {
    const analysis = analyzeAnswer(userMessage);
    const text = userMessage.toLowerCase();
    const wordCount = userMessage.trim().split(/\s+/).filter(Boolean).length;

    // Build strengths/improvements dynamically from the same signals used for scoring
    const strengths = [];
    const improvements = [];

    if (wordCount >= 15 && wordCount <= 200) strengths.push('Good level of detail — not too short, not rambling');
    if (/\d/.test(text) || /(percent|%|users|revenue|team of|reduced|increased|improved)/.test(text)) {
        strengths.push('You backed up your answer with specifics/metrics');
    }
    if (['situation', 'task', 'action', 'result'].some(w => text.includes(w))) {
        strengths.push('Your structure shows STAR-method thinking');
    }
    if (strengths.length === 0) strengths.push('You engaged directly with the question');

    if (wordCount < 15) improvements.push('Answer is quite short — add more context and a concrete example');
    if (wordCount > 200) improvements.push('Answer runs long — try to make your key point in fewer words');
    if (!/\d/.test(text) && !/(percent|%|users|revenue|reduced|increased|improved)/.test(text)) {
        improvements.push('Add a number or measurable outcome to make it more credible');
    }
    if (!['situation', 'task', 'action', 'result', 'because', 'so that'].some(w => text.includes(w))) {
        improvements.push('Try structuring with the STAR method (Situation, Task, Action, Result)');
    }
    if (improvements.length === 0) improvements.push('Tie the answer back explicitly to the role you\'re applying for');

    // Pick a topically relevant follow-up if one matches, else a random fresh one
    const matchedTopic = CONFIG.TOPIC_FOLLOWUPS.find(t => t.keywords.some(k => text.includes(k)));
    const followUp = matchedTopic
        ? matchedTopic.question
        : CONFIG.INTERVIEW_QUESTIONS[Math.floor(Math.random() * CONFIG.INTERVIEW_QUESTIONS.length)];

    const scores = {
        communication: analysis.score,
        relevance: analysis.score,
        structure: analysis.score,
        confidence: analysis.score,
        overall: analysis.score
    };

    const responseText = `**AI Feedback (Practice Mode) — Overall: ${analysis.score}/10**

**✅ Strengths**
${strengths.map(x => `• ${x}`).join('\n')}

**💡 Improve**
${improvements.map(x => `• ${x}`).join('\n')}

**Next Question:**
${followUp}`;

    return { text: responseText, scores, mode: 'fallback' };
}

/**
 * Handle sending a message
 */
async function sendMessage() {
    const message = elements.messageInput.value.trim();
    
    if (!message || state.isTyping) {
        return;
    }

    // If a voice recording is still active, stop it before sending
    if (typeof isRecording !== 'undefined' && isRecording && recognizer) {
        recognizer.stop();
    }
    
    // Add user message
    addMessage('user', message);
    elements.messageInput.value = '';

    // Show thinking state
    setThinking(true);

    try {
        // Simulate a slight delay for better UX
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get AI response (structured: { text, scores, mode })
        const result = await getAIResponse(message);

        // Add AI response
        addMessage('assistant', result.text);

        // Keep the transparency badge in sync with how this reply was generated
        updateModeBadge(result.mode);

        // Update question count
        state.questionCount++;
        elements.questionCount.textContent = state.questionCount;

        // Track analytics
        analytics.trackQuestion();

        // Show feedback modal after 3 questions (if not already shown)
        if (state.questionCount >= 4 && !state.feedbackGiven) {
            setTimeout(() => showFeedbackModal(), 2000);
        }

        // React with the avatar based on the (real or fallback) overall score
        const overall = result.scores.overall;
        const level = overall >= 8 ? 'excellent' : overall >= 6 ? 'positive' : 'improve';
        const reactionText = level === 'excellent'
            ? `Excellent! That scored ${overall}/10 👏`
            : level === 'positive'
                ? `Good answer — ${overall}/10. Keep going!`
                : `That's a ${overall}/10 — try adding more specifics next time.`;
        updateAvatar(level, reactionText);

        // After a moment, settle back to "asking" for the next question
        setTimeout(() => updateAvatar('asking'), 3000);

    } catch (err) {
        // Never let an unexpected error leave the app stuck — always recover
        console.error('sendMessage failed:', err);
        addMessage('assistant', "Sorry, something went wrong processing that answer. Please try sending it again.");
        updateAvatar('idle');
    } finally {
        // ALWAYS re-enable input, even if an error was thrown above
        state.isTyping = false;
        elements.messageInput.disabled = false;
        elements.sendBtn.disabled = false;
        elements.messageInput.focus();
    }
}

// ==================== Modal Functions ====================

/**
 * Show feedback modal
 */
function showFeedbackModal() {
    elements.modalQuestionCount.textContent = state.questionCount - 1;
    elements.feedbackModal.classList.remove('hidden');
}

/**
 * Hide feedback modal
 */
function hideFeedbackModal() {
    elements.feedbackModal.classList.add('hidden');
}

/**
 * Show thank you modal
 */
function showThankYouModal() {
    elements.thankYouModal.classList.remove('hidden');
}

/**
 * Hide thank you modal
 */
function hideThankYouModal() {
    elements.thankYouModal.classList.add('hidden');
}

/**
 * Handle feedback submission
 */
function submitFeedbackHandler() {
    // Collect feedback data
    const feedbackData = {
        wouldUse: document.querySelector('.rating-btn.selected')?.dataset.value || null,
        rating: document.querySelectorAll('.star.active').length || null,
        comment: elements.feedbackText.value.trim() || ''
    };
    
    // Save feedback
    feedback.save(feedbackData);
    
    // Mark feedback as given
    state.feedbackGiven = true;
    
    // Hide feedback modal and show thank you
    hideFeedbackModal();
    showThankYouModal();
    
    // Log for demo purposes (you can remove this)
    console.log('Feedback submitted:', feedbackData);
}

/**
 * Share functionality
 */
function shareApp() {
    const shareText = "I just practiced interview questions with InterviewAI Coach! It's amazing - get instant feedback from AI. Check it out!";
    const shareUrl = window.location.href;
    
    // Try native Web Share API first (works on mobile)
    if (navigator.share) {
        navigator.share({
            title: 'InterviewAI Coach',
            text: shareText,
            url: shareUrl
        }).catch(err => console.log('Share cancelled'));
    } else {
        // Fallback: copy link to clipboard
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert('Link copied to clipboard! Share it with your friends.');
        }).catch(() => {
            // Final fallback: show the URL
            prompt('Share this link:', shareUrl);
        });
    }
}

// ==================== Page Navigation ====================

/**
 * Switch between landing and chat page
 */
async function goToChat() {
    elements.landingPage.classList.remove('active');
    elements.chatPage.classList.add('active');
    state.currentPage = 'chat';
    
    // Start analytics session
    analytics.startSession();

    // Show a neutral "checking" state while we ask the server (never the
    // client) whether a live AI key is configured — this avoids ever
    // claiming AI-Powered before we actually know.
    elements.avatarStatus.textContent = 'Connecting...';
    await checkAIHealth();

    // Set the transparency badge and inject a welcome message that honestly
    // reflects whether a live AI model is connected or this is rule-based practice.
    const aiOn = isAIConfigured();
    updateModeBadge(aiOn ? 'ai' : 'fallback');

    const welcomeText = aiOn
        ? "Hi! I'm your AI Interview Coach 👋 (powered by a live AI model — GPT).\n\nI'll ask you interview questions and give you AI-generated feedback. Let's start with a common one:\n\n**Tell me about yourself.**"
        : "Hi! I'm your Interview Coach 👋\n\n⚠️ **Practice Mode**: no live AI model is connected right now, so feedback comes from a rule-based scoring engine (not a generative AI), based on the actual content of your answers.\n\nLet's start with a common one:\n\n**Tell me about yourself.**";

    addMessage('assistant', welcomeText);

    // Avatar greets with the "asking" state (first question is already asked)
    updateAvatar('asking', 'Tell me about yourself — take your time.');
    
    // Focus on input
    setTimeout(() => {
        elements.messageInput.focus();
    }, 300);
}

// ==================== Event Listeners ====================

// Start button
elements.startBtn.addEventListener('click', goToChat);

// Send button
elements.sendBtn.addEventListener('click', sendMessage);

// Enter key to send (Ctrl+Enter on textarea)
elements.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Auto-resize textarea
elements.messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
});

// Avatar reacts as soon as the user starts typing an answer
elements.messageInput.addEventListener('focus', () => {
    if (!state.isTyping) updateAvatar('listening');
});

// ==================== Voice Input (Web Speech API) ====================
/**
 * Lets the candidate speak their answer instead of typing it. Uses the
 * browser's built-in speech recognition (Chrome/Edge support this well;
 * no server, no API key needed). Transcribed text is placed directly into
 * the answer textarea — the candidate can review/edit it before sending.
 */
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizer = null;
let isRecording = false;
let baseTextBeforeRecording = '';

if (SpeechRecognitionAPI && elements.micBtn) {
    recognizer = new SpeechRecognitionAPI();
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.lang = 'en-US';

    recognizer.onstart = () => {
        isRecording = true;
        baseTextBeforeRecording = elements.messageInput.value.trim();
        elements.micBtn.classList.add('recording');
        elements.micBtn.textContent = '⏹️';
        elements.voiceStatus.classList.remove('hidden');
        if (!state.isTyping) updateAvatar('listening', "I'm listening — speak your answer...");
    };

    recognizer.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }

        // Keep whatever was already typed, append confirmed speech, and
        // show the still-being-recognized words so it feels live.
        if (finalTranscript) {
            baseTextBeforeRecording = (baseTextBeforeRecording + ' ' + finalTranscript).trim();
        }
        elements.messageInput.value = (baseTextBeforeRecording + ' ' + interimTranscript).trim();
        elements.messageInput.dispatchEvent(new Event('input')); // trigger auto-resize
    };

    recognizer.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            elements.voiceStatus.textContent = '⚠️ Microphone access denied — allow mic permission in your browser to use voice input.';
            elements.voiceStatus.classList.remove('hidden');
            setTimeout(() => elements.voiceStatus.classList.add('hidden'), 4000);
        }
        stopRecording();
    };

    recognizer.onend = () => {
        stopRecording();
    };

    function stopRecording() {
        isRecording = false;
        elements.micBtn.classList.remove('recording');
        elements.micBtn.textContent = '🎤';
        elements.voiceStatus.classList.add('hidden');
        elements.messageInput.focus();
    }

    elements.micBtn.addEventListener('click', () => {
        if (isRecording) {
            recognizer.stop();
        } else {
            try {
                recognizer.start();
            } catch (err) {
                console.warn('Could not start recognition:', err);
            }
        }
    });
} else if (elements.micBtn) {
    // Browser doesn't support speech recognition (e.g. Firefox, some Safari
    // versions) — disable the button rather than showing something broken.
    elements.micBtn.disabled = true;
    elements.micBtn.title = 'Voice input isn\'t supported in this browser — try Chrome or Edge';
    elements.micBtn.style.opacity = '0.4';
}

// Share button
elements.shareBtn.addEventListener('click', shareApp);

// Modal close buttons
elements.closeModal.addEventListener('click', hideFeedbackModal);
elements.closeThankYou.addEventListener('click', hideThankYouModal);
elements.skipFeedback.addEventListener('click', () => {
    hideFeedbackModal();
    state.feedbackGiven = true; // Mark as given so it doesn't show again
});
elements.continueBtn.addEventListener('click', hideThankYouModal);

// Submit feedback button
elements.submitFeedback.addEventListener('click', submitFeedbackHandler);

// Rating buttons (Yes/No)
document.addEventListener('click', (e) => {
    if (e.target.matches('.rating-btn')) {
        // Remove selected from all buttons
        document.querySelectorAll('.rating-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        // Add selected to clicked button
        e.target.classList.add('selected');
    }
});

// Star rating
document.addEventListener('click', (e) => {
    if (e.target.matches('.star')) {
        const rating = parseInt(e.target.dataset.rating);
        const stars = document.querySelectorAll('.star');
        
        // Update star states
        stars.forEach((star, index) => {
            if (index < rating) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });
    }
});

// Close modal on outside click
window.addEventListener('click', (e) => {
    if (e.target === elements.feedbackModal) {
        hideFeedbackModal();
    }
    if (e.target === elements.thankYouModal) {
        hideThankYouModal();
    }
});

// Track session end on page unload
window.addEventListener('beforeunload', () => {
    analytics.endSession();
});

// ==================== Initialization ====================

/**
 * Initialize the application
 */
function init() {
    console.log('InterviewAI Coach initialized');
    console.log('API Key configured:', isAIConfigured() ? 'Yes' : 'No (using fallback/practice mode)');
    
    // Initialize analytics and feedback systems
    analytics.init();
    feedback.init();
    
    // Log current analytics (for demo purposes)
    const analyticsData = analytics.getData();
    console.log('Total sessions:', analyticsData.totalSessions);
    console.log('Total questions practiced:', analyticsData.totalQuestions);

    // Note: the welcome message + transparency badge are set inside goToChat(),
    // not here, so they always reflect the current mode at the moment the user
    // actually enters the chat (rather than being fixed at page load).
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
