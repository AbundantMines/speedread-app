// Supabase Edge Function — AI Comprehension Questions
// Deploy: supabase functions deploy comprehension
// Called after a user completes a reading session

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') as string

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  const { text, title, wpm, session_id } = await req.json()

  if (!text || text.length < 100) {
    return new Response(JSON.stringify({ error: 'Text too short' }), { status: 400 })
  }

  // Truncate to first 2,000 words for cost control
  const truncatedText = text.split(/\s+/).slice(0, 2000).join(' ')

  const prompt = `You are a reading comprehension tutor. A user just speed-read the following text at ${wpm} WPM.

Generate exactly 3 multiple-choice comprehension questions to test their understanding. Each question must:
- Test actual comprehension of key ideas (not trivia)
- Have 4 answer options labeled A, B, C, D
- Have exactly one correct answer

Return ONLY valid JSON in this exact format:
{
  "summary": "One paragraph summary of the key points (2-3 sentences)",
  "questions": [
    {
      "question": "Question text",
      "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
      "correct": "A"
    }
  ]
}

TEXT TO ANALYZE:
${truncatedText}`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
    })

    const data = await response.json()
    const result = JSON.parse(data.choices[0].message.content)

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('OpenAI error:', error)
    return new Response(JSON.stringify({ error: 'AI service unavailable' }), { status: 500 })
  }
})
