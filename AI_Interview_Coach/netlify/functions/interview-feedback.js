/**
 * Netlify serverless function — proxies interview-answer evaluation to OpenAI.
 *
 * The OpenAI API key lives ONLY here, as a server-side environment variable
 * (set in Netlify: Site settings → Environment variables → OPENAI_API_KEY).
 * It is never sent to, or visible from, the browser.
 *
 * GET  /.netlify/functions/interview-feedback         -> health check: { configured: boolean }
 * POST /.netlify/functions/interview-feedback          -> body: { answer: string }
 *      returns: { scores, strengths, improvements, followUpQuestion }
 */

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';

exports.handler = async function (event) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    const apiKey = process.env.OPENAI_API_KEY;

    // Health check — lets the frontend know (without ever seeing the key)
    // whether live AI is actually configured on this deployment.
    if (event.httpMethod === 'GET') {
        return {
            statusCode: 200,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ configured: Boolean(apiKey) })
        };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    if (!apiKey) {
        return {
            statusCode: 500,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'OPENAI_API_KEY is not configured on the server.' })
        };
    }

    try {
        const { answer } = JSON.parse(event.body || '{}');
        if (!answer || typeof answer !== 'string') {
            return {
                statusCode: 400,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Missing "answer" in request body.' })
            };
        }

        const response = await fetch(OPENAI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: OPENAI_MODEL,
                response_format: { type: 'json_object' },
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert interview coach evaluating a candidate's spoken/written interview answer.

Respond with ONLY a JSON object (no markdown, no prose outside JSON) with this exact shape:
{
  "scores": {
    "communication": <1-10 integer>,
    "relevance": <1-10 integer>,
    "structure": <1-10 integer>,
    "confidence": <1-10 integer>
  },
  "strengths": ["...", "..."],
  "improvements": ["...", "..."],
  "followUpQuestion": "a single interview question that follows naturally from what the candidate just said"
}

Be honest and specific — base every score strictly on the actual content of the answer given, not on generic encouragement. A vague or very short answer should score low on relevance and structure.`
                    },
                    {
                        role: 'user',
                        content: `Interview question context: this is part of an ongoing mock interview.\n\nCandidate's answer:\n"${answer}"`
                    }
                ],
                temperature: 0.5,
                max_tokens: 500
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            return {
                statusCode: 502,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'OpenAI request failed', detail: errText })
            };
        }

        const data = await response.json();
        const parsed = JSON.parse(data.choices[0].message.content);

        return {
            statusCode: 200,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(parsed)
        };

    } catch (err) {
        return {
            statusCode: 500,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Server error', detail: String(err) })
        };
    }
};
