/**
 * Configuration file for InterviewAI Coach
 * 
 * SETUP INSTRUCTIONS:
 * 1. Get a free OpenAI API key from: https://platform.openai.com/api-keys
 * 2. Replace 'YOUR_API_KEY_HERE' below with your actual API key
 * 3. Save this file
 * 
 * Note: Keep your API key private! Don't commit it to version control.
 */

const CONFIG = {
    // Replace with your OpenAI API key
    OPENAI_API_KEY: 'YOUR_API_KEY_HERE',
    
    // API endpoint (don't change this)
    OPENAI_ENDPOINT: 'https://api.openai.com/v1/chat/completions',
    
    // Fallback mode: Works without API key but uses pre-written responses
    // To use fallback mode, leave OPENAI_API_KEY empty or as 'YOUR_API_KEY_HERE'
};

// Export configuration
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
