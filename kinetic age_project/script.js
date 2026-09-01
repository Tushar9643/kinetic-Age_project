/**
 * InterviewAI Coach - Main JavaScript
 * Handles chat interactions, AI responses, and UI updates
 */

// ==================== Configuration ====================

const CONFIG = {
    // OpenAI API configuration (you'll need to add your API key)
    OPENAI_API_KEY: '', // Add your OpenAI API key here
    OPENAI_ENDPOINT: 'https://api.openai.com/v1/chat/completions',
    
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
    ]
};

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
    questionCount: document.getElementById('questionCount'),
    aiAvatar: document.getElementById('aiAvatar'),
    thinkingDots: document.getElementById('thinkingDots'),
    avatarCircle: document.querySelector('.avatar-circle'),
    avatarEmoji: document.querySelector('.avatar-emoji'),
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
    ratingButtons: null, // Will be set in init
    stars: null // Will be set in init
};

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
 * Show/hide thinking animation
 */
function setThinking(isThinking) {
    state.isTyping = isThinking;
    
    if (isThinking) {
        elements.thinkingDots.classList.remove('hidden');
        elements.avatarCircle.classList.add('thinking');
        elements.avatarEmoji.textContent = '🤔';
        elements.messageInput.disabled = true;
        elements.sendBtn.disabled = true;
    } else {
        elements.thinkingDots.classList.add('hidden');
        elements.avatarCircle.classList.remove('thinking');
        elements.avatarEmoji.textContent = '🎯';
        elements.messageInput.disabled = false;
        elements.sendBtn.disabled = false;
    }
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
 * Get AI response using OpenAI API
 */
async function getAIResponse(userMessage) {
    // If no API key is set, use fallback response
    if (!CONFIG.OPENAI_API_KEY || CONFIG.OPENAI_API_KEY === '') {
        return getFallbackResponse(userMessage);
    }
    
    try {
        const response = await fetch(CONFIG.OPENAI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert interview coach. Analyze the user's answer and provide:

1. **Strengths** (2-3 specific points about what they did well)
2. **Areas for Improvement** (2-3 constructive suggestions)
3. **Better Answer Example** (show them how to improve using the STAR method)
4. **Next Question** (ask another interview question)

Be encouraging but honest. Focus on actionable feedback. Keep responses concise.`
                    },
                    {
                        role: 'user',
                        content: `Please provide feedback on this interview answer:\n\n"${userMessage}"\n\nThen ask me the next interview question.`
                    }
                ],
                temperature: 0.8,
                max_tokens: 500
            })
        });
        
        if (!response.ok) {
            throw new Error('API request failed');
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
        
    } catch (error) {
        console.error('Error calling OpenAI API:', error);
        return getFallbackResponse(userMessage);
    }
}

/**
 * Get fallback response when API is not available
 */
function getFallbackResponse(userMessage) {
    const randomQuestion = CONFIG.INTERVIEW_QUESTIONS[
        Math.floor(Math.random() * CONFIG.INTERVIEW_QUESTIONS.length)
    ];
    
    return `Great effort on your answer! Here's my feedback:

**Strengths:**
✅ You provided a clear and structured response
✅ You showed enthusiasm and confidence

**Areas for Improvement:**
🔄 Try using the STAR method (Situation, Task, Action, Result) for more impact
🔄 Include specific examples and metrics when possible
🔄 Connect your experience directly to the role requirements

**Pro Tip:**
Quantify your achievements - numbers make your story more credible and memorable.

**Next Question:**
${randomQuestion}

Take your time and be specific with your examples!`;
}

/**
 * Handle sending a message
 */
async function sendMessage() {
    const message = elements.messageInput.value.trim();
    
    if (!message || state.isTyping) {
        return;
    }
    
    // Add user message
    addMessage('user', message);
    elements.messageInput.value = '';
    
    // Show thinking state
    setThinking(true);
    
    // Simulate a slight delay for better UX
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get AI response
    const aiResponse = await getAIResponse(message);
    
    // Add AI response
    addMessage('assistant', aiResponse);
    
    // Update question count
    state.questionCount++;
    elements.questionCount.textContent = state.questionCount;
    
    // Track analytics
    analytics.trackQuestion();
    
    // Show feedback modal after 3 questions (if not already shown)
    if (state.questionCount >= 4 && !state.feedbackGiven) {
        setTimeout(() => showFeedbackModal(), 2000);
    }
    
    // Hide thinking state
    setThinking(false);
    
    // Focus back on input
    elements.messageInput.focus();
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
function goToChat() {
    elements.landingPage.classList.remove('active');
    elements.chatPage.classList.add('active');
    state.currentPage = 'chat';
    
    // Start analytics session
    analytics.startSession();
    
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
    this.style.height = Math.min(this.scrollHeight, 150) + 'px';
});

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
    console.log('API Key configured:', CONFIG.OPENAI_API_KEY ? 'Yes' : 'No (using fallback mode)');
    
    // Initialize analytics and feedback systems
    analytics.init();
    feedback.init();
    
    // Log current analytics (for demo purposes)
    const analyticsData = analytics.getData();
    console.log('Total sessions:', analyticsData.totalSessions);
    console.log('Total questions practiced:', analyticsData.totalQuestions);
    
    // Add initial welcome message to state
    state.messages.push({
        role: 'assistant',
        content: "Hi! I'm your AI Interview Coach 👋\n\nI'll ask you interview questions and give you detailed feedback. Let's start with a common one:\n\n**Tell me about yourself.**",
        timestamp: new Date()
    });
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
