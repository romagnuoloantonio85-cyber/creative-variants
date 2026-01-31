export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { extractedData, numVariants } = req.body

    if (!extractedData || !numVariants) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key not configured' })
    }

    // Call Gemini API to generate variants
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Genera ${numVariants} varianti di copy UGC diverse per social media basate su questi dati:

DATI ESTRATTI:
- Descrizione: ${extractedData.description}
- Speakeraggio: ${extractedData.speakeraggio}
- CTA: ${extractedData.cta}
- Musica: ${extractedData.songName}

Crea ${numVariants} varianti MOLTO diverse tra loro con:
1. HOOK (2-4 secondi): Cattura attenzione immediata
2. BODY (6-8 secondi): Descrive problema/soluzione
3. CTA (2-4 secondi): Call to action finale

IMPORTANTE:
- Ogni variante deve avere un ANGOLO DIVERSO (pain point, social proof, urgency, transformation, ecc.)
- Linguaggio naturale, colloquiale, UGC style
- Massimo 15-20 parole per sezione

Rispondi SOLO in formato JSON array:
[
  {
    "number": 1,
    "angle": "nome angolo",
    "hook": "testo hook",
    "body": "testo body",
    "cta": "testo cta"
  },
  ...
]`
            }]
          }],
          generationConfig: {
            temperature: 0.9,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 4000,
          }
        })
      }
    )

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || 'Gemini API error')
    }

    // Parse Gemini response
    const textResponse = data.candidates[0]?.content?.parts[0]?.text || ''
    
    // Extract JSON array from response
    const jsonMatch = textResponse.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('Failed to parse Gemini response')
    }

    const variants = JSON.parse(jsonMatch[0])

    return res.status(200).json({ variants })

  } catch (error) {
    console.error('Generate variants error:', error)
    return res.status(500).json({ error: error.message })
  }
}
