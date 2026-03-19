export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, system } = req.body;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          { role: 'system', content: system + '\n\nCRITICAL: Respond with ONLY a valid JSON object. No text before or after.' },
          ...messages.map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content
          }))
        ]
      })
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '{}';
    res.status(200).json({ content: [{ text }] });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}