import { useState, useRef, useEffect } from 'react'
import Head from 'next/head'

export default function Home() {
  const [currentStep, setCurrentStep] = useState(1)
  const [videoFile, setVideoFile] = useState(null)
  const [videoUrl, setVideoUrl] = useState(null)
  const [extractedData, setExtractedData] = useState({
    hook: '',
    description: '',
    speakeraggio: '',
    cta: '',
    songName: '',
    extracted: false
  })
  const [variants, setVariants] = useState([])
  const [generatedVideos, setGeneratedVideos] = useState({})
  const [showSettings, setShowSettings] = useState(false)
  const [apiKeys, setApiKeys] = useState({
    cloudinary: { cloudName: '', uploadPreset: '' },
    piapi: ''
  })
  
  const fileInputRef = useRef(null)

  // Load API keys from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('vcp_api_keys')
    if (stored) {
      try {
        setApiKeys(JSON.parse(stored))
      } catch (e) {
        console.error('Error loading API keys:', e)
      }
    }
  }, [])

  // Save API keys to localStorage
  const saveApiKeys = () => {
    localStorage.setItem('vcp_api_keys', JSON.stringify(apiKeys))
    setShowSettings(false)
    alert('✅ API Keys salvate!')
  }

  const handleVideoUpload = (e) => {
    const file = e.target.files[0]
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file)
      const url = URL.createObjectURL(file)
      setVideoUrl(url)
      console.log('📹 Video caricato:', file.name)
    }
  }

  const extractDataFromVideo = () => {
    console.log('🔍 Estrazione dati dal video...')
    
    // Simulated extraction - replace with actual AI extraction
    setTimeout(() => {
      setExtractedData({
        hook: 'Hook estratto dal video',
        description: 'Descrizione estratta automaticamente',
        speakeraggio: 'Testo dello speakeraggio',
        cta: 'Call to action',
        songName: 'Nome canzone',
        extracted: true
      })
      console.log('✅ Dati estratti con successo')
    }, 2000)
  }

  const generateVariants = () => {
    console.log('🎨 Generazione varianti...')
    
    const angles = [
      { angle: 'Angolo Frontale', number: 1, description: 'Vista frontale del parabrezza' },
      { angle: 'Angolo Laterale Sx', number: 2, description: 'Vista laterale sinistra' },
      { angle: 'Angolo Laterale Dx', number: 3, description: 'Vista laterale destra' },
      { angle: 'Dettaglio Gocce', number: 4, description: 'Focus sulle gocce d\'acqua' },
      { angle: 'Prima/Dopo', number: 5, description: 'Confronto prima e dopo' }
    ]
    
    setVariants(angles)
    setCurrentStep(2)
  }

  const generateVideoAI = async (variantIndex) => {
    const variant = variants[variantIndex]
    const key = `${variantIndex}_single`
    
    console.log(`🎬 Generazione video AI per: ${variant.angle}`)
    
    // Mark as generating
    setGeneratedVideos(prev => ({
      ...prev,
      [key]: { generating: true, progressMessage: 'Inizializzazione...' }
    }))

    try {
      // Step 1: Upload frame to Cloudinary
      setGeneratedVideos(prev => ({
        ...prev,
        [key]: { ...prev[key], progressMessage: 'Caricamento frame su Cloudinary...' }
      }))

      const frameDataUrl = videoUrl // Simplified - use actual frame extraction
      
      const cloudinaryFormData = new FormData()
      cloudinaryFormData.append('file', frameDataUrl)
      cloudinaryFormData.append('upload_preset', apiKeys.cloudinary.uploadPreset)

      const cloudinaryRes = await fetch(
        `https://api.cloudinary.com/v1_1/${apiKeys.cloudinary.cloudName}/image/upload`,
        {
          method: 'POST',
          body: cloudinaryFormData
        }
      )

      if (!cloudinaryRes.ok) {
        throw new Error('Cloudinary upload failed')
      }

      const cloudinaryData = await cloudinaryRes.json()
      const frameUrl = cloudinaryData.secure_url

      // Step 2: Generate video with PiAPI
      setGeneratedVideos(prev => ({
        ...prev,
        [key]: { ...prev[key], progressMessage: 'Creazione task video AI...' }
      }))

      const piApiBody = {
        prompt: `${variant.description}. ${extractedData.description}`,
        expand_prompt: true,
        aspect_ratio: '9:16',
        key_frames: {
          frame0: {
            type: 'image',
            url: frameUrl
          }
        }
      }

      const createTaskRes = await fetch('https://api.piapi.ai/api/luma/v1/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKeys.piapi
        },
        body: JSON.stringify(piApiBody)
      })

      if (!createTaskRes.ok) {
        throw new Error('PiAPI task creation failed')
      }

      const taskData = await createTaskRes.json()
      const taskId = taskData.data?.id

      if (!taskId) {
        throw new Error('No task ID returned')
      }

      // Step 3: Poll for completion
      setGeneratedVideos(prev => ({
        ...prev,
        [key]: { ...prev[key], progressMessage: 'Generazione video in corso... (2-3 min)' }
      }))

      let attempts = 0
      const maxAttempts = 60
      let videoUrl = null

      while (attempts < maxAttempts && !videoUrl) {
        await new Promise(resolve => setTimeout(resolve, 3000))
        attempts++

        const statusRes = await fetch(
          `https://api.piapi.ai/api/luma/v1/generations/${taskId}`,
          {
            headers: { 'X-API-Key': apiKeys.piapi }
          }
        )

        if (statusRes.ok) {
          const statusData = await statusRes.json()
          const state = statusData.data?.state

          if (state === 'completed') {
            videoUrl =
              statusData.data?.generation?.video_raw?.url ||
              statusData.data?.output?.video_raw?.url ||
              statusData.data?.video?.url ||
              statusData.data?.assets?.video

            if (videoUrl) {
              console.log('✅ Video generato:', videoUrl)
              break
            }
          } else if (state === 'failed') {
            throw new Error('Video generation failed')
          }
        }

        setGeneratedVideos(prev => ({
          ...prev,
          [key]: { 
            ...prev[key], 
            progressMessage: `Tentativo ${attempts}/${maxAttempts}...` 
          }
        }))
      }

      if (!videoUrl) {
        throw new Error('Video generation timed out')
      }

      // Success!
      setGeneratedVideos(prev => ({
        ...prev,
        [key]: { 
          generating: false, 
          videoUrl: videoUrl,
          taskId: taskId
        }
      }))

    } catch (error) {
      console.error('❌ Errore generazione video:', error)
      setGeneratedVideos(prev => ({
        ...prev,
        [key]: { 
          generating: false, 
          error: error.message 
        }
      }))
      alert(`Errore: ${error.message}`)
    }
  }

  const exportVariant = (variant) => {
    console.log('💾 Esportazione variante:', variant)
    alert(`Esportazione variante ${variant.number}: ${variant.angle}`)
  }

  const exportAll = () => {
    console.log('📦 Esportazione di tutte le varianti')
    alert(`Esportazione di ${variants.length} varianti`)
  }

  return (
    <>
      <Head>
        <title>Creative Variants Generator Pro v1.1</title>
        <meta name="description" content="AI Video Generation Platform" />
        <link rel="icon" href="/favicon.ico" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Sora:wght@400;600;700;800&display=swap" rel="stylesheet" />
      </Head>

      <div className="app">
        {/* Header */}
        <div className="header">
          <div>
            <div>
              <h1>CREATIVE VARIANTS</h1>
              <p className="subtitle">Genera varianti intelligenti dei tuoi creative video con AI</p>
            </div>
            <button className="settings-btn" onClick={() => setShowSettings(!showSettings)}>
              ⚙️ Settings
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="settings-panel">
            <h3>🔑 API Configuration</h3>
            
            <div className="setting-group">
              <label>Cloudinary Cloud Name</label>
              <input
                type="text"
                value={apiKeys.cloudinary.cloudName}
                onChange={(e) => setApiKeys({
                  ...apiKeys,
                  cloudinary: { ...apiKeys.cloudinary, cloudName: e.target.value }
                })}
                placeholder="es: dxxxxx"
              />
            </div>

            <div className="setting-group">
              <label>Cloudinary Upload Preset</label>
              <input
                type="text"
                value={apiKeys.cloudinary.uploadPreset}
                onChange={(e) => setApiKeys({
                  ...apiKeys,
                  cloudinary: { ...apiKeys.cloudinary, uploadPreset: e.target.value }
                })}
                placeholder="es: your_preset"
              />
            </div>

            <div className="setting-group">
              <label>PiAPI Key</label>
              <input
                type="password"
                value={apiKeys.piapi}
                onChange={(e) => setApiKeys({ ...apiKeys, piapi: e.target.value })}
                placeholder="sk-xxxxx"
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-primary" onClick={saveApiKeys}>
                💾 Salva
              </button>
              <button className="btn btn-secondary" onClick={() => setShowSettings(false)}>
                ❌ Annulla
              </button>
            </div>
          </div>
        )}

        {/* Workflow Steps */}
        <div className="workflow">
          {/* Step 1: Upload Video */}
          <div className={`step ${currentStep >= 1 ? 'active' : ''}`}>
            <div className="step-number">1</div>
            <h3 className="step-title">Carica Video</h3>
            <p className="step-description">
              Carica il video originale dal quale estrarre i dati
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoUpload}
              style={{ display: 'none' }}
            />

            <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
              📤 Scegli Video
            </button>

            {videoUrl && (
              <div style={{ marginTop: '20px' }}>
                <video
                  controls
                  style={{
                    width: '100%',
                    borderRadius: '8px',
                    marginBottom: '16px'
                  }}
                  src={videoUrl}
                />
                <button className="btn btn-secondary" onClick={extractDataFromVideo}>
                  🔍 Estrai Dati
                </button>
              </div>
            )}

            {extractedData.extracted && (
              <div style={{ marginTop: '20px' }}>
                <div className="success-badge">✅ Dati estratti!</div>
                <button className="btn btn-primary" onClick={() => setCurrentStep(2)}>
                  Continua →
                </button>
              </div>
            )}
          </div>

          {/* Step 2: Generate Variants */}
          <div className={`step ${currentStep >= 2 ? 'active' : ''}`}>
            <div className="step-number">2</div>
            <h3 className="step-title">Genera Varianti</h3>
            <p className="step-description">
              Crea varianti intelligenti con angolazioni diverse
            </p>

            {currentStep >= 2 && variants.length === 0 && (
              <button className="btn btn-primary" onClick={generateVariants}>
                🎨 Genera Varianti
              </button>
            )}

            {variants.length > 0 && (
              <div>
                <div className="variants-grid">
                  {variants.map((variant, index) => (
                    <div key={index} className="variant-card">
                      <div className="variant-header">
                        <strong>Variante {variant.number}</strong>
                        <span>{variant.angle}</span>
                      </div>
                      <p>{variant.description}</p>
                      
                      {!generatedVideos[`${index}_single`] && (
                        <button
                          className="btn btn-small btn-primary"
                          onClick={() => generateVideoAI(index)}
                        >
                          🎬 Genera Video AI
                        </button>
                      )}

                      {generatedVideos[`${index}_single`] && (
                        <div className="video-status">
                          {generatedVideos[`${index}_single`].videoUrl ? (
                            <>
                              <div style={{ fontSize: '1.5rem' }}>✅</div>
                              <div style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                                Video generato!
                              </div>
                              
                              <video
                                controls
                                style={{
                                  width: '100%',
                                  borderRadius: '8px',
                                  marginTop: '12px',
                                  marginBottom: '12px'
                                }}
                                src={generatedVideos[`${index}_single`].videoUrl}
                              />
                              
                              <a
                                href={generatedVideos[`${index}_single`].videoUrl}
                                download={`video_variante_${index + 1}.mp4`}
                                className="btn btn-primary btn-small"
                                style={{ textDecoration: 'none', display: 'block' }}
                              >
                                📥 Scarica Video
                              </a>
                            </>
                          ) : (
                            <>
                              <div style={{ fontSize: '1.5rem' }}>⏳</div>
                              <div style={{ fontWeight: 'bold' }}>Generazione in corso...</div>
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                {generatedVideos[`${index}_single`].progressMessage || 'Attendi 2-3 minuti'}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '20px' }}
                  onClick={() => setCurrentStep(3)}
                >
                  ✅ Vai all'Export
                </button>
              </div>
            )}
          </div>

          {/* Step 3: Export */}
          <div className={`step ${currentStep >= 3 ? 'active' : ''}`}>
            <div className="step-number">3</div>
            <h3 className="step-title">Esporta</h3>
            <p className="step-description">
              Le varianti sono pronte. Esporta singolarmente o tutte insieme.
            </p>

            {variants.length > 0 && currentStep >= 3 && (
              <div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={exportAll}>
                  📦 Esporta Tutte ({variants.length} varianti)
                </button>

                <div style={{ marginTop: '20px' }}>
                  <h4 style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>
                    O esporta singolarmente:
                  </h4>
                  {variants.map((variant, index) => (
                    <div key={index} className="export-item">
                      <div>
                        <strong>Variante {variant.number}</strong>
                        <span>{variant.angle}</span>
                      </div>
                      <button className="btn btn-secondary btn-small" onClick={() => exportVariant(variant)}>
                        💾 Esporta
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', marginTop: '30px' }}
                  onClick={() => {
                    setVariants([])
                    setExtractedData({ hook: '', description: '', speakeraggio: '', cta: '', songName: '', extracted: false })
                    setCurrentStep(1)
                    setVideoFile(null)
                    setVideoUrl(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                >
                  🔄 Nuovo Video
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        :global(:root) {
          --bg-primary: #0a0e14;
          --bg-secondary: #151b23;
          --bg-tertiary: #1e2630;
          --accent-primary: #00ff88;
          --accent-secondary: #00d4ff;
          --accent-danger: #ff3366;
          --text-primary: #e6eef9;
          --text-secondary: #8b95a8;
          --border: rgba(255, 255, 255, 0.08);
        }

        :global(*) {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        :global(body) {
          font-family: 'Sora', sans-serif;
          background: linear-gradient(135deg, var(--bg-primary) 0%, #0d1219 100%);
          color: var(--text-primary);
          min-height: 100vh;
        }

        .app {
          margin: 0 auto;
          padding: 40px 20px;
          max-width: 1400px;
        }

        .header {
          text-align: center;
          margin-bottom: 60px;
          position: relative;
        }

        .header > div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        h1 {
          font-family: 'JetBrains Mono', monospace;
          font-size: 3rem;
          font-weight: 800;
          background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-transform: uppercase;
          margin-bottom: 12px;
        }

        .subtitle {
          font-size: 1.1rem;
          color: var(--text-secondary);
        }

        .settings-btn {
          padding: 12px 24px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.3s ease;
          font-weight: 600;
        }

        .settings-btn:hover {
          border-color: var(--accent-primary);
          transform: translateY(-2px);
        }

        .settings-panel {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 30px;
          margin-bottom: 40px;
        }

        .settings-panel h3 {
          margin-bottom: 24px;
          color: var(--accent-primary);
        }

        .setting-group {
          margin-bottom: 20px;
        }

        .setting-group label {
          display: block;
          margin-bottom: 8px;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .setting-group input {
          width: 100%;
          padding: 12px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text-primary);
          font-size: 1rem;
        }

        .workflow {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }

        @media (max-width: 1200px) {
          .workflow {
            grid-template-columns: 1fr;
          }
        }

        .step {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 30px;
          min-height: 500px;
          display: flex;
          flex-direction: column;
        }

        .step.active {
          border-color: var(--accent-primary);
        }

        .step-number {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--accent-primary);
          color: var(--bg-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          margin-bottom: 20px;
        }

        .step-title {
          font-size: 1.5rem;
          margin-bottom: 12px;
        }

        .step-description {
          color: var(--text-secondary);
          margin-bottom: 24px;
        }

        .btn {
          padding: 14px 28px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          border: none;
          font-size: 1rem;
        }

        .btn-primary {
          background: var(--accent-primary);
          color: var(--bg-primary);
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 255, 136, 0.3);
        }

        .btn-secondary {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border: 1px solid var(--border);
        }

        .btn-small {
          padding: 8px 16px;
          font-size: 0.9rem;
        }

        .success-badge {
          background: rgba(0, 255, 136, 0.1);
          border: 1px solid var(--accent-primary);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
          text-align: center;
          font-weight: 600;
        }

        .variants-grid {
          display: grid;
          gap: 16px;
          margin-bottom: 20px;
        }

        .variant-card {
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px;
        }

        .variant-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .video-status {
          margin-top: 16px;
          padding: 16px;
          background: rgba(0, 255, 136, 0.05);
          border-radius: 8px;
          text-align: center;
        }

        .export-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          border-radius: 8px;
          margin-bottom: 12px;
        }

        @media (max-width: 768px) {
          h1 {
            font-size: 2rem;
          }

          .header > div {
            flex-direction: column;
          }
        }
      `}</style>
    </>
  )
}
