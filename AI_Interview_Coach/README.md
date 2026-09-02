# InterviewAI Coach 🎯

An AI-avatar mock interview coach for students and early-career job seekers. Built for the Product Intern Assignment (Build & Validate an AI Avatar Product).

## What it does

- Poses interview questions and lets the candidate answer by **typing or voice**
- An avatar visibly reacts through the conversation — asking → listening → thinking → scored reaction (excellent / positive / improve)
- Gives structured AI feedback (communication, relevance, structure, confidence scores + strengths/improvements + a connected follow-up question)
- Clearly discloses to the user whether they're talking to a live AI model or the rule-based practice engine (transparency badge + banner)
- Collects in-app feedback ("would you use this before a real interview?" + rating + comment) and surfaces it on a validation dashboard

## Tools & stack used

| Tool | Purpose |
|---|---|
| Vanilla HTML / CSS / JavaScript | Core app — no framework, fastest path to a working MVP |
| OpenAI API (`gpt-4o-mini`) | Real AI evaluation of candidate answers — structured JSON scoring + follow-up question |
| Netlify Functions | Serverless proxy so the OpenAI API key stays server-side and is never exposed in the browser |
| Web Speech API (browser built-in) | Voice input — converts spoken answers to text live, no external API/cost |
| localStorage | Session analytics + feedback capture (no backend database needed for MVP) |
| Netlify | Static hosting + serverless function hosting for the live deployment |

## Project structure

```
├── index.html                          # Main app (landing page + chat interface)
├── styles.css                          # All styling
├── script.js                           # App logic: avatar states, voice input, AI calls, analytics
├── dashboard.html                      # Validation dashboard — reads real feedback/analytics data
├── netlify.toml                        # Tells Netlify where the serverless function lives
└── netlify/
    └── functions/
        └── interview-feedback.js       # Serverless proxy to OpenAI (keeps API key server-side)
```

## Setup & deployment

1. **Install Netlify CLI** (one-time): `npm install -g netlify-cli`
2. From this folder, run:
   ```
   netlify login
   netlify deploy --prod
   ```
3. **Add your OpenAI API key** in the Netlify dashboard — *not* in any code file:
   Site settings → Environment variables → add `OPENAI_API_KEY` → redeploy.
4. Without a key configured, the app automatically falls back to a rule-based "Practice Mode" (still analyzes real answer content — length, STAR-method keywords, specificity — just not via a generative model). This is clearly labeled in the UI so users always know which mode they're in.

## Why the avatar is meaningful (not decorative)

The avatar changes emoji, status text, and color across 7 distinct states (asking, listening, thinking, excellent, positive, improve, idle), each triggered by an actual event in the conversation — not a static image. The candidate's answer is scored and the avatar's reaction reflects that score, closing the feedback loop visually instead of only in text.

## Validation

See `dashboard.html` for real usage/feedback data (would-use %, average rating, session counts) collected from actual testers, and the accompanying slide deck for the full traction summary, learnings, and next 2-week test plan.
