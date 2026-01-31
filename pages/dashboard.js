import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase, signOut, getCurrentUser } from '@/lib/supabase'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentStep, setCurrentStep] = useState(1)
  
  // Video upload state
  const [videoFile, setVideoFile] = useState(null)
  const [videoUrl, setVideoUrl] = useState(null)
  const fileInputRef = useRef(null)
  
  // Extracted data
  const [extractedFrames, setExtractedFrames] = useState({
    start: null,
    middle: null,
    end: null
  })
  const [extractedData, setExtractedData] = useState({
    hook: '',
    description: '',
    speakeraggio: '',
    cta: '',
    extracted: false
  })
  
  // Variants
  const [variants, setVariants] = useState([])
  const [numVariants, setNumVariants] = useState(5)
  
  // Video generation
  const [generatedVideos, setGeneratedVideos] = useState({})
  
  const [toast, setToast] = useState(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      router.push('/')
    } else {
      setUser(currentUser)
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await signOut()
    router.push('/')
  }

  const showToast = (message) => {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  const handleFileUpload = (file) => {
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file)
      const url = URL.createObjectURL(file)
      setVideoUrl(url)
      showToast('✅ Video caricato con successo!')
    } else {
      showToast('❌ Per favore carica un file video')
    }
  }

  const extractFrames = async () => {
    if (!videoFile) {
      showToast('❌ Nessun video caricato!')
      return
    }

    try {
      showToast('🎬 Estrazione frame in corso...')
      
      // Create video element to extract frames
      const video = document.createElement('video')
      video.src = videoUrl
      
      await new Promise((resolve) => {
        video.onloadedmetadata = resolve
      })

      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')

      // Extract 3 frames
      const duration = video.duration
      const times = [0, duration / 2, duration - 0.1]
      const frames = {}

      for (let i = 0; i < times.length; i++) {
        video.currentTime = times[i]
        await new Promise((resolve) => {
          video.onseeked = resolve
        })
        ctx.drawImage(video, 0, 0)
        const frameData = canvas.toDataURL('image/jpeg', 0.9)
        
        if (i === 0) frames.start = frameData
        if (i === 1) frames.middle = frameData
        if (i === 2) frames.end = frameData
      }

      setExtractedFrames(frames)
      showToast('✅ Frame estratti con successo!')
      setCurrentStep(2)

    } catch (error) {
      console.error('Frame extraction error:', error)
      showToast('❌ Errore estrazione frame')
    }
  }

  const extractDataWithAI = async () => {
    if (!extractedFrames.middle) {
      showToast('❌ Nessun frame disponibile!')
      return
    }

    try {
      showToast('🤖 Estrazione dati con AI...')
      
      const response = await fetch('/api/extract-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frameBase64: extractedFrames.middle
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Errore estrazione dati')
      }

      setExtractedData({
        ...data,
        extracted: true
      })
      
      showToast('✅ Dati estratti con successo!')

    } catch (error) {
      console.error('Data extraction error:', error)
      showToast('❌ Errore estrazione dati')
    }
  }

  const generateVariants = async () => {
    if (!extractedData.extracted) {
      showToast('❌ Prima estrai i dati!')
      return
    }

    try {
      showToast(`🎨 Generazione ${numVariants} varianti...`)
      
      const response = await fetch('/api/generate-variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extractedData,
          numVariants
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Errore generazione varianti')
      }

      setVariants(data.variants)
      showToast('✅ Varianti generate!')
      setCurrentStep(3)

    } catch (error) {
      console.error('Variants generation error:', error)
      showToast('❌ Errore generazione varianti')
    }
  }

  const generate3Videos = async (variant, variantIndex) => {
    try {
      showToast('🎬 Generazione 3 video da 3 frame...')
      
      const frames = ['start', 'middle', 'end']
      
      for (let frameType of frames) {
        const videoKey = `${variantIndex}_${frameType}`
        
        setGeneratedVideos(prev => ({
          ...prev,
          [videoKey]: { status: 'generating', progress: 0 }
        }))

        const response = await fetch('/api/generate-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            frameBase64: extractedFrames[frameType],
            prompt: variant.hook + ' ' + variant.body,
            frameType
          })
        })

        const data = await response.json()
        
        if (!response.ok) {
          throw new Error(data.error || 'Errore generazione video')
        }

        setGeneratedVideos(prev => ({
          ...prev,
          [videoKey]: {
            status: 'completed',
            videoUrl: data.videoUrl,
            frameType
          }
        }))
        
        showToast(`✅ Video ${frameType} completato!`)
      }
      
      showToast('🎉 Tutti e 3 i video generati!')

    } catch (error) {
      console.error('Video generation error:', error)
      showToast('❌ Errore generazione video')
    }
  }

  if (loading) {
    return <div className="loading">Caricamento...</div>
  }

  return (
    <div className="container">
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 0',
        marginBottom: '40px',
        borderBottom: '1px solid var(--border)'
      }}>
        <h1 style={{
          fontSize: '2rem',
          background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          CREATIVE VARIANTS
        </h1>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            {user?.email}
          </span>
          <button className="btn btn-secondary" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          padding: '16px 24px',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--accent-primary)',
          borderRadius: '8px',
          zIndex: 1000,
          animation: 'slideIn 0.3s ease'
        }}>
          {toast}
        </div>
      )}

      {/* Steps */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '20px',
        marginBottom: '60px'
      }}>
        {[1, 2, 3].map((step) => (
          <div
            key={step}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: currentStep >= step ? 
                'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' :
                'var(--bg-tertiary)',
              color: currentStep >= step ? 'var(--bg-primary)' : 'var(--text-secondary)',
              fontWeight: 'bold'
            }}>
              {step}
            </div>
            <span style={{
              color: currentStep >= step ? 'var(--text-primary)' : 'var(--text-secondary)'
            }}>
              {step === 1 && 'Carica Video'}
              {step === 2 && 'Genera Varianti'}
              {step === 3 && 'Crea Video AI'}
            </span>
          </div>
        ))}
      </div>

      {/* Step 1: Upload Video */}
      {currentStep >= 1 && (
        <div className="card" style={{ marginBottom: '40px' }}>
          <h2 style={{ marginBottom: '24px' }}>📹 Step 1: Carica Video</h2>
          
          <input
            type="file"
            ref={fileInputRef}
            accept="video/*"
            style={{ display: 'none' }}
            onChange={(e) => handleFileUpload(e.target.files[0])}
          />
          
          <button
            className="btn btn-primary"
            onClick={() => fileInputRef.current.click()}
            style={{ marginBottom: '20px' }}
          >
            📁 Scegli Video
          </button>

          {videoFile && (
            <div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                ✅ {videoFile.name}
              </p>
              <video
                src={videoUrl}
                controls
                style={{
                  width: '100%',
                  maxWidth: '600px',
                  borderRadius: '8px',
                  marginBottom: '20px'
                }}
              />
              <button
                className="btn btn-primary"
                onClick={extractFrames}
              >
                🎬 Estrai Frame
              </button>
            </div>
          )}

          {extractedFrames.start && (
            <div style={{ marginTop: '30px' }}>
              <h3 style={{ marginBottom: '16px' }}>Frame Estratti:</h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px'
              }}>
                {['start', 'middle', 'end'].map((type) => (
                  <div key={type}>
                    <p style={{
                      marginBottom: '8px',
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      fontSize: '0.8rem'
                    }}>
                      {type}
                    </p>
                    <img
                      src={extractedFrames[type]}
                      alt={type}
                      style={{
                        width: '100%',
                        borderRadius: '8px',
                        border: '1px solid var(--border)'
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Extract Data & Generate Variants */}
      {currentStep >= 2 && (
        <div className="card" style={{ marginBottom: '40px' }}>
          <h2 style={{ marginBottom: '24px' }}>🤖 Step 2: Genera Varianti</h2>
          
          <button
            className="btn btn-primary"
            onClick={extractDataWithAI}
            style={{ marginBottom: '20px' }}
            disabled={extractedData.extracted}
          >
            {extractedData.extracted ? '✅ Dati Estratti' : '🔍 Estrai Dati con AI'}
          </button>

          {extractedData.extracted && (
            <div style={{ marginBottom: '30px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                  Numero Varianti:
                </label>
                <input
                  type="number"
                  className="input"
                  value={numVariants}
                  onChange={(e) => setNumVariants(parseInt(e.target.value))}
                  min="1"
                  max="10"
                  style={{ maxWidth: '200px' }}
                />
              </div>
              
              <button
                className="btn btn-primary"
                onClick={generateVariants}
              >
                ✨ Genera {numVariants} Varianti
              </button>
            </div>
          )}

          {variants.length > 0 && (
            <div style={{ marginTop: '30px' }}>
              <h3 style={{ marginBottom: '20px' }}>Varianti Generate:</h3>
              {variants.map((variant, index) => (
                <div
                  key={index}
                  className="card"
                  style={{ marginBottom: '20px' }}
                >
                  <h4 style={{ marginBottom: '12px' }}>
                    Variante {index + 1}
                  </h4>
                  <p style={{ marginBottom: '8px' }}>
                    <strong>Hook:</strong> {variant.hook}
                  </p>
                  <p style={{ marginBottom: '8px' }}>
                    <strong>Body:</strong> {variant.body}
                  </p>
                  <p style={{ marginBottom: '16px' }}>
                    <strong>CTA:</strong> {variant.cta}
                  </p>
                  
                  <button
                    className="btn btn-primary"
                    onClick={() => generate3Videos(variant, index)}
                  >
                    🎬 Genera 3 Video AI
                  </button>

                  {/* Show generated videos */}
                  {['start', 'middle', 'end'].some(type => 
                    generatedVideos[`${index}_${type}`]
                  ) && (
                    <div style={{
                      marginTop: '20px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '16px'
                    }}>
                      {['start', 'middle', 'end'].map((type) => {
                        const videoKey = `${index}_${type}`
                        const video = generatedVideos[videoKey]
                        
                        if (!video) return null

                        return (
                          <div key={type}>
                            <p style={{
                              marginBottom: '8px',
                              color: 'var(--accent-primary)',
                              textTransform: 'uppercase',
                              fontSize: '0.8rem',
                              fontWeight: 'bold'
                            }}>
                              📍 {type}
                            </p>
                            
                            {video.status === 'generating' && (
                              <div style={{
                                padding: '40px',
                                background: 'var(--bg-tertiary)',
                                borderRadius: '8px',
                                textAlign: 'center'
                              }}>
                                ⏳ Generazione...
                              </div>
                            )}
                            
                            {video.status === 'completed' && (
                              <div>
                                <video
                                  src={video.videoUrl}
                                  controls
                                  style={{
                                    width: '100%',
                                    borderRadius: '8px',
                                    marginBottom: '8px'
                                  }}
                                />
                                <a
                                  href={video.videoUrl}
                                  download={`variant-${index + 1}-${type}.mp4`}
                                  className="btn btn-secondary"
                                  style={{
                                    width: '100%',
                                    textAlign: 'center',
                                    display: 'block',
                                    padding: '8px'
                                  }}
                                >
                                  📥 Download
                                </a>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
