export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { frameBase64, prompt, frameType } = req.body

    if (!frameBase64 || !prompt) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Check required API keys
    const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME
    const CLOUDINARY_UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET
    const PIAPI_KEY = process.env.PIAPI_KEY

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
      return res.status(500).json({ error: 'Cloudinary not configured' })
    }

    if (!PIAPI_KEY) {
      return res.status(500).json({ error: 'PiAPI key not configured' })
    }

    // STEP 1: Upload frame to Cloudinary
    console.log('📤 Uploading frame to Cloudinary...')
    
    const formData = new FormData()
    formData.append('file', frameBase64)
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)

    const cloudinaryResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData
      }
    )

    if (!cloudinaryResponse.ok) {
      const errorText = await cloudinaryResponse.text()
      throw new Error(`Cloudinary upload failed: ${cloudinaryResponse.status} - ${errorText}`)
    }

    const cloudinaryData = await cloudinaryResponse.json()
    const framePublicUrl = cloudinaryData.secure_url

    console.log('✅ Frame uploaded to Cloudinary:', framePublicUrl)

    // STEP 2: Create Luma video generation task via PiAPI
    console.log('🎬 Creating Luma video generation task...')

    const lumaRequestBody = {
      prompt: prompt,
      expand_prompt: true,
      aspect_ratio: "9:16",
      key_frames: {
        frame0: {
          type: "image",
          url: framePublicUrl
        }
      }
    }

    const createTaskResponse = await fetch('https://api.piapi.ai/api/luma/v1/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': PIAPI_KEY
      },
      body: JSON.stringify(lumaRequestBody)
    })

    if (!createTaskResponse.ok) {
      const errorText = await createTaskResponse.text()
      throw new Error(`PiAPI task creation failed: ${createTaskResponse.status} - ${errorText}`)
    }

    const createTaskData = await createTaskResponse.json()
    const taskId = createTaskData.data?.id

    if (!taskId) {
      throw new Error('No task ID returned from PiAPI')
    }

    console.log('✅ Task created:', taskId)

    // STEP 3: Poll for completion (max 3 minutes)
    console.log('⏳ Polling for video completion...')
    
    let attempts = 0
    const maxAttempts = 60 // 60 * 3 seconds = 3 minutes
    let videoUrl = null

    while (attempts < maxAttempts && !videoUrl) {
      // Wait 3 seconds between checks
      await new Promise(resolve => setTimeout(resolve, 3000))
      attempts++

      const statusResponse = await fetch(
        `https://api.piapi.ai/api/luma/v1/generations/${taskId}`,
        {
          headers: {
            'X-API-Key': PIAPI_KEY
          }
        }
      )

      if (!statusResponse.ok) {
        console.error('Status check failed:', statusResponse.status)
        continue
      }

      const statusData = await statusResponse.json()
      const state = statusData.data?.state

      console.log(`Check #${attempts}: State = ${state}`)

      if (state === 'completed') {
        // Find video URL in various possible locations
        videoUrl = 
          statusData.data?.generation?.video_raw?.url ||
          statusData.data?.output?.video_raw?.url ||
          statusData.data?.video?.url ||
          statusData.data?.assets?.video ||
          null

        if (videoUrl) {
          console.log('✅ Video completed! URL:', videoUrl)
          break
        }
      } else if (state === 'failed') {
        throw new Error('Video generation failed')
      }
    }

    if (!videoUrl) {
      throw new Error('Video generation timed out')
    }

    return res.status(200).json({
      videoUrl,
      taskId,
      frameType
    })

  } catch (error) {
    console.error('Generate video error:', error)
    return res.status(500).json({ error: error.message })
  }
}
