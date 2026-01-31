export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { frameBase64 } = req.body

    if (!frameBase64) {
      return res.status(400).json({ error: 'Frame base64 required' })
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key not configured' })
    }

    // Call Gemini API to extract data from frame
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `Analizza questa immagine di una creative UGC per social media e estrai:
1. DESCRIZIONE: Il testo scritto/sovrimpresso visibile nel video
2. SPEAKERAGGIO: L'audio parlato (se intuibile dall'immagine, altrimenti lascia vuoto)
3. CTA: La call-to-action visibile
4. MUSICA: Il tipo di musica/vibe suggerito

Rispondi SOLO in formato JSON:
{
  "description": "testo qui",
  "speakeraggio": "audio parlato qui",
  "cta": "call to action qui",
  "songName": "tipo musica qui"
}`
              },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: frameBase64.replace(/^data:image\/\w+;base64,/, '')
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.4,
            topK: 32,
            topP: 1,
            maxOutputTokens: 1000,
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
    
    // Extract JSON from response
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Failed to parse Gemini response')
    }

    const extractedData = JSON.parse(jsonMatch[0])

    return res.status(200).json({
      description: extractedData.description || '',
      speakeraggio: extractedData.speakeraggio || '',
      cta: extractedData.cta || '',
      songName: extractedData.songName || '',
      hook: '' // User will fill this manually
    })

  } catch (error) {
    console.error('Extract data error:', error)
    return res.status(500).json({ error: error.message })
  }
}
