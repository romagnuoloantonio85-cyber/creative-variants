import { useState, useRef, useEffect } from 'react'
import Head from 'next/head'

export default function App() {
            const [currentPage, setCurrentPage] = useState('main'); // 'main' or 'settings'
            const [currentStep, setCurrentStep] = useState(1);
            const [videoFile, setVideoFile] = useState(null);
            const [videoUrl, setVideoUrl] = useState(null);
            
            // API Keys
            const [apiKeys, setApiKeys] = useState(() => {
                // Load API keys from localStorage on startup
                try {
                    const keys = {
                        gemini: localStorage.getItem('api_key_gemini') || '',
                        openai: localStorage.getItem('api_key_openai') || '',
                        rapidapi: localStorage.getItem('api_key_rapidapi') || '',
                        piapi: localStorage.getItem('api_key_piapi') || '',
                        elevenlabs: localStorage.getItem('api_key_elevenlabs') || '',
                        claude: localStorage.getItem('api_key_claude') || '',
                        cloudinary_cloud_name: localStorage.getItem('api_key_cloudinary_cloud_name') || '',
                        cloudinary_upload_preset: localStorage.getItem('api_key_cloudinary_upload_preset') || ''
                    };
                    console.log('🔑 Loaded API keys from localStorage:', {
                        gemini: keys.gemini ? '✅ Present' : '❌ Missing',
                        openai: keys.openai ? '✅ Present' : '❌ Missing',
                        rapidapi: keys.rapidapi ? '✅ Present' : '❌ Missing',
                        piapi: keys.piapi ? '✅ Present' : '❌ Missing',
                        elevenlabs: keys.elevenlabs ? '✅ Present' : '❌ Missing',
                        claude: keys.claude ? '✅ Present' : '❌ Missing',
                        cloudinary_cloud_name: keys.cloudinary_cloud_name ? '✅ Present' : '❌ Missing',
                        cloudinary_upload_preset: keys.cloudinary_upload_preset ? '✅ Present' : '❌ Missing'
                    });
                    return keys;
                } catch (err) {
                    console.error('❌ Error loading API keys:', err);
                    return {
                        gemini: '',
                        openai: '',
                        rapidapi: '',
                        piapi: '',
                        elevenlabs: '',
                        claude: ''
                    };
                }
            });

            // Extracted data from video
            const [extractedData, setExtractedData] = useState({
                hook: '',
                description: '',      // Testo scritto visibile nel video
                speakeraggio: '',     // Audio parlato (da compilare manualmente o lasciare vuoto)
                cta: '',
                songName: '',
                extracted: false
            });

            const [extracting, setExtracting] = useState(false);
            
            const [config, setConfig] = useState({
                numVariants: 5,
                videoFormat: 'vertical',
                language: 'italiano',
                aiPrompt: 'UGC-style video showing a person enthusiastically presenting a product. Natural gestures, smartphone quality, direct to camera, TikTok aesthetic. Energetic and authentic presentation style.'
            });
            
            const [variants, setVariants] = useState([]);
            const [generating, setGenerating] = useState(false);
            
            // State per video AI generati
            const [generatedVideos, setGeneratedVideos] = useState({});
            const [generatingVideo, setGeneratingVideo] = useState(null); // Traccia quale variante sta generando
            // Formato: { variantIndex: { status: 'generating'|'completed'|'error', taskId: '...', videoUrl: '...', error: '...' } }
            
            // State per frame estratti dal video originale (per image-to-video generation)
            const [extractedFrames, setExtractedFrames] = useState({
                start: null,    // Frame iniziale (base64)
                middle: null,   // Frame centrale (base64)
                end: null       // Frame finale (base64)
            });
            
            const [toast, setToast] = useState(null);
            const fileInputRef = useRef(null);

            // Load API keys on mount
            useEffect(() => {
                const savedKeys = {
                    gemini: localStorage.getItem('api_key_gemini') || '',
                    acrcloud: localStorage.getItem('api_key_acrcloud') || '',
                    elevenlabs: localStorage.getItem('api_key_elevenlabs') || '',
                    claude: localStorage.getItem('api_key_claude') || ''
                };
                setApiKeys(savedKeys);
            }, []);

            const showToast = (message) => {
                setToast(message);
                setTimeout(() => setToast(null), 3000);
            };

            const saveApiKeys = () => {
                Object.keys(apiKeys).forEach(key => {
                    if (apiKeys[key].trim()) {
                        localStorage.setItem(`api_key_${key}`, apiKeys[key].trim());
                    }
                });
                showToast('✅ API Keys salvate');
                setCurrentPage('main');
            };

            const updateApiKey = (key, value) => {
                setApiKeys(prev => ({...prev, [key]: value}));
            };

            // Auto-save API keys to localStorage whenever they change
            useEffect(() => {
                Object.keys(apiKeys).forEach(key => {
                    if (apiKeys[key] && apiKeys[key].trim()) {
                        localStorage.setItem(`api_key_${key}`, apiKeys[key].trim());
                        console.log(`💾 Saved ${key} API key to localStorage`);
                    }
                });
            }, [apiKeys]);

            const handleFileUpload = (file) => {
                if (file && file.type.startsWith('video/')) {
                    setVideoFile(file);
                    setVideoUrl(URL.createObjectURL(file));
                    setCurrentStep(1);
                    showToast('✅ Video caricato con successo');
                } else {
                    showToast('⚠️ Per favore carica un file video valido');
                }
            };

            const handleDrop = (e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('dragover');
                const file = e.dataTransfer.files[0];
                handleFileUpload(file);
            };

            const handleDragOver = (e) => {
                e.preventDefault();
                e.currentTarget.classList.add('dragover');
            };

            const handleDragLeave = (e) => {
                e.currentTarget.classList.remove('dragover');
            };

            const compressVideo = async (file, targetSizeMB = 18) => {
                return new Promise((resolve, reject) => {
                    const video = document.createElement('video');
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    video.onloadedmetadata = () => {
                        // Set canvas size (reduce resolution to compress)
                        const scale = Math.sqrt((targetSizeMB * 1024 * 1024) / file.size);
                        canvas.width = video.videoWidth * Math.min(scale, 0.8);
                        canvas.height = video.videoHeight * Math.min(scale, 0.8);
                        
                        console.log(`📐 Original: ${video.videoWidth}x${video.videoHeight}`);
                        console.log(`📐 Compressed: ${canvas.width}x${canvas.height}`);
                        
                        const stream = canvas.captureStream(25); // 25 fps
                        const mediaRecorder = new MediaRecorder(stream, {
                            mimeType: 'video/webm;codecs=vp9',
                            videoBitsPerSecond: 1000000 // 1Mbps
                        });
                        
                        const chunks = [];
                        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
                        mediaRecorder.onstop = () => {
                            const blob = new Blob(chunks, { type: 'video/webm' });
                            console.log(`✅ Compressed from ${(file.size / 1024 / 1024).toFixed(2)}MB to ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
                            resolve(new File([blob], 'compressed.webm', { type: 'video/webm' }));
                        };
                        
                        mediaRecorder.start();
                        
                        video.play();
                        
                        const drawFrame = () => {
                            if (video.ended || video.paused) {
                                mediaRecorder.stop();
                                return;
                            }
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            requestAnimationFrame(drawFrame);
                        };
                        
                        drawFrame();
                    };
                    
                    video.onerror = () => reject(new Error('Video load error'));
                    video.src = URL.createObjectURL(file);
                    video.muted = true;
                });
            };

            const extractAudio = async (videoFile) => {
                return new Promise((resolve, reject) => {
                    console.log('🎵 Extracting audio from video...');
                    console.log('Video size:', (videoFile.size / 1024 / 1024).toFixed(2), 'MB');
                    
                    const video = document.createElement('video');
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    
                    video.onloadedmetadata = async () => {
                        try {
                            const source = audioContext.createMediaElementSource(video);
                            const dest = audioContext.createMediaStreamDestination();
                            source.connect(dest);
                            
                            const mediaRecorder = new MediaRecorder(dest.stream, {
                                mimeType: 'audio/webm;codecs=opus',
                                audioBitsPerSecond: 128000
                            });
                            
                            const chunks = [];
                            mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
                            mediaRecorder.onstop = () => {
                                const audioBlob = new Blob(chunks, { type: 'audio/webm' });
                                const audioFile = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
                                console.log('✅ Audio extracted:', (audioFile.size / 1024 / 1024).toFixed(2), 'MB');
                                resolve(audioFile);
                            };
                            
                            mediaRecorder.start();
                            video.play();
                            
                            video.onended = () => {
                                mediaRecorder.stop();
                                audioContext.close();
                            };
                        } catch (err) {
                            reject(err);
                        }
                    };
                    
                    video.onerror = () => reject(new Error('Video load error'));
                    video.src = URL.createObjectURL(videoFile);
                    video.muted = false;
                });
            };

            // Music Recognition with Shazam (via RapidAPI)
            const recognizeMusic = async (audioFile) => {
                if (!apiKeys.rapidapi) {
                    throw new Error('RapidAPI key not configured');
                }

                try {
                    console.log('🎵 Starting Shazam music recognition...');
                    console.log('Audio file size:', (audioFile.size / 1024 / 1024).toFixed(2), 'MB');

                    // Prepare form data
                    const formData = new FormData();
                    formData.append('upload_file', audioFile);

                    // Call Shazam API via RapidAPI
                    const response = await fetch('https://shazam.p.rapidapi.com/songs/v2/detect', {
                        method: 'POST',
                        headers: {
                            'X-RapidAPI-Key': apiKeys.rapidapi,
                            'X-RapidAPI-Host': 'shazam.p.rapidapi.com'
                        },
                        body: formData
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('❌ Shazam API error:', response.status, errorText);
                        throw new Error(`Shazam API error: ${response.status}`);
                    }

                    const data = await response.json();
                    console.log('Shazam response:', data);

                    // Parse Shazam response
                    if (data.track) {
                        const artist = data.track.subtitle || 'Unknown Artist';
                        const title = data.track.title || 'Unknown Title';
                        const result = `${artist} - ${title}`;
                        
                        console.log('✅ Music recognized:', result);
                        return result;
                    } else if (data.matches && data.matches.length > 0) {
                        // Alternative response format
                        const match = data.matches[0];
                        const artist = match.subtitle || 'Unknown Artist';
                        const title = match.title || 'Unknown Title';
                        const result = `${artist} - ${title}`;
                        
                        console.log('✅ Music recognized:', result);
                        return result;
                    } else {
                        console.log('⚠️ Music not recognized by Shazam');
                        return null;
                    }

                } catch (error) {
                    console.error('❌ Shazam error:', error);
                    throw error;
                }
            };

            // Extract key frames from video for image-to-video generation
            const extractKeyFrames = async (videoFile) => {
                return new Promise((resolve, reject) => {
                    try {
                        console.log('🎞️ Extracting key frames from video...');
                        
                        const video = document.createElement('video');
                        video.preload = 'metadata';
                        video.muted = true;
                        
                        const videoUrl = URL.createObjectURL(videoFile);
                        video.src = videoUrl;
                        
                        video.onloadedmetadata = async () => {
                            const duration = video.duration;
                            console.log('📊 Video duration:', duration, 'seconds');
                            
                            // Calculate frame positions
                            const startTime = Math.min(2, duration * 0.1);     // 2 sec or 10% of video
                            const middleTime = duration / 2;                    // Middle of video
                            const endTime = Math.max(duration - 2, duration * 0.9); // 2 sec before end or 90%
                            
                            console.log('📍 Frame positions:', {start: startTime, middle: middleTime, end: endTime});
                            
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d');
                            
                            // Function to capture frame at specific time
                            const captureFrame = (time) => {
                                return new Promise((res) => {
                                    video.currentTime = time;
                                    video.onseeked = () => {
                                        // Set canvas size to video dimensions
                                        canvas.width = video.videoWidth;
                                        canvas.height = video.videoHeight;
                                        
                                        // Draw video frame to canvas
                                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                                        
                                        // Convert to base64 (JPEG for smaller size)
                                        const frameBase64 = canvas.toDataURL('image/jpeg', 0.9);
                                        console.log(`✅ Frame at ${time.toFixed(1)}s captured (${(frameBase64.length / 1024).toFixed(1)}KB)`);
                                        res(frameBase64);
                                    };
                                });
                            };
                            
                            try {
                                // Capture all 3 frames
                                const startFrame = await captureFrame(startTime);
                                const middleFrame = await captureFrame(middleTime);
                                const endFrame = await captureFrame(endTime);
                                
                                const frames = {
                                    start: startFrame,
                                    middle: middleFrame,
                                    end: endFrame
                                };
                                
                                // Cleanup
                                URL.revokeObjectURL(videoUrl);
                                video.remove();
                                canvas.remove();
                                
                                console.log('✅ All 3 key frames extracted successfully!');
                                resolve(frames);
                                
                            } catch (error) {
                                console.error('❌ Error capturing frames:', error);
                                reject(error);
                            }
                        };
                        
                        video.onerror = (error) => {
                            console.error('❌ Video loading error:', error);
                            URL.revokeObjectURL(videoUrl);
                            reject(new Error('Failed to load video for frame extraction'));
                        };
                        
                    } catch (error) {
                        console.error('❌ Frame extraction error:', error);
                        reject(error);
                    }
                });
            };

            // Upload base64 image with Cloudinary or ImgBB fallback
            const uploadImageToCloudinary = async (base64Image) => {
                // TRY CLOUDINARY FIRST (if configured)
                if (apiKeys.cloudinary_cloud_name && apiKeys.cloudinary_upload_preset) {
                    try {
                        console.log('📤 Uploading frame to Cloudinary...');
                        
                        const formData = new FormData();
                        formData.append('file', base64Image);
                        formData.append('upload_preset', apiKeys.cloudinary_upload_preset);
                        
                        const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${apiKeys.cloudinary_cloud_name}/image/upload`;
                        
                        console.log('📤 Uploading to:', cloudinaryUrl);
                        console.log('📤 Using preset:', apiKeys.cloudinary_upload_preset);
                        
                        const response = await fetch(cloudinaryUrl, {
                            method: 'POST',
                            body: formData
                        });
                        
                        console.log('📡 Cloudinary response status:', response.status);
                        
                        if (response.ok) {
                            const data = await response.json();
                            console.log('✅ Cloudinary response:', data);
                            const imageUrl = data.secure_url;
                            console.log('✅ Frame uploaded to Cloudinary:', imageUrl);
                            return imageUrl;
                        } else {
                            const errorText = await response.text();
                            console.error('❌ Cloudinary error:', errorText);
                            console.log('🔄 Falling back to ImgBB...');
                        }
                    } catch (error) {
                        console.error('❌ Cloudinary upload error:', error);
                        console.log('🔄 Falling back to ImgBB...');
                    }
                } else {
                    console.log('⚠️ Cloudinary not configured, using ImgBB...');
                }
                
                // FALLBACK TO IMGBB
                try {
                    console.log('📤 Uploading frame to ImgBB...');
                    
                    // Remove data:image/...;base64, prefix if present
                    const base64Data = base64Image.split(',')[1] || base64Image;
                    
                    const formData = new FormData();
                    formData.append('image', base64Data);
                    
                    const response = await fetch('https://api.imgbb.com/1/upload?key=c6dd40ebb870dbb7dc8ef5a634dd1b0e', {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (!response.ok) {
                        throw new Error(`ImgBB upload failed: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    
                    if (data.success && data.data && data.data.url) {
                        const imageUrl = data.data.url;
                        console.log('✅ Frame uploaded to ImgBB:', imageUrl);
                        return imageUrl;
                    } else {
                        throw new Error('ImgBB response missing URL');
                    }
                    
                } catch (error) {
                    console.error('❌ ImgBB upload error:', error);
                    throw new Error(`Failed to upload frame: ${error.message}`);
                }
            };

            // Helper function to map videoFormat to Luma aspect_ratio
            const getAspectRatio = (videoFormat) => {
                const mapping = {
                    'vertical': '9:16',      // TikTok/Reels
                    'horizontal': '16:9',    // YouTube
                    'square': '1:1'          // Instagram Feed
                };
                return mapping[videoFormat] || '16:9'; // Default to horizontal
            };

            // Helper function to find video URL in various response structures
            const findVideoUrl = (statusData) => {
                let videoUrl = null;
                
                console.log('🔍 Finding video URL in response...');
                console.log('🔍 statusData.data exists:', !!statusData.data);
                console.log('🔍 statusData.output exists:', !!statusData.output);
                console.log('🔍 statusData.data.generation exists:', !!(statusData.data && statusData.data.generation));
                
                // Try all possible structures (PiAPI can return different formats)
                // PRIORITY 1: data.generation.video_raw (NEW - from API endpoint)
                if (statusData.data && statusData.data.generation && statusData.data.generation.video_raw && statusData.data.generation.video_raw.url) {
                    videoUrl = statusData.data.generation.video_raw.url;
                    console.log('✅ Found at: statusData.data.generation.video_raw.url');
                } else if (statusData.data && statusData.data.generation && statusData.data.generation.video_raw) {
                    videoUrl = statusData.data.generation.video_raw;
                    console.log('✅ Found at: statusData.data.generation.video_raw (string)');
                
                // PRIORITY 2: data.output.video_raw (from dashboard JSON)
                } else if (statusData.data && statusData.data.output && statusData.data.output.video_raw && statusData.data.output.video_raw.url) {
                    videoUrl = statusData.data.output.video_raw.url;
                    console.log('✅ Found at: statusData.data.output.video_raw.url');
                } else if (statusData.output && statusData.output.video_raw && statusData.output.video_raw.url) {
                    videoUrl = statusData.output.video_raw.url;
                    console.log('✅ Found at: statusData.output.video_raw.url (NO .data wrapper)');
                
                // PRIORITY 3: Direct video field (fallback)
                } else if (statusData.data && statusData.data.output && statusData.data.output.video) {
                    videoUrl = statusData.data.output.video;
                    console.log('✅ Found at: statusData.data.output.video');
                } else if (statusData.output && statusData.output.video) {
                    videoUrl = statusData.output.video;
                    console.log('✅ Found at: statusData.output.video (NO .data wrapper)');
                
                // PRIORITY 4: url field
                } else if (statusData.data && statusData.data.output && statusData.data.output.url) {
                    videoUrl = statusData.data.output.url;
                    console.log('✅ Found at: statusData.data.output.url');
                } else if (statusData.output && statusData.output.url) {
                    videoUrl = statusData.output.url;
                    console.log('✅ Found at: statusData.output.url (NO .data wrapper)');
                
                // PRIORITY 5: Other possible locations
                } else if (statusData.data && statusData.data.video_url) {
                    videoUrl = statusData.data.video_url;
                    console.log('✅ Found at: statusData.data.video_url');
                } else if (statusData.data && statusData.data.url) {
                    videoUrl = statusData.data.url;
                    console.log('✅ Found at: statusData.data.url');
                } else if (statusData.data && statusData.data.video) {
                    videoUrl = statusData.data.video;
                    console.log('✅ Found at: statusData.data.video');
                } else if (statusData.video) {
                    videoUrl = statusData.video;
                    console.log('✅ Found at: statusData.video');
                } else if (statusData.url) {
                    videoUrl = statusData.url;
                    console.log('✅ Found at: statusData.url');
                }
                
                // Validate URL
                if (videoUrl && typeof videoUrl === 'string' && videoUrl.length > 0) {
                    console.log('✅ Valid video URL found:', videoUrl);
                    return videoUrl;
                } else {
                    console.log('❌ Video URL is invalid or empty:', videoUrl);
                    return null;
                }
            };

            // GENERATE 3 VIDEOS FROM 3 FRAMES
            // NUOVA FUNZIONE: Genera 1 SOLO video dal frame centrale
            const generateSingleVideoFromMiddleFrame = async (variant, variantIndex) => {
                console.log('🎬 Generating 1 video from MIDDLE frame for variant', variantIndex);
                
                // Verifica che il frame centrale sia presente
                if (!extractedFrames.middle) {
                    throw new Error('Frame centrale non estratto! Ricarica il video.');
                }
                
                setGeneratingVideo(variantIndex); // Imposta lo stato come "in generazione"
                
                const aspectRatio = '9:16'; // SEMPRE 9:16 (verticale per TikTok/Reels)
                
                // Prompt basato sulla variante MA senza testo sullo schermo
                const customPrompt = `UGC-style vertical video showing a person enthusiastically presenting a product.
Scene content: ${variant.body || variant.hook || 'Product demonstration'}
Call-to-action message: ${variant.cta || 'Try it now'}
Visual style: Natural smartphone quality, authentic gestures, direct to camera, energetic presentation.
IMPORTANT: NO TEXT, NO WORDS, NO CAPTIONS visible on screen. Pure visual storytelling.
TikTok aesthetic, smooth motion, 5 seconds duration.`.trim();
                
                console.log('📝 Custom Prompt:', customPrompt);
                
                try {
                    showToast('🎬 Generazione video in corso...');
                    
                    // Genera il video con il frame centrale
                    const videoIndex = `${variantIndex}_single`;
                    
                    await generateVideoWithLuma(
                        variant,
                        videoIndex,
                        customPrompt,
                        aspectRatio,
                        'middle' // Usa il frame centrale
                    );
                    
                    console.log('✅ Video completato!');
                    showToast('✅ Video generato con successo!');
                    
                } catch (error) {
                    console.error('❌ Errore durante generazione video:', error);
                    throw error;
                } finally {
                    setGeneratingVideo(null); // Reset stato
                }
            };

            // TEST VIDEO GENERATION with public test images (bypassing upload)
            const testVideoGeneration = async (variantIndex) => {
                console.log('🎬 testVideoGeneration CALLED with variantIndex:', variantIndex);
                console.log('🔑 apiKeys.piapi:', apiKeys.piapi ? 'EXISTS' : 'MISSING');
                
                if (!apiKeys.piapi) {
                    console.error('❌ PiAPI key is missing!');
                    throw new Error('PiAPI key non configurata');
                }
                
                console.log('✅ PiAPI key verified, continuing...');

                // 3 test images from Unsplash (public URLs)
                // Immagine TEST fissa (sempre la stessa per risultati consistenti)
                const testImage = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'; // Headphones
                const startTime = Date.now();

                try {
                    console.log('🧪 TEST MODE: Using fixed test image (headphones):', testImage);
                    
                    // Aggiorna stato: iniziando test
                    setGeneratedVideos(prev => ({
                        ...prev,
                        [variantIndex]: {
                            status: 'generating',
                            taskId: null,
                            videoUrl: null,
                            error: null,
                            progress: 10,
                            progressMessage: '🧪 TEST MODE - Creazione task...',
                            elapsedTime: 0,
                            attempts: 0
                        }
                    }));
                    
                    // Test prompt - SEMPLIFICATO per 5 secondi
                    const prompt = `Product showcase video. Headphones on clean background. 
Smooth camera movement, professional lighting. 5 seconds duration. 
Simple and clean aesthetic.`;

                    console.log('📝 Test Prompt:', prompt);
                    console.log('🖼️ Using test image URL:', testImage);

                    // Create task with test image
                    const requestBody = {
                        prompt: prompt,
                        expand_prompt: true,
                        key_frames: {
                            frame0: {
                                type: "image",
                                url: testImage
                            }
                        }
                    };
                    
                    console.log('📤 Sending TEST request...');
                    console.log('📦 Request body:', JSON.stringify(requestBody, null, 2));

                    const createResponse = await fetch('https://api.piapi.ai/api/luma/v1/video', {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                            'X-API-Key': apiKeys.piapi
                        },
                        body: JSON.stringify(requestBody)
                    });
                    
                    console.log('📡 Create response status:', createResponse.status);

                    if (!createResponse.ok) {
                        const errorText = await createResponse.text();
                        console.error('❌ PiAPI create error:', createResponse.status, errorText);
                        throw new Error(`PiAPI error: ${createResponse.status} - ${errorText}`);
                    }

                    const createData = await createResponse.json();
                    console.log('✅ Task created - Full response:', JSON.stringify(createData, null, 2));

                    const taskId = createData.data.task_id;
                    
                    // Aggiorna con task ID
                    setGeneratedVideos(prev => ({
                        ...prev,
                        [variantIndex]: {
                            ...prev[variantIndex],
                            taskId: taskId,
                            progress: 15,
                            progressMessage: '🧪 TEST - AI sta generando video...',
                            elapsedTime: Math.round((Date.now() - startTime) / 1000)
                        }
                    }));

                    // Poll for completion (same as normal)
                    console.log('⏳ Polling task status...');
                    
                    const maxAttempts = 120; // 10 minuti max (5 sec * 120 = 600 sec)
                    let attempts = 0;
                    
                    while (attempts < maxAttempts) {
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        
                        attempts++;
                        const elapsed = Math.round((Date.now() - startTime) / 1000);
                        const estimatedProgress = Math.min(15 + (attempts / maxAttempts) * 80, 95);
                        
                        setGeneratedVideos(prev => ({
                            ...prev,
                            [variantIndex]: {
                                ...prev[variantIndex],
                                progress: Math.round(estimatedProgress),
                                progressMessage: `🧪 TEST - Generazione in corso... (${elapsed}s)`,
                                elapsedTime: elapsed,
                                attempts: attempts
                            }
                        }));
                        
                        const statusResponse = await fetch(`https://api.piapi.ai/api/luma/v1/video/${taskId}`, {
                            headers: {
                                'Accept': 'application/json',
                                'X-API-Key': apiKeys.piapi
                            }
                        });

                        if (!statusResponse.ok) {
                            console.error('❌ Status check error:', statusResponse.status);
                            throw new Error(`Status check failed: ${statusResponse.status}`);
                        }

                        const statusData = await statusResponse.json();
                        
                        // Log status corrente
                        const currentStatus = statusData.data?.status || statusData.status || 'unknown';
                        console.log(`📊 Check #${attempts} - Status: "${currentStatus}" (elapsed: ${elapsed}s)`);
                        
                        // Log completo ogni 10 tentativi
                        if (attempts % 10 === 0) {
                            console.log('📊 FULL RESPONSE:', JSON.stringify(statusData, null, 2));
                        }

                        // Check if completed (try both with and without .data wrapper)
                        const isCompleted = (statusData.data && statusData.data.status === 'completed') || 
                                          statusData.status === 'completed';
                        
                        console.log(`🔍 isCompleted check: ${isCompleted} (statusData.data?.status="${statusData.data?.status}", statusData.status="${statusData.status}")`);
                        
                        if (isCompleted) {
                            console.log('✅ Video completed! Checking output structure...');
                            console.log('📊 statusData:', statusData);
                            if (statusData.data) {
                                console.log('📊 statusData.data:', statusData.data);
                                console.log('📊 statusData.data.output:', statusData.data.output);
                            }
                            if (statusData.output) {
                                console.log('📊 statusData.output:', statusData.output);
                            }
                            console.log('📊 Available keys in statusData:', Object.keys(statusData));
                            
                            // Use helper function to find video URL
                            const videoUrl = findVideoUrl(statusData);
                            
                            if (!videoUrl) {
                                console.error('❌ Video URL NOT FOUND! Dump full object:');
                                console.error('statusData:', statusData);
                                console.error('Keys:', Object.keys(statusData));
                                throw new Error('Video URL not found in API response - check console for full dump');
                            }
                            
                            console.log('✅ Video URL found:', videoUrl);
                            
                            setGeneratedVideos(prev => ({
                                ...prev,
                                [variantIndex]: {
                                    status: 'completed',
                                    taskId: taskId,
                                    videoUrl: videoUrl,
                                    error: null,
                                    progress: 100,
                                    progressMessage: '🧪 TEST COMPLETATO! Video generato!',
                                    elapsedTime: Math.round((Date.now() - startTime) / 1000),
                                    attempts: attempts
                                }
                            }));
                            
                            return videoUrl;
                        } else if ((statusData.data && (statusData.data.status === 'failed' || statusData.data.status === 'error')) || 
                                   (statusData.status === 'failed' || statusData.status === 'error')) {
                            throw new Error('Video generation failed');
                        }
                    }
                    
                    throw new Error('Timeout: video generation took too long');

                } catch (error) {
                    console.error('❌ TEST generation error:', error);
                    console.error('❌ Error name:', error.name);
                    console.error('❌ Error message:', error.message);
                    console.error('❌ Error stack:', error.stack);
                    
                    alert(`TEST Error: ${error.message}\n\nCheck console for full stack trace.`);
                    
                    setGeneratedVideos(prev => ({
                        ...prev,
                        [variantIndex]: {
                            status: 'error',
                            taskId: prev[variantIndex]?.taskId || null,
                            videoUrl: null,
                            error: error.message,
                            progress: 0,
                            progressMessage: null,
                            elapsedTime: Math.round((Date.now() - startTime) / 1000),
                            attempts: 0
                        }
                    }));
                    
                    throw error;
                }
            };

            // Generate AI video with Luma via PiAPI (IMAGE-TO-VIDEO)
            const generateVideoWithLuma = async (variant, variantIndex, customPrompt = null, aspectRatio = null, frameType = 'middle') => {
                if (!apiKeys.piapi) {
                    throw new Error('PiAPI key non configurata');
                }
                
                // Seleziona il frame giusto in base a frameType
                let selectedFrame = null;
                if (frameType === 'start') {
                    selectedFrame = extractedFrames.start;
                } else if (frameType === 'middle') {
                    selectedFrame = extractedFrames.middle;
                } else if (frameType === 'end') {
                    selectedFrame = extractedFrames.end;
                }
                
                if (!selectedFrame) {
                    throw new Error(`Frame "${frameType}" non estratto dal video! Prova a ricaricare il video e ripetere l\'estrazione.`);
                }

                const startTime = Date.now();

                try {
                    console.log('🎬 Starting Luma AI IMAGE-TO-VIDEO generation for variant', variantIndex);
                    console.log('🖼️ Using frame:', frameType.toUpperCase());
                    console.log('📐 Aspect Ratio:', aspectRatio || 'default (16:9)');
                    console.log('📝 Using custom prompt:', !!customPrompt);
                    
                    // Aggiorna stato: iniziando upload frame
                    setGeneratedVideos(prev => ({
                        ...prev,
                        [variantIndex]: {
                            status: 'generating',
                            taskId: null,
                            videoUrl: null,
                            error: null,
                            progress: 0,
                            progressMessage: `Caricamento frame ${frameType}...`,
                            elapsedTime: 0,
                            attempts: 0,
                            frameType: frameType
                        }
                    }));
                    
                    // STEP 1: Upload frame to imgbb to get public URL
                    console.log(`📤 Uploading ${frameType} frame to imgbb for public URL...`);
                    const framePublicUrl = await uploadImageToCloudinary(selectedFrame);
                    console.log('✅ Frame public URL:', framePublicUrl);
                    
                    // Aggiorna: frame caricato
                    setGeneratedVideos(prev => ({
                        ...prev,
                        [variantIndex]: {
                            ...prev[variantIndex],
                            progress: 10,
                            progressMessage: `Frame ${frameType} caricato! Creazione task...`,
                            elapsedTime: Math.round((Date.now() - startTime) / 1000)
                        }
                    }));
                    
                    // Costruisci prompt: usa custom se fornito, altrimenti costruisci dal variant
                    const prompt = customPrompt || `Animate this image into a dynamic UGC-style video. 
Person enthusiastically presenting the product, saying: "${variant.hook}". 
${variant.speakeraggio || variant.description}. 
Natural gestures, authentic emotion, direct to camera, smartphone quality. 
Ending with: "${variant.cta}". 
Smooth motion, realistic animation, TikTok aesthetic.`;

                    console.log('📝 Prompt:', prompt);
                    console.log('🖼️ Using keyframe URL:', framePublicUrl);

                    // STEP 2: Create task with IMAGE-TO-VIDEO (keyframe)
                    const requestBody = {
                        prompt: prompt,
                        expand_prompt: true,
                        key_frames: {
                            frame0: {
                                type: "image",
                                url: framePublicUrl  // URL pubblico da imgbb!
                            }
                        }
                    };
                    
                    // Add aspect_ratio if provided
                    if (aspectRatio) {
                        requestBody.aspect_ratio = aspectRatio;
                        console.log('📐 Added aspect_ratio to request:', aspectRatio);
                    }
                    
                    console.log('📤 Sending request with keyframe URL...');
                    console.log('📦 Full request body:', JSON.stringify(requestBody, null, 2));

                    const createResponse = await fetch('https://api.piapi.ai/api/luma/v1/video', {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                            'X-API-Key': apiKeys.piapi
                        },
                        body: JSON.stringify(requestBody)
                    });
                    
                    console.log('📡 Create response status:', createResponse.status);

                    if (!createResponse.ok) {
                        const errorText = await createResponse.text();
                        console.error('❌ PiAPI create error:', createResponse.status, errorText);
                        console.error('📦 Request body was:', JSON.stringify(requestBody, null, 2));
                        throw new Error(`PiAPI error: ${createResponse.status} - ${errorText}`);
                    }

                    const createData = await createResponse.json();
                    console.log('✅ Task created - Full response:', JSON.stringify(createData, null, 2));

                    const taskId = createData.data.task_id;
                    
                    // Aggiorna con task ID
                    setGeneratedVideos(prev => ({
                        ...prev,
                        [variantIndex]: {
                            ...prev[variantIndex],
                            taskId: taskId,
                            progress: 15,
                            progressMessage: 'Task creato! AI sta generando video...',
                            elapsedTime: Math.round((Date.now() - startTime) / 1000)
                        }
                    }));

                    // STEP 3: Poll for completion
                    console.log('⏳ Polling task status...');
                    
                    const maxAttempts = 120; // 10 minuti max (5 sec * 120 = 600 sec)
                    let attempts = 0;
                    
                    while (attempts < maxAttempts) {
                        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
                        
                        attempts++;
                        const elapsed = Math.round((Date.now() - startTime) / 1000);
                        const estimatedProgress = Math.min(15 + (attempts / maxAttempts) * 80, 95);
                        
                        // Aggiorna progresso
                        setGeneratedVideos(prev => ({
                            ...prev,
                            [variantIndex]: {
                                ...prev[variantIndex],
                                progress: Math.round(estimatedProgress),
                                progressMessage: `Generazione in corso... (${elapsed}s)`,
                                elapsedTime: elapsed,
                                attempts: attempts
                            }
                        }));
                        
                        const statusResponse = await fetch(`https://api.piapi.ai/api/luma/v1/video/${taskId}`, {
                            headers: {
                                'Accept': 'application/json',
                                'X-API-Key': apiKeys.piapi
                            }
                        });

                        if (!statusResponse.ok) {
                            console.error('❌ Status check error:', statusResponse.status);
                            throw new Error(`Status check failed: ${statusResponse.status}`);
                        }

                        const statusData = await statusResponse.json();
                        console.log(`📊 Status check #${attempts + 1}:`, statusData);
                        console.log('📊 FULL RESPONSE JSON:', JSON.stringify(statusData, null, 2));

                        // Check if completed (try both with and without .data wrapper)
                        const isCompleted = (statusData.data && statusData.data.status === 'completed') || 
                                          statusData.status === 'completed';
                        
                        if (isCompleted) {
                            console.log('✅ Video completed! Checking output structure...');
                            console.log('📊 statusData:', statusData);
                            if (statusData.data) {
                                console.log('📊 statusData.data:', statusData.data);
                                console.log('📊 statusData.data.output:', statusData.data.output);
                            }
                            if (statusData.output) {
                                console.log('📊 statusData.output:', statusData.output);
                            }
                            console.log('📊 Available keys in statusData:', Object.keys(statusData));
                            
                            // Use helper function to find video URL
                            const videoUrl = findVideoUrl(statusData);
                            
                            if (!videoUrl) {
                                console.error('❌ Video URL NOT FOUND! Dump full object:');
                                console.error('statusData:', statusData);
                                console.error('Keys:', Object.keys(statusData));
                                throw new Error('Video URL not found in API response - check console for full dump');
                            }
                            
                            console.log('✅ Video URL found:', videoUrl);
                            
                            // Aggiorna stato: completato
                            setGeneratedVideos(prev => ({
                                ...prev,
                                [variantIndex]: {
                                    status: 'completed',
                                    taskId: taskId,
                                    videoUrl: videoUrl,
                                    error: null,
                                    progress: 100,
                                    progressMessage: 'Video generato con successo!',
                                    elapsedTime: Math.round((Date.now() - startTime) / 1000),
                                    attempts: attempts
                                }
                            }));
                            
                            return videoUrl;
                        } else if ((statusData.data && (statusData.data.status === 'failed' || statusData.data.status === 'error')) || 
                                   (statusData.status === 'failed' || statusData.status === 'error')) {
                            throw new Error('Video generation failed');
                        }
                        
                        attempts++;
                    }
                    
                    throw new Error('Timeout: video generation took too long');

                } catch (error) {
                    console.error('❌ Luma generation error:', error);
                    
                    // Aggiorna stato: errore
                    setGeneratedVideos(prev => ({
                        ...prev,
                        [variantIndex]: {
                            status: 'error',
                            taskId: prev[variantIndex]?.taskId || null,
                            videoUrl: null,
                            error: error.message
                        }
                    }));
                    
                    throw error;
                }
            };

            const transcribeWithWhisper = async (videoFile) => {
                if (!apiKeys.openai) {
                    throw new Error('OpenAI API key non configurata');
                }

                console.log('🎙️ Starting Whisper transcription...');
                
                const formData = new FormData();
                formData.append('file', videoFile);
                formData.append('model', 'whisper-1');
                formData.append('response_format', 'text');
                formData.append('language', 'en'); // Auto-detect, ma può essere specificato

                const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKeys.openai}`
                    },
                    body: formData
                });

                if (!response.ok) {
                    const error = await response.json();
                    console.error('❌ Whisper API error:', error);
                    throw new Error(error.error?.message || 'Whisper API error');
                }

                const transcription = await response.text();
                console.log('✅ Whisper transcription:', transcription);
                return transcription;
            };

            const extractVideoData = async () => {
                if (!apiKeys.gemini) {
                    showToast('⚠️ Configura Gemini API nelle impostazioni');
                    setCurrentPage('settings');
                    return;
                }

                setExtracting(true);
                
                let fileToProcess = videoFile;
                const maxSize = 20 * 1024 * 1024; // 20MB

                try {
                    // STEP 0: Extract key frames for image-to-video generation
                    if (apiKeys.piapi) {
                        showToast('🎞️ Estrazione frame dal video...');
                        console.log('🎞️ Starting frame extraction for Luma image-to-video...');
                        
                        try {
                            const frames = await extractKeyFrames(videoFile);
                            setExtractedFrames(frames);
                            showToast('✅ 3 frame estratti con successo!');
                            console.log('✅ Frames extracted and stored:', {
                                start: frames.start ? `${(frames.start.length / 1024).toFixed(1)}KB` : 'null',
                                middle: frames.middle ? `${(frames.middle.length / 1024).toFixed(1)}KB` : 'null',
                                end: frames.end ? `${(frames.end.length / 1024).toFixed(1)}KB` : 'null'
                            });
                        } catch (frameError) {
                            console.error('⚠️ Frame extraction failed:', frameError);
                            showToast('⚠️ Estrazione frame fallita - video generation potrebbe non funzionare');
                            // Continue anyway - user can still use text analysis
                        }
                    } else {
                        console.log('ℹ️ PiAPI not configured - skipping frame extraction');
                    }
                    
                    // STEP 1: Check if compression needed
                    if (videoFile.size > maxSize) {
                        showToast(`🔄 Video troppo grande (${(videoFile.size / 1024 / 1024).toFixed(1)}MB) - compressione in corso...`);
                        console.log('📦 Starting video compression...');
                        
                        fileToProcess = await compressVideo(videoFile);
                        
                        if (fileToProcess.size > maxSize) {
                            showToast('⚠️ Video ancora troppo grande dopo compressione - compila manualmente');
                            setExtractedData({
                                hook: '',
                                description: '',
                                speakeraggio: '',
                                cta: '',
                                songName: '',
                                extracted: true
                            });
                            setCurrentStep(2);
                            setExtracting(false);
                            return;
                        }
                        
                        showToast(`✅ Video compresso a ${(fileToProcess.size / 1024 / 1024).toFixed(1)}MB`);
                    }

                    console.log('📹 Starting video extraction...');
                    console.log('Video file size:', (fileToProcess.size / 1024 / 1024).toFixed(2), 'MB');
                    console.log('Video type:', fileToProcess.type);
                    
                    // Convert video to base64
                    const reader = new FileReader();
                    const videoBase64 = await new Promise((resolve, reject) => {
                        reader.onload = () => {
                            const base64 = reader.result.split(',')[1];
                            console.log('✅ Video converted to base64');
                            resolve(base64);
                        };
                        reader.onerror = (error) => {
                            console.error('❌ FileReader error:', error);
                            reject(error);
                        };
                        reader.readAsDataURL(fileToProcess);
                    });

                    // STEP 2: Gemini extraction - VISUAL TEXT ONLY (no audio transcription)
                    showToast('🔍 Estrazione elementi visivi...');
                    console.log('📤 Extracting visual elements...');

                    const extractionRequest = {
                        contents: [{
                            parts: [
                                {
                                    text: `Extract ONLY visible written text from this video (do NOT transcribe spoken audio).

Extract these 4 elements:

1. HOOK (first 0-3 seconds):
   - Text overlay/subtitle at video START
   - Include ALL emojis exactly (🔥😱💥⚡👉 etc.)
   - Keep original language
   - If no visible text: "NOT DETECTED"

2. DESCRIPTION (middle of video):
   - Text overlays/subtitles/captions visible during video
   - Include ALL emojis exactly (😍✨💯⚡ etc.)
   - Keep original language
   - If no visible text: "NOT DETECTED"

3. CTA (last 3-5 seconds):
   - Text overlay/subtitle at video END
   - Include ALL emojis exactly (👉⬇️😍🔥✅ etc.)
   - Keep original language
   - This is CRITICAL: capture ALL emojis in CTA
   - If no visible text: "NOT DETECTED"

4. MUSIC:
   - Song name (artist + title) if recognizable
   - OR describe music type (e.g. "Energetic pop", "Hip hop")

CRITICAL RULES:
- Extract ONLY written text visible ON SCREEN
- Do NOT transcribe spoken audio
- Include ALL emojis EXACTLY as shown
- Preserve original language (Italian→Italian, English→English, etc.)

Respond with JSON only (no markdown):
{
  "hook": "exact text with emojis or NOT DETECTED",
  "description": "exact text with emojis or NOT DETECTED",
  "cta": "exact text with emojis or NOT DETECTED",
  "music": "song name or music type"
}`
                                },
                                {
                                    inlineData: {
                                        mimeType: fileToProcess.type,
                                        data: videoBase64
                                    }
                                }
                            ]
                        }]
                    };

                    const extractionResponse = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKeys.gemini}`,
                        {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                contents: extractionRequest.contents,
                                generationConfig: {
                                    temperature: 0.4,
                                    topK: 32,
                                    topP: 0.9,
                                    maxOutputTokens: 4096
                                }
                            })
                        }
                    );

                    console.log('Extraction response status:', extractionResponse.status);

                    if (!extractionResponse.ok) {
                        const errorData = await extractionResponse.json();
                        console.error('❌ Extraction API Error:', errorData);
                        
                        if (errorData.error?.message?.includes('quota')) {
                            showToast('⚠️ Quota API superata - compila manualmente');
                            setExtractedData({
                                hook: '',
                                description: '',
                                speakeraggio: '',
                                cta: '',
                                songName: '',
                                extracted: true
                            });
                            setCurrentStep(2);
                            setExtracting(false);
                            return;
                        }
                        
                        throw new Error(errorData.error?.message || `API Error: ${extractionResponse.status}`);
                    }

                    const extractionData = await extractionResponse.json();
                    console.log('✅ Extraction Response:', extractionData);

                    const extractionContent = extractionData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
                    console.log('📝 Raw extraction content:', extractionContent);
                    
                    const cleanContent = extractionContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
                    console.log('🧹 Cleaned content:', cleanContent);
                    
                    const result = JSON.parse(cleanContent);
                    console.log('✅ Parsed JSON:', result);

                    showToast('✅ Elementi visivi estratti!');

                    // STEP 3: Whisper transcription for speakeraggio (if OpenAI API key configured)
                    let speakeraggioText = '';
                    
                    if (apiKeys.openai) {
                        try {
                            showToast('🎵 Estrazione audio dal video...');
                            console.log('🎵 Extracting audio from original video...');
                            
                            // Extract audio from ORIGINAL video (not compressed - to preserve audio quality)
                            const audioFile = await extractAudio(videoFile);
                            console.log('✅ Audio extracted:', (audioFile.size / 1024 / 1024).toFixed(2), 'MB');
                            
                            showToast('🎙️ Trascrizione audio con Whisper...');
                            console.log('🎙️ Starting Whisper transcription...');
                            
                            const formData = new FormData();
                            formData.append('file', audioFile);
                            formData.append('model', 'whisper-1');
                            formData.append('response_format', 'text');

                            const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${apiKeys.openai}`
                                },
                                body: formData
                            });

                            if (!whisperResponse.ok) {
                                const error = await whisperResponse.json();
                                console.error('❌ Whisper API error:', error);
                                showToast('⚠️ Whisper fallito - compila manualmente');
                            } else {
                                speakeraggioText = await whisperResponse.text();
                                console.log('✅ Whisper transcription:', speakeraggioText);
                                showToast('✅ Speakeraggio estratto!');
                            }
                        } catch (whisperError) {
                            console.error('⚠️ Whisper exception:', whisperError);
                            showToast('⚠️ Errore Whisper - compila manualmente');
                        }
                    } else {
                        console.log('ℹ️ OpenAI API key not configured - skipping Whisper');
                        showToast('ℹ️ Configura OpenAI per trascrizione audio automatica');
                    }

                    // STEP 3.5: Shazam Music Recognition (if RapidAPI key configured)
                    let musicName = result.music || '';
                    
                    if (apiKeys.rapidapi) {
                        try {
                            showToast('🎵 Riconoscimento musica con Shazam...');
                            console.log('🎵 Starting Shazam music recognition...');
                            
                            // Extract audio if not already done (reuse if Whisper was executed)
                            let audioFileForMusic;
                            if (apiKeys.openai) {
                                // Reuse audio already extracted for Whisper
                                audioFileForMusic = await extractAudio(videoFile);
                            } else {
                                // Extract audio now
                                audioFileForMusic = await extractAudio(videoFile);
                            }
                            
                            const recognizedMusic = await recognizeMusic(audioFileForMusic);
                            
                            if (recognizedMusic) {
                                musicName = recognizedMusic;
                                console.log('✅ Music recognized by Shazam:', recognizedMusic);
                                showToast(`✅ Musica: ${recognizedMusic}`);
                            } else {
                                console.log('⚠️ Music not recognized by Shazam - using Gemini fallback');
                                showToast('⚠️ Musica non riconosciuta - uso descrizione');
                            }
                        } catch (musicError) {
                            console.error('⚠️ Shazam exception:', musicError);
                            console.log('📝 Using Gemini music description as fallback');
                            showToast('⚠️ Riconoscimento musica fallito - uso descrizione');
                        }
                    } else {
                        console.log('ℹ️ RapidAPI not configured - using Gemini music description');
                    }

                    // STEP 4: Combine results from Gemini + Whisper + Shazam
                    const extractedResult = {
                        hook: result.hook === "NOT DETECTED" ? '' : result.hook,
                        description: result.description === "NOT DETECTED" ? '' : result.description,
                        speakeraggio: speakeraggioText.trim(),
                        cta: result.cta === "NOT DETECTED" ? '' : result.cta,
                        songName: musicName,
                        extracted: true
                    };

                    console.log('🎯 Final extracted data:', extractedResult);

                    setExtractedData(extractedResult);
                    showToast('✅ Estrazione completata!');
                    setCurrentStep(2);

                } catch (error) {
                    console.error('❌ ERRORE COMPLETO:', error);
                    console.error('Error message:', error.message);
                    
                    let errorMsg = 'Errore sconosciuto';
                    if (error.message.includes('API_KEY_INVALID')) {
                        errorMsg = 'API Key non valida';
                    } else if (error.message.includes('quota')) {
                        errorMsg = 'Quota API superata';
                    } else if (error.message.includes('Failed to fetch')) {
                        errorMsg = 'Errore di connessione';
                    } else {
                        errorMsg = error.message;
                    }
                    
                    showToast(`⚠️ ${errorMsg} - compila manualmente`);
                    
                    // Fallback to manual input
                    setExtractedData({
                        hook: '',
                        description: '',
                        speakeraggio: '',
                        cta: '',
                        songName: '',
                        extracted: true
                    });
                    setCurrentStep(2);
                } finally {
                    setExtracting(false);
                }
            };

            const generateVariants = async () => {
                setGenerating(true);
                showToast('⚡ Generazione varianti...');

                try {
                    console.log('🚀 Starting variant generation...');
                    console.log('Config:', config);
                    console.log('Extracted data:', extractedData);

                    // Using Claude API integrated in claude.ai (no API key needed)
                    const response = await fetch("https://api.anthropic.com/v1/messages", {
                        method: "POST",
                        headers: { 
                            "Content-Type": "application/json"
                            // NO API KEY - handled automatically in claude.ai
                        },
                        body: JSON.stringify({
                            model: "claude-sonnet-4-20250514",
                            max_tokens: 4000,
                            messages: [{
                                role: "user",
                                content: `Genera ${config.numVariants} varianti PERSUASIVE per creative video TikTok/Meta Ads.

LINGUA: Genera TUTTE le varianti in ${config.language.toUpperCase()}. È fondamentale che TUTTO il testo sia in ${config.language}.

DATI ESTRATTI DAL VIDEO ORIGINALE:
Hook originale: ${extractedData.hook || 'N/A'}
Descrizione (testo scritto): ${extractedData.description || 'N/A'}
Speakeraggio originale (audio parlato): ${extractedData.speakeraggio || 'N/A'}
CTA originale: ${extractedData.cta || 'N/A'}
Musica: ${extractedData.songName || 'N/A'}

ANALISI RICHIESTA:
Analizza il contenuto originale e identifica:
- Il prodotto/servizio di cui si parla
- Il problema che risolve
- I benefici principali
- Il pubblico target
- Il tono emotivo (entusiasta, rassicurante, urgente, etc.)

OBIETTIVO:
Crea ${config.numVariants} varianti COMPLETAMENTE DIVERSE tra loro, ciascuna con un ANGOLO MARKETING specifico e persuasivo:
- Problema/Soluzione (evidenzia il dolore e la soluzione)
- Prova sociale (numeri, testimonianze, popolarità)
- Urgenza/Scarsità (tempo limitato, quantità limitate)
- Beneficio principale (risultato finale desiderato)
- Educativo/How-to (insegna qualcosa di utile)
- Emozionale (gioca su sogni e aspirazioni)
- Confronto/Superiorità (meglio delle alternative)
- Trasformazione (prima/dopo, cambiamento)

STRUTTURA OGNI VARIANTE CON TUTTI I CAMPI:

1. **Hook** (2-3 sec, max 10 parole):
   - Frase d'impatto che ferma lo scroll
   - Deve riflettere l'angolo marketing scelto
   - In ${config.language}

2. **Body/Descrizione** (15-25 parole):
   - Sviluppa l'angolo del hook
   - Beneficio chiave o problema risolto
   - Specifico e concreto, NON generico
   - In ${config.language}

3. **Speakeraggio** (30-50 parole):
   - Testo audio parlato che accompagna il video
   - Deve espandere e rinforzare hook + body
   - Linguaggio naturale e conversazionale come se una persona stesse parlando
   - Usa prima persona quando appropriato ("Non ci credevo, ma...", "L'ho provato e...")
   - Includi dettagli persuasivi e specifici
   - In ${config.language}

4. **CTA** (1 frase breve):
   - Call-to-action chiara e persuasiva
   - Coerente con l'angolo marketing
   - Includi emoji pertinenti (👉 ⬇️ 😍 🔥 ✅ etc.)
   - In ${config.language}

5. **Music**: Mantieni "${extractedData.songName || 'Musica energica'}" (o suggerisci alternativa simile se appropriato)

REGOLE COPYWRITING:
- Usa principi di persuasione (urgenza, scarsità, prova sociale, reciprocità)
- Linguaggio diretto, colloquiale e specifico in ${config.language}
- NO testo generico o vago
- Ogni variante deve essere UNICA e distintiva
- Adatta tono culturale alla lingua (inglese più diretto, italiano più emozionale, danese più pratico)
- Usa numeri specifici quando possibile (es: "30 giorni", "5000+ clienti", "risultati in 48h")

Rispondi SOLO in JSON puro (NO markdown, NO backticks):
{
  "variants": [
    {
      "number": 1,
      "angle": "nome_angolo",
      "hook": "testo hook in ${config.language}",
      "body": "testo body/descrizione in ${config.language}",
      "speakeraggio": "testo audio parlato naturale in ${config.language}",
      "cta": "testo cta con emoji in ${config.language}",
      "music": "${extractedData.songName || 'Musica energica'}"
    }
  ]
}`
                            }]
                        })
                    });

                    console.log('Response status:', response.status);

                    if (!response.ok) {
                        const errorData = await response.json();
                        console.error('❌ API Error Response:', errorData);
                        throw new Error(`API Error: ${errorData.error?.message || response.status}`);
                    }

                    const data = await response.json();
                    console.log('✅ Claude Response:', data);

                    if (!data.content || !data.content[0] || !data.content[0].text) {
                        console.error('❌ Invalid response structure:', data);
                        throw new Error('Risposta API non valida');
                    }

                    const content = data.content[0].text.trim();
                    console.log('📝 Raw content:', content);

                    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                    console.log('🧹 Cleaned content:', cleanContent);

                    const parsed = JSON.parse(cleanContent);
                    console.log('✅ Parsed JSON:', parsed);

                    if (!parsed.variants || !Array.isArray(parsed.variants)) {
                        throw new Error('Formato risposta non valido - manca array variants');
                    }

                    setVariants(parsed.variants);
                    showToast(`✅ ${parsed.variants.length} varianti generate! Modificale se vuoi.`);
                    console.log('✅ Generation complete!');

                } catch (error) {
                    console.error('❌❌❌ ERRORE GENERAZIONE:', error);
                    console.error('Error type:', error.constructor.name);
                    console.error('Error message:', error.message);
                    
                    // FALLBACK: Generate DEMO variants ALWAYS
                    console.log('🎭 Generating DEMO variants as fallback...');
                    console.log('Generating with:', { count: config.numVariants, language: config.language, data: extractedData });
                    
                    const demoVariants = generateDemoVariants(config.numVariants, config.language, extractedData);
                    console.log('✅ Demo variants generated:', demoVariants);
                    
                    setVariants(demoVariants);
                    showToast('🎭 Varianti DEMO generate - modificale e poi conferma!');
                    
                } finally {
                    setGenerating(false);
                }
            };

            const generateDemoVariants = (count, language, data) => {
                const demoTemplates = {
                    italiano: [
                        {
                            angle: "Problema/Soluzione",
                            hook: "Stanco di perdere tempo?",
                            body: "Scopri come risparmiare ore ogni giorno con questo semplice trucco che nessuno ti ha mai detto.",
                            cta: "Prova gratis per 30 giorni"
                        },
                        {
                            angle: "Prova Sociale",
                            hook: "Oltre 50.000 persone lo usano già",
                            body: "Non essere l'ultimo a scoprire il segreto che sta cambiando la vita di migliaia di persone.",
                            cta: "Unisciti alla community"
                        },
                        {
                            angle: "Urgenza/Scarsità",
                            hook: "Solo per oggi: 50% di sconto",
                            body: "Ultima occasione per risparmiare. L'offerta scade tra poche ore e non tornerà più.",
                            cta: "Approfitta ora dell'offerta"
                        },
                        {
                            angle: "Beneficio Principale",
                            hook: "Raddoppia i tuoi risultati",
                            body: "Sistema comprovato che ti permette di ottenere il doppio dei risultati in metà del tempo.",
                            cta: "Scopri come funziona"
                        },
                        {
                            angle: "Educativo",
                            hook: "Ecco cosa non sai ancora",
                            body: "3 segreti nascosti che i professionisti non vogliono che tu scopra. Guarda fino alla fine.",
                            cta: "Guarda il tutorial completo"
                        },
                        {
                            angle: "Emozionale",
                            hook: "Finalmente la soluzione che cercavi",
                            body: "Smetti di soffrire. Migliaia di persone hanno già cambiato la loro vita con questo metodo rivoluzionario.",
                            cta: "Inizia il cambiamento oggi"
                        },
                        {
                            angle: "Feature Tecnica",
                            hook: "Tecnologia brevettata mai vista prima",
                            body: "Sistema avanzato con certificazione europea che garantisce risultati superiori del 300%.",
                            cta: "Scopri la tecnologia"
                        },
                        {
                            angle: "Lifestyle",
                            hook: "La vita che hai sempre sognato",
                            body: "Immagina di svegliarti ogni giorno senza stress, con più tempo e libertà. Ora è possibile.",
                            cta: "Vivi la differenza"
                        },
                        {
                            angle: "Testimonianza",
                            hook: "\"Ha cambiato tutto per me\"",
                            body: "Maria, 34 anni, racconta come è passata da stressata a felice in solo 30 giorni.",
                            cta: "Leggi la storia completa"
                        },
                        {
                            angle: "Comparazione",
                            hook: "Meglio di qualsiasi alternativa",
                            body: "Confronto diretto: perché questo prodotto batte la concorrenza su tutti i fronti.",
                            cta: "Vedi il confronto"
                        }
                    ],
                    inglese: [
                        {
                            angle: "Problem/Solution",
                            hook: "Tired of wasting time?",
                            body: "Discover how to save hours every day with this simple trick nobody told you about.",
                            cta: "Try free for 30 days"
                        },
                        {
                            angle: "Social Proof",
                            hook: "50,000+ people already use this",
                            body: "Don't be the last to discover the secret that's changing thousands of lives right now.",
                            cta: "Join the community"
                        },
                        {
                            angle: "Urgency/Scarcity",
                            hook: "Today only: 50% off",
                            body: "Last chance to save. Offer expires in hours and won't come back.",
                            cta: "Grab the deal now"
                        },
                        {
                            angle: "Main Benefit",
                            hook: "Double your results",
                            body: "Proven system that lets you get twice the results in half the time.",
                            cta: "See how it works"
                        },
                        {
                            angle: "Educational",
                            hook: "Here's what you don't know yet",
                            body: "3 hidden secrets pros don't want you to find out. Watch till the end.",
                            cta: "Watch full tutorial"
                        },
                        {
                            angle: "Emotional",
                            hook: "Finally, the solution you've been searching for",
                            body: "Stop struggling. Thousands have already transformed their lives with this breakthrough method.",
                            cta: "Start your transformation"
                        },
                        {
                            angle: "Technical Feature",
                            hook: "Patented technology never seen before",
                            body: "Advanced system with European certification guaranteeing 300% better results.",
                            cta: "Discover the tech"
                        },
                        {
                            angle: "Lifestyle",
                            hook: "The life you've always dreamed of",
                            body: "Imagine waking up stress-free with more time and freedom. Now it's possible.",
                            cta: "Live the difference"
                        },
                        {
                            angle: "Testimonial",
                            hook: "\"It changed everything for me\"",
                            body: "Sarah, 34, shares how she went from stressed to happy in just 30 days.",
                            cta: "Read the full story"
                        },
                        {
                            angle: "Comparison",
                            hook: "Better than any alternative",
                            body: "Head-to-head: why this product beats the competition on every front.",
                            cta: "See the comparison"
                        }
                    ],
                    tedesco: [
                        {
                            angle: "Problem/Lösung",
                            hook: "Müde, Zeit zu verschwenden?",
                            body: "Entdecken Sie, wie Sie jeden Tag Stunden sparen mit diesem einfachen Trick.",
                            cta: "30 Tage kostenlos testen"
                        },
                        {
                            angle: "Sozialer Beweis",
                            hook: "Über 50.000 nutzen dies bereits",
                            body: "Seien Sie nicht der Letzte, der das Geheimnis entdeckt, das Tausende Leben verändert.",
                            cta: "Der Community beitreten"
                        },
                        {
                            angle: "Dringlichkeit",
                            hook: "Nur heute: 50% Rabatt",
                            body: "Letzte Chance zu sparen. Angebot läuft in Stunden ab.",
                            cta: "Jetzt Angebot sichern"
                        },
                        {
                            angle: "Hauptvorteil",
                            hook: "Verdoppeln Sie Ihre Ergebnisse",
                            body: "Bewährtes System für doppelte Resultate in der Hälfte der Zeit.",
                            cta: "Sehen Sie wie es funktioniert"
                        },
                        {
                            angle: "Bildung",
                            hook: "Das wissen Sie noch nicht",
                            body: "3 versteckte Geheimnisse, die Profis nicht wollen, dass Sie sie entdecken.",
                            cta: "Vollständiges Tutorial ansehen"
                        }
                    ],
                    spagnolo: [
                        {
                            angle: "Problema/Solución",
                            hook: "¿Cansado de perder tiempo?",
                            body: "Descubre cómo ahorrar horas cada día con este simple truco que nadie te contó.",
                            cta: "Prueba gratis 30 días"
                        },
                        {
                            angle: "Prueba Social",
                            hook: "Más de 50.000 ya lo usan",
                            body: "No seas el último en descubrir el secreto que está cambiando miles de vidas.",
                            cta: "Únete a la comunidad"
                        },
                        {
                            angle: "Urgencia",
                            hook: "Solo hoy: 50% de descuento",
                            body: "Última oportunidad para ahorrar. La oferta expira en horas.",
                            cta: "Aprovecha la oferta ahora"
                        },
                        {
                            angle: "Beneficio Principal",
                            hook: "Duplica tus resultados",
                            body: "Sistema comprobado que te permite obtener el doble de resultados en la mitad del tiempo.",
                            cta: "Ve cómo funciona"
                        },
                        {
                            angle: "Educativo",
                            hook: "Esto es lo que aún no sabes",
                            body: "3 secretos ocultos que los profesionales no quieren que descubras.",
                            cta: "Mira el tutorial completo"
                        }
                    ],
                    francese: [
                        {
                            angle: "Problème/Solution",
                            hook: "Fatigué de perdre du temps?",
                            body: "Découvrez comment économiser des heures chaque jour avec cette astuce simple.",
                            cta: "Essai gratuit 30 jours"
                        },
                        {
                            angle: "Preuve Sociale",
                            hook: "Plus de 50 000 l'utilisent déjà",
                            body: "Ne soyez pas le dernier à découvrir le secret qui change des milliers de vies.",
                            cta: "Rejoignez la communauté"
                        },
                        {
                            angle: "Urgence",
                            hook: "Aujourd'hui seulement: -50%",
                            body: "Dernière chance d'économiser. L'offre expire dans quelques heures.",
                            cta: "Profitez de l'offre maintenant"
                        },
                        {
                            angle: "Avantage Principal",
                            hook: "Doublez vos résultats",
                            body: "Système éprouvé pour obtenir le double de résultats en moitié moins de temps.",
                            cta: "Voyez comment ça marche"
                        },
                        {
                            angle: "Éducatif",
                            hook: "Voici ce que vous ne savez pas encore",
                            body: "3 secrets cachés que les pros ne veulent pas que vous découvriez.",
                            cta: "Regardez le tutoriel complet"
                        }
                    ],
                    olandese: [
                        {
                            angle: "Probleem/Oplossing",
                            hook: "Moe van tijd verspillen?",
                            body: "Ontdek hoe je elke dag uren bespaart met deze simpele truc die niemand je vertelde.",
                            cta: "Probeer 30 dagen gratis"
                        },
                        {
                            angle: "Sociaal Bewijs",
                            hook: "50.000+ mensen gebruiken dit al",
                            body: "Wees niet de laatste die het geheim ontdekt dat duizenden levens verandert.",
                            cta: "Word lid van de community"
                        },
                        {
                            angle: "Urgentie",
                            hook: "Alleen vandaag: 50% korting",
                            body: "Laatste kans om te besparen. Aanbieding verloopt binnen enkele uren.",
                            cta: "Grijp de deal nu"
                        }
                    ],
                    svedese: [
                        {
                            angle: "Problem/Lösning",
                            hook: "Trött på att slösa tid?",
                            body: "Upptäck hur du sparar timmar varje dag med detta enkla trick som ingen berättade för dig.",
                            cta: "Prova gratis i 30 dagar"
                        },
                        {
                            angle: "Socialt Bevis",
                            hook: "50 000+ personer använder redan detta",
                            body: "Var inte den sista att upptäcka hemligheten som förändrar tusentals liv.",
                            cta: "Gå med i communityn"
                        },
                        {
                            angle: "Brådska",
                            hook: "Endast idag: 50% rabatt",
                            body: "Sista chansen att spara. Erbjudandet går ut om några timmar.",
                            cta: "Ta erbjudandet nu"
                        }
                    ],
                    norvegese: [
                        {
                            angle: "Problem/Løsning",
                            hook: "Lei av å kaste bort tid?",
                            body: "Oppdag hvordan du sparer timer hver dag med dette enkle trikset ingen fortalte deg om.",
                            cta: "Prøv gratis i 30 dager"
                        },
                        {
                            angle: "Sosialt Bevis",
                            hook: "50 000+ bruker dette allerede",
                            body: "Ikke vær den siste til å oppdage hemmeligheten som endrer tusenvis av liv.",
                            cta: "Bli med i fellesskapet"
                        },
                        {
                            angle: "Hastverk",
                            hook: "Bare i dag: 50% rabatt",
                            body: "Siste sjanse til å spare. Tilbudet utløper om noen timer.",
                            cta: "Grip tilbudet nå"
                        }
                    ],
                    danese: [
                        {
                            angle: "Problem/Løsning",
                            hook: "Træt af at spilde tid?",
                            body: "Opdag hvordan du sparer timer hver dag med dette simple trick, ingen fortalte dig om.",
                            cta: "Prøv gratis i 30 dage"
                        },
                        {
                            angle: "Socialt Bevis",
                            hook: "50.000+ bruger allerede dette",
                            body: "Vær ikke den sidste til at opdage hemmeligheden, der ændrer tusindvis af liv.",
                            cta: "Bliv en del af fællesskabet"
                        },
                        {
                            angle: "Hastværk",
                            hook: "Kun i dag: 50% rabat",
                            body: "Sidste chance for at spare. Tilbuddet udløber om få timer.",
                            cta: "Grib tilbuddet nu"
                        }
                    ],
                    finlandese: [
                        {
                            angle: "Ongelma/Ratkaisu",
                            hook: "Kyllästynyt ajan tuhlaamiseen?",
                            body: "Löydä kuinka säästät tunteja joka päivä tällä yksinkertaisella tempulla, josta kukaan ei kertonut.",
                            cta: "Kokeile ilmaiseksi 30 päivää"
                        },
                        {
                            angle: "Sosiaalinen Todiste",
                            hook: "Yli 50 000 käyttää jo tätä",
                            body: "Älä ole viimeinen, joka löytää salaisuuden, joka muuttaa tuhansia elämä.",
                            cta: "Liity yhteisöön"
                        },
                        {
                            angle: "Kiire",
                            hook: "Vain tänään: 50% alennus",
                            body: "Viimeinen mahdollisuus säästää. Tarjous päättyy muutamassa tunnissa.",
                            cta: "Tartu tarjoukseen nyt"
                        }
                    ],
                    polacco: [
                        {
                            angle: "Problem/Rozwiązanie",
                            hook: "Zmęczony marnowaniem czasu?",
                            body: "Odkryj jak zaoszczędzić godziny każdego dnia dzięki tej prostej sztuczce, o której nikt ci nie powiedział.",
                            cta: "Wypróbuj za darmo przez 30 dni"
                        },
                        {
                            angle: "Dowód Społeczny",
                            hook: "Ponad 50 000 osób już tego używa",
                            body: "Nie bądź ostatni, który odkryje sekret zmieniający tysiące istnień.",
                            cta: "Dołącz do społeczności"
                        },
                        {
                            angle: "Pilność",
                            hook: "Tylko dziś: 50% zniżki",
                            body: "Ostatnia szansa na oszczędności. Oferta wygasa za kilka godzin.",
                            cta: "Złap okazję teraz"
                        }
                    ]
                };

                const templates = demoTemplates[language] || demoTemplates['inglese'];
                const selectedTemplates = templates.slice(0, count);
                
                // Generate REAL variants - use templates, don't copy data
                return selectedTemplates.map((template, index) => ({
                    number: index + 1,
                    angle: template.angle,
                    hook: template.hook,  // Use template hook
                    body: template.body,  // Use template body - DIFFERENT for each variant!
                    speakeraggio: template.speakeraggio || `${template.hook}. ${template.body} È davvero incredibile come questo possa fare la differenza nella tua vita quotidiana.`,  // Natural spoken text
                    cta: template.cta,    // Use template cta
                    music: data.songName || 'Musica energica'  // Only music comes from extracted data
                }));
            };

            const exportVariant = (variant) => {
                const content = `VARIANTE ${variant.number} - ${variant.angle.toUpperCase()}
Lingua: ${config.language.toUpperCase()}
========================

🎣 HOOK (0-3 sec):
${variant.hook}

📝 DESCRIZIONE (testo scritto):
${variant.body}

🎙️ SPEAKERAGGIO (audio parlato):
${variant.speakeraggio || 'Da definire'}

🎯 CTA (finale):
${variant.cta}

🎵 MUSICA:
${variant.music || extractedData.songName || 'Da definire'}

========================
DATI VIDEO ORIGINALE:
File: ${videoFile?.name || 'N/A'}
${extractedData.hook ? `Hook originale: ${extractedData.hook}` : ''}
${extractedData.description ? `Descrizione (testo): ${extractedData.description}` : ''}
${extractedData.speakeraggio ? `Speakeraggio (audio): ${extractedData.speakeraggio}` : ''}
${extractedData.cta ? `CTA originale: ${extractedData.cta}` : ''}
${extractedData.songName ? `Musica originale: ${extractedData.songName}` : ''}

CONFIG:
Formato: ${config.videoFormat === 'vertical' ? '9:16 (TikTok/Reels)' : config.videoFormat === 'square' ? '1:1 (Feed)' : '16:9 (Orizzontale)'}
Lingua: ${config.language}
`;
                const blob = new Blob([content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `variante_${variant.number}_${variant.angle}_${config.language}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showToast(`✅ Variante ${variant.number} esportata`);
            };

            const exportAll = () => {
                variants.forEach((variant, index) => {
                    setTimeout(() => exportVariant(variant), index * 100);
                });
                showToast(`✅ ${variants.length} varianti esportate!`);
            };

            // SETTINGS PAGE
            if (currentPage === 'settings') {
                return (
                    <div className="app">
                        <div className="header">
                            <h1>Impostazioni</h1>
                            <p className="subtitle">Configura le API keys per sbloccare tutte le funzionalità</p>
                            <button className="settings-btn" onClick={() => setCurrentPage('main')}>
                                ← Torna all'App
                            </button>
                        </div>

                        {toast && <div className="toast">{toast}</div>}

                        <div className="settings-page">
                            {/* Gemini API */}
                            <div className="settings-card">
                                <div className="settings-card-header">
                                    <div>
                                        <h2 style={{fontSize: '1.5rem', marginBottom: '8px'}}>🤖 Gemini API</h2>
                                        <p style={{color: 'var(--text-secondary)', fontSize: '0.95rem'}}>
                                            <strong>RICHIESTA</strong> - Analisi video + speech-to-text
                                        </p>
                                    </div>
                                    <div className={`status-badge ${apiKeys.gemini ? 'configured' : 'optional'}`}>
                                        <div className="status-dot"></div>
                                        {apiKeys.gemini ? 'Configurata' : 'Non configurata'}
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label>API Key</label>
                                    <input
                                        type="password"
                                        placeholder="AIza..."
                                        value={apiKeys.gemini}
                                        onChange={(e) => updateApiKey('gemini', e.target.value)}
                                    />
                                </div>
                                <a href="https://aistudio.google.com/app/apikey" target="_blank" className="btn btn-secondary btn-small" style={{marginTop: '12px'}}>
                                    🔗 Ottieni Gemini API Key (Gratis)
                                </a>
                                <p style={{marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)'}}>
                                    ℹ️ Free: 60 req/minuto, 1500 req/giorno
                                </p>
                            </div>

                            {/* OpenAI / Whisper API */}
                            <div className="settings-card">
                                <div className="settings-card-header">
                                    <div>
                                        <h2 style={{fontSize: '1.5rem', marginBottom: '8px'}}>🎙️ OpenAI Whisper API</h2>
                                        <p style={{color: 'var(--text-secondary)', fontSize: '0.95rem'}}>
                                            <strong>CONSIGLIATA</strong> - Trascrizione audio perfetta (99% accurato)
                                        </p>
                                    </div>
                                    <div className={`status-badge ${apiKeys.openai ? 'configured' : 'optional'}`}>
                                        <div className="status-dot"></div>
                                        {apiKeys.openai ? 'Configurata' : 'Opzionale'}
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label>API Key</label>
                                    <input
                                        type="password"
                                        placeholder="sk-..."
                                        value={apiKeys.openai}
                                        onChange={(e) => updateApiKey('openai', e.target.value)}
                                    />
                                </div>
                                <a href="https://platform.openai.com/api-keys" target="_blank" className="btn btn-secondary btn-small" style={{marginTop: '12px'}}>
                                    🔗 Ottieni OpenAI API Key
                                </a>
                                <p style={{marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)'}}>
                                    💰 Costo: €0.006/minuto (~€0.60 per 100 video)<br/>
                                    ⚡ Primi $5 gratis<br/>
                                    🎯 Precisione 99% - il migliore per speech-to-text
                                </p>
                            </div>

                            {/* Shazam via RapidAPI */}
                            <div className="settings-card">
                                <div className="settings-card-header">
                                    <div>
                                        <h2 style={{fontSize: '1.5rem', marginBottom: '8px'}}>🎵 Shazam (via RapidAPI)</h2>
                                        <p style={{color: 'var(--text-secondary)', fontSize: '0.95rem'}}>
                                            <strong>OPZIONALE</strong> - Riconoscimento musica automatico (artista + titolo)
                                        </p>
                                    </div>
                                    <div className={`status-badge ${apiKeys.rapidapi ? 'configured' : 'optional'}`}>
                                        <div className="status-dot"></div>
                                        {apiKeys.rapidapi ? 'Configurata' : 'Opzionale'}
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label>RapidAPI Key</label>
                                    <input
                                        type="password"
                                        placeholder="Your RapidAPI Key"
                                        value={apiKeys.rapidapi}
                                        onChange={(e) => updateApiKey('rapidapi', e.target.value)}
                                    />
                                </div>
                                <p style={{marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)'}}>
                                    💰 Costo: 500 riconoscimenti gratis/mese, poi €0.004/riconoscimento<br/>
                                    ⚡ Database Shazam: il più grande al mondo<br/>
                                    🔗 Ottieni la tua key su <a href="https://rapidapi.com/apidojo/api/shazam" target="_blank" style={{color: 'var(--accent-primary)'}}>RapidAPI → Shazam → Subscribe (Basic FREE)</a>
                                </p>
                            </div>

                            {/* PiAPI (Luma Dream Machine) */}
                            <div className="settings-card">
                                <div className="settings-card-header">
                                    <div>
                                        <h2 style={{fontSize: '1.5rem', marginBottom: '8px'}}>🎬 PiAPI (Luma AI Video Generation)</h2>
                                        <p style={{color: 'var(--text-secondary)', fontSize: '0.95rem'}}>
                                            <strong>OPZIONALE</strong> - Generazione video AI dalle varianti
                                        </p>
                                    </div>
                                    <div className={`status-badge ${apiKeys.piapi ? 'configured' : 'optional'}`}>
                                        <div className="status-dot"></div>
                                        {apiKeys.piapi ? 'Configurata' : 'Opzionale'}
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label>PiAPI Key</label>
                                    <input
                                        type="password"
                                        placeholder="Your PiAPI Key"
                                        value={apiKeys.piapi}
                                        onChange={(e) => updateApiKey('piapi', e.target.value)}
                                    />
                                </div>
                                <p style={{marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)'}}>
                                    💰 Costo: $0.20 per video generato (60% risparmio vs alternative!)<br/>
                                    🎥 Luma Dream Machine: Ray2 model, motion ultra-realistico<br/>
                                    ⚡ Genera video AI da 10 secondi dalle tue varianti<br/>
                                    🔗 Ottieni la tua key su <a href="https://piapi.ai" target="_blank" style={{color: 'var(--accent-primary)'}}>PiAPI.ai → Sign Up → Generate API Key</a>
                                </p>
                            </div>

                            {/* Cloudinary */}
                            <div className="settings-card">
                                <div className="settings-card-header">
                                    <div>
                                        <h2 style={{fontSize: '1.5rem', marginBottom: '8px'}}>☁️ Cloudinary</h2>
                                        <p style={{color: 'var(--text-secondary)', fontSize: '0.95rem'}}>
                                            <strong>RICHIESTO</strong> - Upload frame per generazione video
                                        </p>
                                    </div>
                                    <div className={`status-badge ${apiKeys.cloudinary_cloud_name && apiKeys.cloudinary_upload_preset ? 'active' : 'required'}`}>
                                        <div className="status-dot"></div>
                                        {apiKeys.cloudinary_cloud_name && apiKeys.cloudinary_upload_preset ? 'Configurato' : 'Richiesto'}
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label>Cloud Name</label>
                                    <input
                                        type="text"
                                        placeholder="es. dxxxxxxxxx"
                                        value={apiKeys.cloudinary_cloud_name}
                                        onChange={(e) => updateApiKey('cloudinary_cloud_name', e.target.value)}
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Upload Preset</label>
                                    <input
                                        type="text"
                                        placeholder="es. ml_default (unsigned preset)"
                                        value={apiKeys.cloudinary_upload_preset}
                                        onChange={(e) => updateApiKey('cloudinary_upload_preset', e.target.value)}
                                    />
                                </div>
                                <p style={{marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)'}}>
                                    ☁️ Cloudinary serve per caricare i frame estratti dal video<br/>
                                    🔗 Dashboard: <a href="https://cloudinary.com/console" target="_blank" style={{color: 'var(--accent-primary)'}}>cloudinary.com/console</a><br/>
                                    📋 <strong>Cloud Name:</strong> In alto a sinistra nella dashboard<br/>
                                    📋 <strong>Upload Preset:</strong> Settings → Upload → Upload presets → Crea "Unsigned" oppure usa esistente
                                </p>
                            </div>

                            {/* ElevenLabs */}
                            <div className="settings-card" style={{opacity: 0.6}}>
                                <div className="settings-card-header">
                                    <div>
                                        <h2 style={{fontSize: '1.5rem', marginBottom: '8px'}}>🎙️ ElevenLabs</h2>
                                        <p style={{color: 'var(--text-secondary)', fontSize: '0.95rem'}}>
                                            <strong>FUTURO</strong> - Text-to-Speech (in sviluppo)
                                        </p>
                                    </div>
                                    <div className="status-badge optional">
                                        <div className="status-dot"></div>
                                        Coming Soon
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label>API Key</label>
                                    <input type="password" placeholder="Non ancora attivo" disabled style={{opacity: 0.5}} />
                                </div>
                            </div>

                            <button className="btn btn-primary" onClick={saveApiKeys} style={{width: '100%', marginTop: '30px'}}>
                                💾 Salva Configurazione
                            </button>
                        </div>
                    </div>
                );
            }

            // MAIN APP
            return (
                <>
                    <Head>
                        <title>Creative Variants Generator Pro v1.1</title>
                        <meta name="description" content="AI Video Generation Platform" />
                        <link rel="icon" href="/favicon.ico" />
                        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Sora:wght@400;600;700;800&display=swap" rel="stylesheet" />
                    </Head>
                    <div className="app">
                    <div className="header">
                        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%'}}>
                            <div>
                                <h1>Creative Variants</h1>
                                <p className="subtitle">Genera varianti intelligenti delle tue creative video</p>
                            </div>
                            <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                                {/* TEST Button - Always visible */}
                                {apiKeys.piapi && (
                                    <>
                                    <button 
                                        className="btn btn-secondary"
                                        onClick={async () => {
                                            try {
                                                console.log('🔍 Testing PiAPI connection...');
                                                console.log('🔑 Using API key:', apiKeys.piapi.substring(0, 10) + '...');
                                                
                                                const testResponse = await fetch('https://api.piapi.ai/api/luma/v1/video', {
                                                    method: 'POST',
                                                    headers: {
                                                        'Accept': 'application/json',
                                                        'Content-Type': 'application/json',
                                                        'X-API-Key': apiKeys.piapi
                                                    },
                                                    body: JSON.stringify({
                                                        prompt: "Simple test",
                                                        expand_prompt: false
                                                    })
                                                });
                                                
                                                console.log('📡 Response status:', testResponse.status);
                                                
                                                if (testResponse.ok) {
                                                    const data = await testResponse.json();
                                                    console.log('✅ API Key VALID! Response:', data);
                                                    showToast('✅ PiAPI connection OK! API key is valid!');
                                                } else {
                                                    const errorText = await testResponse.text();
                                                    console.error('❌ API Error:', testResponse.status, errorText);
                                                    showToast(`❌ API Error ${testResponse.status}: Check console`);
                                                }
                                            } catch (error) {
                                                console.error('❌ Connection error:', error);
                                                showToast(`❌ Connection failed: ${error.message}`);
                                            }
                                        }}
                                        style={{
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            border: 'none',
                                            padding: '10px 20px',
                                            fontSize: '0.9rem',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        🔍 Test API Key
                                    </button>
                                    
                                    <button 
                                        className="btn btn-secondary"
                                        onClick={async () => {
                                            console.log('🚀 TEST Button clicked!');
                                            alert('TEST Button clicked! Check console.');
                                            
                                            try {
                                                console.log('🔑 Checking PiAPI key...');
                                                if (!apiKeys.piapi) {
                                                    alert('❌ PiAPI key missing! Go to Settings.');
                                                    throw new Error('PiAPI key not configured');
                                                }
                                                console.log('✅ PiAPI key exists:', apiKeys.piapi.substring(0, 10) + '...');
                                                
                                                console.log('📞 Calling testVideoGeneration(9999)...');
                                                showToast('🧪 TEST: Generazione con immagine di prova...');
                                                
                                                const result = await testVideoGeneration(9999);
                                                
                                                console.log('✅ testVideoGeneration returned:', result);
                                                showToast('✅ TEST completato! Controlla sotto.');
                                            } catch (error) {
                                                console.error('❌ TEST error caught:', error);
                                                console.error('❌ Full error:', error.stack);
                                                alert(`TEST failed: ${error.message}\nCheck console for details.`);
                                                showToast(`❌ TEST fallito: ${error.message}`);
                                            }
                                        }}
                                        style={{
                                            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                                            border: 'none',
                                            padding: '10px 20px',
                                            fontSize: '0.9rem',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        🧪 TEST Video API
                                    </button>
                                    </>
                                )}
                                <button className="settings-btn" onClick={() => setCurrentPage('settings')}>
                                    ⚙️ Impostazioni
                                </button>
                            </div>
                        </div>
                    </div>

                    {toast && <div className="toast">{toast}</div>}
                    
                    {/* TEST Video Result - Always visible when present */}
                    {generatedVideos[9999] && (
                        <div style={{
                            background: 'var(--bg-secondary)',
                            border: '2px solid var(--accent-primary)',
                            borderRadius: '12px',
                            padding: '20px',
                            marginBottom: '30px'
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '15px'
                            }}>
                                <h3 style={{margin: 0, fontSize: '1.2rem', color: 'var(--accent-primary)'}}>
                                    🧪 Risultato TEST Video API
                                </h3>
                                <button
                                    className="btn btn-small"
                                    onClick={() => {
                                        setGeneratedVideos(prev => {
                                            const newVideos = {...prev};
                                            delete newVideos[9999];
                                            return newVideos;
                                        });
                                    }}
                                    style={{background: 'transparent', border: '1px solid var(--border)', padding: '6px 12px'}}
                                >
                                    ✕ Chiudi
                                </button>
                            </div>
                            
                            {generatedVideos[9999].status === 'generating' ? (
                                <div>
                                    <div style={{fontSize: '2rem', textAlign: 'center', marginBottom: '10px'}}>⏳</div>
                                    <div style={{fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-primary)', textAlign: 'center', marginBottom: '12px'}}>
                                        {generatedVideos[9999].progress || 0}%
                                    </div>
                                    <div style={{width: '100%', height: '20px', background: 'var(--bg-tertiary)', borderRadius: '10px', overflow: 'hidden', marginBottom: '12px'}}>
                                        <div style={{width: `${generatedVideos[9999].progress || 0}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))', transition: 'width 0.3s ease'}}></div>
                                    </div>
                                    <div style={{textAlign: 'center', color: 'var(--text-secondary)'}}>
                                        {generatedVideos[9999].progressMessage || 'Generazione in corso...'}
                                    </div>
                                    {generatedVideos[9999].elapsedTime > 0 && (
                                        <div style={{marginTop: '10px', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)'}}>
                                            ⏱️ {generatedVideos[9999].elapsedTime}s | Tentativi: {generatedVideos[9999].attempts || 0}/60
                                        </div>
                                    )}
                                </div>
                            ) : generatedVideos[9999].status === 'completed' ? (
                                <div>
                                    <div style={{background: 'linear-gradient(135deg, #28a745, #20c997)', color: 'white', padding: '12px', borderRadius: '8px', marginBottom: '15px', textAlign: 'center'}}>
                                        <div style={{fontSize: '1.5rem'}}>✅</div>
                                        <div style={{fontWeight: 'bold'}}>TEST Completato con Successo!</div>
                                        <div style={{fontSize: '0.85rem', opacity: 0.9, marginTop: '4px'}}>
                                            ⏱️ Tempo: {generatedVideos[9999].elapsedTime}s | API Luma/PiAPI funziona!
                                        </div>
                                    </div>
                                    {generatedVideos[9999].videoUrl ? (
                                        <>
                                            <video src={generatedVideos[9999].videoUrl} controls style={{width: '100%', maxWidth: '600px', display: 'block', margin: '0 auto', borderRadius: '8px'}} />
                                            <div style={{marginTop: '15px', textAlign: 'center'}}>
                                                <a href={generatedVideos[9999].videoUrl} download="test-video.mp4" className="btn btn-primary">
                                                    📥 Download Test Video
                                                </a>
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{textAlign: 'center', padding: '20px', background: 'var(--bg-tertiary)', borderRadius: '8px'}}>
                                            ⚠️ Video URL non trovato nella risposta. Controlla la console per dettagli.
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{background: '#dc3545', color: 'white', padding: '15px', borderRadius: '8px', textAlign: 'center'}}>
                                    <div style={{fontSize: '2rem', marginBottom: '8px'}}>❌</div>
                                    <div style={{fontWeight: 'bold'}}>TEST Fallito</div>
                                    <div style={{fontSize: '0.9rem', marginTop: '8px'}}>{generatedVideos[9999].error}</div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="workflow">
                        {/* Step 1: Upload */}
                        <div className={`step ${currentStep >= 1 ? 'active' : ''}`}>
                            <div className="step-number">1</div>
                            <h3 className="step-title">Carica Video</h3>
                            <p className="step-description">
                                Carica la tua creative base. Supportiamo MP4, MOV, WEBM.
                            </p>
                            
                            {!videoFile ? (
                                <div 
                                    className="upload-zone"
                                    onClick={() => fileInputRef.current.click()}
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                >
                                    <div className="upload-icon">📹</div>
                                    <p><strong>Clicca per caricare</strong> o trascina qui</p>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="video/*"
                                        style={{display: 'none'}}
                                        onChange={(e) => handleFileUpload(e.target.files[0])}
                                    />
                                </div>
                            ) : (
                                <div>
                                    <video src={videoUrl} controls className="video-preview" />
                                    
                                    
                                    {/* EXTRACTION PANEL */}
                                    <div className="extraction-panel">
                                        <div style={{display: 'flex', gap: '8px', marginBottom: '16px'}}>
                                            <button 
                                                className="btn btn-primary btn-small"
                                                style={{flex: 1}}
                                                onClick={() => {
                                                    // Check API keys before extraction
                                                    if (!apiKeys.gemini) {
                                                        alert('⚠️ API KEY MANCANTE\n\nDevi configurare la Gemini API key nelle Settings per usare l\'estrazione automatica.\n\nVai su Settings → Inserisci Gemini API key → Salva');
                                                        setCurrentPage('settings');
                                                        return;
                                                    }
                                                    if (!apiKeys.openai) {
                                                        const confirm = window.confirm('⚠️ OpenAI API KEY MANCANTE\n\nPer la trascrizione audio automatica (speakeraggio) serve anche OpenAI API key.\n\nGemini estrarrà solo gli elementi visivi (hook, descrizione, CTA, musica).\n\nVuoi:\n• OK = Vai a Settings per configurare OpenAI\n• Annulla = Continua senza trascrizione audio');
                                                        if (confirm) {
                                                            setCurrentPage('settings');
                                                            return;
                                                        }
                                                    }
                                                    extractVideoData();
                                                }}
                                                disabled={extracting}
                                            >
                                                {extracting ? '⏳ Estrazione...' : '🔍 Estrai con AI'}
                                            </button>
                                            <button 
                                                className="btn btn-secondary btn-small"
                                                style={{flex: 1}}
                                                onClick={() => {
                                                    setExtractedData({
                                                        hook: '',
                                                        description: '',
                                                        speakeraggio: '',
                                                        cta: '',
                                                        songName: '',
                                                        extracted: true
                                                    });
                                                    setCurrentStep(2);
                                                }}
                                            >
                                                ✏️ Compila Manualmente
                                            </button>
                                        </div>

                                        {extractedData.extracted && (
                                            <>
                                                {/* Frame Estratti per Image-to-Video */}
                                                {(extractedFrames.start || extractedFrames.middle || extractedFrames.end) && (
                                                    <div style={{
                                                        background: 'var(--bg-secondary)',
                                                        border: '1px solid var(--border)',
                                                        borderRadius: '8px',
                                                        padding: '16px',
                                                        marginBottom: '20px'
                                                    }}>
                                                        <div style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            marginBottom: '12px'
                                                        }}>
                                                            <span style={{fontSize: '20px'}}>🎞️</span>
                                                            <h3 style={{margin: 0, fontSize: '16px', fontWeight: '600'}}>
                                                                Frame Estratti dal Video
                                                            </h3>
                                                            <span style={{
                                                                fontSize: '12px',
                                                                color: 'var(--text-secondary)',
                                                                marginLeft: 'auto'
                                                            }}>
                                                                Verranno usati per generare video AI
                                                            </span>
                                                        </div>
                                                        
                                                        <div style={{
                                                            display: 'grid',
                                                            gridTemplateColumns: 'repeat(3, 1fr)',
                                                            gap: '12px'
                                                        }}>
                                                            {/* Frame Inizio */}
                                                            {extractedFrames.start && (
                                                                <div style={{
                                                                    background: 'var(--bg-tertiary)',
                                                                    borderRadius: '6px',
                                                                    padding: '8px',
                                                                    textAlign: 'center'
                                                                }}>
                                                                    <div style={{
                                                                        fontSize: '11px',
                                                                        color: 'var(--text-secondary)',
                                                                        marginBottom: '6px',
                                                                        fontWeight: '500'
                                                                    }}>
                                                                        INIZIO
                                                                    </div>
                                                                    <img 
                                                                        src={extractedFrames.start} 
                                                                        alt="Frame iniziale"
                                                                        style={{
                                                                            width: '100%',
                                                                            borderRadius: '4px',
                                                                            border: '1px solid var(--border)'
                                                                        }}
                                                                    />
                                                                </div>
                                                            )}
                                                            
                                                            {/* Frame Metà */}
                                                            {extractedFrames.middle && (
                                                                <div style={{
                                                                    background: 'var(--bg-tertiary)',
                                                                    borderRadius: '6px',
                                                                    padding: '8px',
                                                                    textAlign: 'center',
                                                                    border: '2px solid var(--primary)'
                                                                }}>
                                                                    <div style={{
                                                                        fontSize: '11px',
                                                                        color: 'var(--primary)',
                                                                        marginBottom: '6px',
                                                                        fontWeight: '600'
                                                                    }}>
                                                                        METÀ (USATO) ✓
                                                                    </div>
                                                                    <img 
                                                                        src={extractedFrames.middle} 
                                                                        alt="Frame centrale"
                                                                        style={{
                                                                            width: '100%',
                                                                            borderRadius: '4px',
                                                                            border: '1px solid var(--border)'
                                                                        }}
                                                                    />
                                                                </div>
                                                            )}
                                                            
                                                            {/* Frame Fine */}
                                                            {extractedFrames.end && (
                                                                <div style={{
                                                                    background: 'var(--bg-tertiary)',
                                                                    borderRadius: '6px',
                                                                    padding: '8px',
                                                                    textAlign: 'center'
                                                                }}>
                                                                    <div style={{
                                                                        fontSize: '11px',
                                                                        color: 'var(--text-secondary)',
                                                                        marginBottom: '6px',
                                                                        fontWeight: '500'
                                                                    }}>
                                                                        FINE
                                                                    </div>
                                                                    <img 
                                                                        src={extractedFrames.end} 
                                                                        alt="Frame finale"
                                                                        style={{
                                                                            width: '100%',
                                                                            borderRadius: '4px',
                                                                            border: '1px solid var(--border)'
                                                                        }}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                        
                                                        <div style={{
                                                            marginTop: '12px',
                                                            fontSize: '12px',
                                                            color: 'var(--text-secondary)',
                                                            textAlign: 'center'
                                                        }}>
                                                            💡 Il frame centrale verrà usato come base per i video AI
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                <div className="extraction-grid">
                                                <div className={`extraction-item ${!extractedData.hook ? 'empty' : ''}`}>
                                                    <label>🎣 Hook</label>
                                                    <textarea
                                                        className="value"
                                                        value={extractedData.hook}
                                                        onChange={(e) => setExtractedData({...extractedData, hook: e.target.value})}
                                                        placeholder="Inserisci hook manualmente..."
                                                        style={{
                                                            width: '100%',
                                                            minHeight: '60px',
                                                            background: 'var(--bg-tertiary)',
                                                            border: '1px solid var(--border)',
                                                            borderRadius: '6px',
                                                            padding: '8px',
                                                            color: 'var(--text-primary)',
                                                            resize: 'vertical'
                                                        }}
                                                    />
                                                </div>
                                                <div className={`extraction-item ${!extractedData.description ? 'empty' : ''}`}>
                                                    <label>📝 Descrizione (testo scritto visibile)</label>
                                                    <textarea
                                                        className="value"
                                                        value={extractedData.description}
                                                        onChange={(e) => setExtractedData({...extractedData, description: e.target.value})}
                                                        placeholder="Testo scritto/sottotitoli visibili nel video..."
                                                        style={{
                                                            width: '100%',
                                                            minHeight: '60px',
                                                            background: 'var(--bg-tertiary)',
                                                            border: '1px solid var(--border)',
                                                            borderRadius: '6px',
                                                            padding: '8px',
                                                            color: 'var(--text-primary)',
                                                            resize: 'vertical'
                                                        }}
                                                    />
                                                </div>
                                                <div className={`extraction-item ${!extractedData.speakeraggio ? 'empty' : ''}`}>
                                                    <label>🎙️ Speakeraggio (audio parlato)</label>
                                                    <textarea
                                                        className="value"
                                                        value={extractedData.speakeraggio}
                                                        onChange={(e) => setExtractedData({...extractedData, speakeraggio: e.target.value})}
                                                        placeholder="Trascrizione di quello che viene detto (compila manualmente)..."
                                                        style={{
                                                            width: '100%',
                                                            minHeight: '80px',
                                                            background: 'var(--bg-tertiary)',
                                                            border: '1px solid var(--border)',
                                                            borderRadius: '6px',
                                                            padding: '8px',
                                                            color: 'var(--text-primary)',
                                                            resize: 'vertical'
                                                        }}
                                                    />
                                                </div>
                                                <div className={`extraction-item ${!extractedData.cta ? 'empty' : ''}`}>
                                                    <label>🎯 CTA</label>
                                                    <textarea
                                                        className="value"
                                                        value={extractedData.cta}
                                                        onChange={(e) => setExtractedData({...extractedData, cta: e.target.value})}
                                                        placeholder="Inserisci CTA manualmente..."
                                                        style={{
                                                            width: '100%',
                                                            minHeight: '60px',
                                                            background: 'var(--bg-tertiary)',
                                                            border: '1px solid var(--border)',
                                                            borderRadius: '6px',
                                                            padding: '8px',
                                                            color: 'var(--text-primary)',
                                                            resize: 'vertical'
                                                        }}
                                                    />
                                                </div>
                                                <div className={`extraction-item ${!extractedData.songName ? 'empty' : ''}`}>
                                                    <label>🎵 Musica</label>
                                                    <input
                                                        type="text"
                                                        className="value"
                                                        value={extractedData.songName}
                                                        onChange={(e) => setExtractedData({...extractedData, songName: e.target.value})}
                                                        placeholder="Inserisci nome canzone manualmente..."
                                                        style={{
                                                            width: '100%',
                                                            background: 'var(--bg-tertiary)',
                                                            border: '1px solid var(--border)',
                                                            borderRadius: '6px',
                                                            padding: '8px',
                                                            color: 'var(--text-primary)'
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            </>
                                        )}

                                        {extracting && (
                                            <div className="loading">
                                                <div className="spinner"></div>
                                                <p style={{fontSize: '0.9rem', color: 'var(--text-secondary)'}}>
                                                    Gemini sta analizzando il video...
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <button 
                                        className="btn btn-secondary btn-small"
                                        style={{marginTop: '12px', width: '100%'}}
                                        onClick={() => {
                                            // Reset all state
                                            setVariants([]);
                                            setExtractedData({
                                                hook: '',
                                                description: '',
                                                speakeraggio: '',
                                                cta: '',
                                                songName: '',
                                                extracted: false
                                            });
                                            setCurrentStep(1);
                                            setVideoFile(null);
                                            setVideoUrl(null);
                                            
                                            // Reset file input to allow selecting same file again
                                            if (fileInputRef.current) {
                                                fileInputRef.current.value = '';
                                            }
                                            
                                            console.log('🔄 Cambia Video - Reset complete');
                                        }}
                                    >
                                        🔄 Cambia Video
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Step 2: Configure */}
                        <div className={`step ${currentStep >= 2 ? 'active' : ''}`}>
                            <div className="step-number">2</div>
                            <h3 className="step-title">Configura & Genera</h3>
                            <p className="step-description">
                                Verifica i dati estratti, genera e modifica le varianti.
                            </p>

                            {/* Preview dati estratti */}
                            {extractedData.extracted && !generating && variants.length === 0 && (
                                <div style={{
                                    background: 'var(--bg-tertiary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    marginBottom: '20px'
                                }}>
                                    <h4 style={{fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)', marginBottom: '12px'}}>
                                        📋 Anteprima Dati Video
                                    </h4>
                                    <div style={{display: 'grid', gap: '8px', fontSize: '0.85rem'}}>
                                        <div>
                                            <strong style={{color: 'var(--accent-primary)'}}>Hook:</strong> 
                                            <span style={{marginLeft: '8px', color: 'var(--text-primary)'}}>
                                                {extractedData.hook || <em style={{color: 'var(--text-secondary)'}}>Non rilevato</em>}
                                            </span>
                                        </div>
                                        <div>
                                            <strong style={{color: 'var(--accent-primary)'}}>Descrizione (testo):</strong> 
                                            <span style={{marginLeft: '8px', color: 'var(--text-primary)'}}>
                                                {extractedData.description ? 
                                                    (extractedData.description.length > 60 ? 
                                                        extractedData.description.substring(0, 60) + '...' : 
                                                        extractedData.description
                                                    ) : 
                                                    <em style={{color: 'var(--text-secondary)'}}>Non rilevata</em>
                                                }
                                            </span>
                                        </div>
                                        <div>
                                            <strong style={{color: 'var(--accent-primary)'}}>Speakeraggio (audio):</strong> 
                                            <span style={{marginLeft: '8px', color: 'var(--text-primary)'}}>
                                                {extractedData.speakeraggio ? 
                                                    (extractedData.speakeraggio.length > 60 ? 
                                                        extractedData.speakeraggio.substring(0, 60) + '...' : 
                                                        extractedData.speakeraggio
                                                    ) : 
                                                    <em style={{color: 'var(--text-secondary)'}}>Non rilevato</em>
                                                }
                                            </span>
                                        </div>
                                        <div>
                                            <strong style={{color: 'var(--accent-primary)'}}>CTA:</strong> 
                                            <span style={{marginLeft: '8px', color: 'var(--text-primary)'}}>
                                                {extractedData.cta || <em style={{color: 'var(--text-secondary)'}}>Non rilevata</em>}
                                            </span>
                                        </div>
                                        <div>
                                            <strong style={{color: 'var(--accent-primary)'}}>Musica:</strong> 
                                            <span style={{marginLeft: '8px', color: 'var(--text-primary)'}}>
                                                {extractedData.songName || <em style={{color: 'var(--text-secondary)'}}>Non rilevata</em>}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        className="btn btn-secondary btn-small"
                                        style={{marginTop: '12px', width: '100%'}}
                                        onClick={() => {
                                            setCurrentStep(1);
                                            window.scrollTo(0, 0);
                                        }}
                                    >
                                        ✏️ Modifica Dati
                                    </button>
                                </div>
                            )}

                            {/* Config solo se non ci sono varianti */}
                            {!generating && variants.length === 0 && (
                                <>
                                    <div className="config-grid">
                                        <div className="input-group">
                                            <label>Numero Varianti</label>
                                            <select
                                                value={config.numVariants}
                                                onChange={(e) => setConfig({...config, numVariants: parseInt(e.target.value)})}
                                            >
                                                <option value={1}>1 variante</option>
                                                <option value={3}>3 varianti</option>
                                                <option value={5}>5 varianti</option>
                                            </select>
                                        </div>

                                        <div className="input-group">
                                            <label>Formato Output</label>
                                            <select
                                                value={config.videoFormat}
                                                onChange={(e) => setConfig({...config, videoFormat: e.target.value})}
                                            >
                                                <option value="vertical">Verticale 9:16 (TikTok/Reels)</option>
                                                <option value="square">Quadrato 1:1 (Feed)</option>
                                                <option value="horizontal">Orizzontale 16:9</option>
                                            </select>
                                        </div>

                                        <div className="input-group">
                                            <label>🌍 Lingua Output</label>
                                            <select
                                                value={config.language}
                                                onChange={(e) => setConfig({...config, language: e.target.value})}
                                            >
                                                <option value="italiano">🇮🇹 Italiano (Italy)</option>
                                                <option value="inglese">🇬🇧🇺🇸🇦🇺🇨🇦 Inglese (UK, US, Australia, Canada)</option>
                                                <option value="tedesco">🇩🇪🇦🇹 Tedesco (Germany, Austria)</option>
                                                <option value="spagnolo">🇪🇸 Spagnolo (Spain)</option>
                                                <option value="francese">🇫🇷🇧🇪🇨🇦 Francese (France, Belgium, Canada)</option>
                                                <option value="olandese">🇳🇱🇧🇪 Olandese (Netherlands, Belgium)</option>
                                                <option value="svedese">🇸🇪 Svedese (Sweden)</option>
                                                <option value="norvegese">🇳🇴 Norvegese (Norway)</option>
                                                <option value="danese">🇩🇰 Danese (Denmark)</option>
                                                <option value="finlandese">🇫🇮 Finlandese (Finland)</option>
                                                <option value="polacco">🇵🇱 Polacco (Poland)</option>
                                            </select>
                                        </div>

                                        <div className="input-group" style={{gridColumn: '1 / -1'}}>
                                            <label>🤖 Prompt AI per Generazione Video</label>
                                            <textarea
                                                value={config.aiPrompt}
                                                onChange={(e) => setConfig({...config, aiPrompt: e.target.value})}
                                                placeholder="Descrivi come vuoi che l'AI generi i video..."
                                                style={{
                                                    width: '100%',
                                                    minHeight: '100px',
                                                    background: 'var(--bg-tertiary)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: '8px',
                                                    padding: '12px',
                                                    color: 'var(--text-primary)',
                                                    fontSize: '0.9rem',
                                                    fontFamily: 'inherit',
                                                    resize: 'vertical'
                                                }}
                                            />
                                            <div style={{
                                                fontSize: '0.75rem',
                                                color: 'var(--text-secondary)',
                                                marginTop: '6px'
                                            }}>
                                                💡 Questo prompt verrà usato per generare tutti i video dai frame estratti. Il formato selezionato sopra (9:16, 16:9, 1:1) sarà applicato automaticamente.
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        className="btn btn-primary"
                                        style={{marginTop: '20px', width: '100%'}}
                                        onClick={generateVariants}
                                        disabled={!videoFile || !extractedData.extracted}
                                    >
                                        ⚡ Genera Varianti
                                    </button>
                                </>
                            )}

                            {/* Loading state */}
                            {generating && (
                                <div className="loading">
                                    <div className="spinner"></div>
                                    <p style={{fontSize: '1rem', marginBottom: '8px'}}>Claude sta generando {config.numVariants} varianti...</p>
                                    <p style={{fontSize: '0.9rem', color: 'var(--text-secondary)'}}>Basate sui dati estratti dal tuo video</p>
                                </div>
                            )}

                            {/* Varianti Preview - EDITABLE */}
                            {!generating && variants.length > 0 && (
                                <div>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom: '20px',
                                        paddingBottom: '16px',
                                        borderBottom: '2px solid var(--border)'
                                    }}>
                                        <h4 style={{fontSize: '1.3rem', fontWeight: '700', color: 'var(--accent-primary)'}}>
                                            ✨ {variants.length} Varianti Generate
                                        </h4>
                                        <div style={{display: 'flex', gap: '8px'}}>
                                            <button 
                                                className="btn btn-secondary btn-small"
                                                onClick={() => {
                                                    setVariants([]);
                                                    setCurrentStep(2);
                                                }}
                                            >
                                                🔄 Rigenera
                                            </button>
                                            <button 
                                                className="btn btn-primary btn-small"
                                                onClick={() => setCurrentStep(3)}
                                            >
                                                ✅ Conferma ed Esporta
                                            </button>
                                        </div>
                                    </div>

                                    <div className="variants-grid">
                                        {variants.map((variant, index) => (
                                            <div key={index} className="variant-card">
                                                <div className="variant-header">
                                                    <span className="variant-number">VARIANTE {variant.number}</span>
                                                    <span className="variant-type">{variant.angle}</span>
                                                </div>

                                                <div className="variant-section">
                                                    <h4>🎣 Hook (0-3 sec)</h4>
                                                    <textarea
                                                        value={variant.hook}
                                                        onChange={(e) => {
                                                            const newVariants = [...variants];
                                                            newVariants[index].hook = e.target.value;
                                                            setVariants(newVariants);
                                                        }}
                                                        style={{
                                                            width: '100%',
                                                            minHeight: '60px',
                                                            background: 'var(--bg-tertiary)',
                                                            border: '1px solid var(--border)',
                                                            borderRadius: '8px',
                                                            padding: '12px',
                                                            color: 'var(--text-primary)',
                                                            fontSize: '0.95rem',
                                                            lineHeight: '1.6',
                                                            resize: 'vertical',
                                                            fontFamily: 'inherit'
                                                        }}
                                                    />
                                                </div>

                                                <div className="variant-section">
                                                    <h4>📝 Body (3-18 sec)</h4>
                                                    <textarea
                                                        value={variant.body}
                                                        onChange={(e) => {
                                                            const newVariants = [...variants];
                                                            newVariants[index].body = e.target.value;
                                                            setVariants(newVariants);
                                                        }}
                                                        style={{
                                                            width: '100%',
                                                            minHeight: '80px',
                                                            background: 'var(--bg-tertiary)',
                                                            border: '1px solid var(--border)',
                                                            borderRadius: '8px',
                                                            padding: '12px',
                                                            color: 'var(--text-primary)',
                                                            fontSize: '0.95rem',
                                                            lineHeight: '1.6',
                                                            resize: 'vertical',
                                                            fontFamily: 'inherit'
                                                        }}
                                                    />
                                                </div>

                                                <div className="variant-section">
                                                    <h4>🎙️ Speakeraggio (audio parlato)</h4>
                                                    <textarea
                                                        value={variant.speakeraggio || ''}
                                                        onChange={(e) => {
                                                            const newVariants = [...variants];
                                                            newVariants[index].speakeraggio = e.target.value;
                                                            setVariants(newVariants);
                                                        }}
                                                        placeholder="Testo audio parlato naturale..."
                                                        style={{
                                                            width: '100%',
                                                            minHeight: '100px',
                                                            background: 'var(--bg-tertiary)',
                                                            border: '1px solid var(--border)',
                                                            borderRadius: '8px',
                                                            padding: '12px',
                                                            color: 'var(--text-primary)',
                                                            fontSize: '0.95rem',
                                                            lineHeight: '1.6',
                                                            resize: 'vertical',
                                                            fontFamily: 'inherit'
                                                        }}
                                                    />
                                                </div>

                                                <div className="variant-section">
                                                    <h4>🎯 CTA (18-20 sec)</h4>
                                                    <textarea
                                                        value={variant.cta}
                                                        onChange={(e) => {
                                                            const newVariants = [...variants];
                                                            newVariants[index].cta = e.target.value;
                                                            setVariants(newVariants);
                                                        }}
                                                        style={{
                                                            width: '100%',
                                                            minHeight: '60px',
                                                            background: 'var(--bg-tertiary)',
                                                            border: '1px solid var(--border)',
                                                            borderRadius: '8px',
                                                            padding: '12px',
                                                            color: 'var(--text-primary)',
                                                            fontSize: '0.95rem',
                                                            lineHeight: '1.6',
                                                            resize: 'vertical',
                                                            fontFamily: 'inherit'
                                                        }}
                                                    />
                                                </div>

                                                <div className="variant-section">
                                                    <h4>🎵 Musica</h4>
                                                    <input
                                                        type="text"
                                                        value={variant.music || extractedData.songName || ''}
                                                        onChange={(e) => {
                                                            const newVariants = [...variants];
                                                            newVariants[index].music = e.target.value;
                                                            setVariants(newVariants);
                                                        }}
                                                        placeholder="Nome canzone o tipo musica"
                                                        style={{
                                                            width: '100%',
                                                            background: 'var(--bg-tertiary)',
                                                            border: '1px solid var(--border)',
                                                            borderRadius: '8px',
                                                            padding: '12px',
                                                            color: 'var(--text-primary)',
                                                            fontSize: '0.95rem',
                                                            fontFamily: 'inherit'
                                                        }}
                                                    />
                                                </div>

                                                {/* AI Video Generation Section */}
                                                {apiKeys.piapi && (
                                                    <div className="variant-section" style={{
                                                        borderTop: '2px solid var(--accent-primary)',
                                                        paddingTop: '20px',
                                                        marginTop: '20px'
                                                    }}>
                                                        <h4>🎬 Video AI Generation (Luma)</h4>
                                                        
                                                        {!generatedVideos[`${index}_single`] ? (
                                                            <div style={{display: 'flex', gap: '10px', flexDirection: 'column'}}>
                                                                <button
                                                                    className="btn btn-primary"
                                                                    onClick={async () => {
                                                                        try {
                                                                            showToast('🎬 Generazione video AI avviata...');
                                                                            await generateSingleVideoFromMiddleFrame(variant, index);
                                                                            showToast('✅ Video AI generato!');
                                                                        } catch (error) {
                                                                            showToast(`❌ Errore: ${error.message}`);
                                                                        }
                                                                    }}
                                                                    style={{width: '100%'}}
                                                                    disabled={generatingVideo === index}
                                                                >
                                                                    {generatingVideo === index ? '⏳ Generazione in corso...' : '🎬 Genera Video AI (9:16)'}
                                                                </button>
                                                                
                                                                <button
                                                                    className="btn btn-secondary"
                                                                    onClick={async () => {
                                                                        try {
                                                                            showToast('🧪 TEST: Generazione con immagine di prova...');
                                                                            await testVideoGeneration(index);
                                                                            showToast('✅ TEST completato con successo!');
                                                                        } catch (error) {
                                                                            showToast(`❌ TEST fallito: ${error.message}`);
                                                                        }
                                                                    }}
                                                                    style={{
                                                                        width: '100%',
                                                                        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                                                                        border: 'none'
                                                                    }}
                                                                >
                                                                    🧪 TEST Video (con immagine casuale)
                                                                </button>
                                                                
                                                                <div style={{
                                                                    fontSize: '0.75rem',
                                                                    color: 'var(--text-secondary)',
                                                                    textAlign: 'center',
                                                                    padding: '8px',
                                                                    background: 'var(--bg-tertiary)',
                                                                    borderRadius: '6px',
                                                                    marginTop: '4px'
                                                                }}>
                                                                    💡 <strong>TEST:</strong> Usa un'immagine pubblica per verificare che l'API funzioni (bypassa upload frame)
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div style={{
                                                                padding: '20px',
                                                                background: 'var(--bg-secondary)',
                                                                borderRadius: '8px',
                                                                border: '2px solid var(--accent-success)',
                                                                textAlign: 'center'
                                                            }}>
                                                                {generatedVideos[`${index}_single`] && generatedVideos[`${index}_single`].videoUrl ? (
                                                                    // Video completato - mostra preview + download
                                                                    <>
                                                                        <div style={{fontSize: '1.5rem', marginBottom: '12px'}}>✅</div>
                                                                        <div style={{fontWeight: 'bold', marginBottom: '16px', color: 'var(--accent-success)'}}>
                                                                            Video AI generato con successo!
                                                                        </div>
                                                                        
                                                                        {/* Preview video */}
                                                                        <video 
                                                                            controls 
                                                                            style={{
                                                                                width: '100%',
                                                                                maxWidth: '300px',
                                                                                borderRadius: '8px',
                                                                                marginBottom: '16px'
                                                                            }}
                                                                            src={generatedVideos[`${index}_single`].videoUrl}
                                                                        />
                                                                        
                                                                        {/* Bottone DOWNLOAD */}
                                                                        <a
                                                                            href={generatedVideos[`${index}_single`].videoUrl}
                                                                            download={`visionclearpro_video_${index + 1}.mp4`}
                                                                            className="btn btn-primary"
                                                                            style={{
                                                                                display: 'inline-block',
                                                                                width: '100%',
                                                                                maxWidth: '300px',
                                                                                textDecoration: 'none'
                                                                            }}
                                                                        >
                                                                            📥 Scarica Video
                                                                        </a>
                                                                    </>
                                                                ) : (
                                                                    // Generazione in corso
                                                                    <>
                                                                        <div style={{fontSize: '1.5rem', marginBottom: '12px'}}>⏳</div>
                                                                        <div style={{fontWeight: 'bold', marginBottom: '8px'}}>
                                                                            Generazione video in corso...
                                                                        </div>
                                                                        <div style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}>
                                                                            {generatedVideos[`${index}_single`]?.progressMessage || 'Attendi circa 2-3 minuti'}
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <div style={{marginTop: '30px', textAlign: 'center'}}>
                                        <button 
                                            className="btn btn-primary"
                                            style={{width: '100%', maxWidth: '400px'}}
                                            onClick={() => setCurrentStep(3)}
                                        >
                                            ✅ Conferma Varianti ed Esporta
                                        </button>
                                    </div>
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
                                    <button
                                        className="btn btn-primary"
                                        style={{width: '100%', marginBottom: '20px'}}
                                        onClick={exportAll}
                                    >
                                        📦 Esporta Tutte ({variants.length} varianti)
                                    </button>

                                    <div style={{marginTop: '20px'}}>
                                        <h4 style={{fontSize: '1rem', marginBottom: '16px', color: 'var(--text-secondary)'}}>
                                            O esporta singolarmente:
                                        </h4>
                                        <div style={{display: 'grid', gap: '12px'}}>
                                            {variants.map((variant, index) => (
                                                <div key={index} style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '16px',
                                                    background: 'var(--bg-tertiary)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: '8px'
                                                }}>
                                                    <div>
                                                        <strong style={{color: 'var(--accent-primary)'}}>
                                                            Variante {variant.number}
                                                        </strong>
                                                        <span style={{marginLeft: '12px', color: 'var(--text-secondary)', fontSize: '0.85rem'}}>
                                                            {variant.angle}
                                                        </span>
                                                    </div>
                                                    <button
                                                        className="btn btn-secondary btn-small"
                                                        onClick={() => exportVariant(variant)}
                                                    >
                                                        💾 Esporta
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <button
                                        className="btn btn-secondary"
                                        style={{width: '100%', marginTop: '30px'}}
                                        onClick={() => {
                                            // Reset all state
                                            setVariants([]);
                                            setExtractedData({
                                                hook: '',
                                                description: '',
                                                speakeraggio: '',
                                                cta: '',
                                                songName: '',
                                                extracted: false
                                            });
                                            setCurrentStep(1);
                                            setVideoFile(null);
                                            setVideoUrl(null);
                                            
                                            // Reset file input to allow selecting same file again
                                            if (fileInputRef.current) {
                                                fileInputRef.current.value = '';
                                            }
                                            
                                            console.log('🔄 Reset complete - ready for new video');
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


        :root {
            --bg-primary: #0a0e14;
            --bg-secondary: #151b23;
            --bg-tertiary: #1e2630;
            --accent-primary: #00ff88;
            --accent-secondary: #00d4ff;
            --accent-danger: #ff3366;
            --accent-purple: #a78bfa;
            --text-primary: #e6eef9;
            --text-secondary: #8b95a8;
            --border: rgba(255, 255, 255, 0.08);
            --shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Sora', sans-serif;
            background: linear-gradient(135deg, var(--bg-primary) 0%, #0d1219 100%);
            color: var(--text-primary);
            min-height: 100vh;
            overflow-x: hidden;
        }

        .app {
            margin: 0 auto;
            padding: 40px 20px;
        }

        .header {
            text-align: center;
            margin-bottom: 60px;
            position: relative;
        }
        
        /* Header responsive con bottoni */
        .header > div {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 20px;
        }
        
        .header > div > div:first-child {
            flex: 1;
            min-width: 300px;
        }
        
        @media (max-width: 768px) {
            .header > div {
                flex-direction: column;
                text-align: center;
            }
            
            .header > div > div:last-child {
                width: 100%;
                justify-content: center;
            }
        }

        .header::before {
            content: '';
            position: absolute;
            top: -20px;
            left: 50%;
            transform: translateX(-50%);
            width: 200px;
            height: 2px;
            background: linear-gradient(90deg, transparent, var(--accent-primary), transparent);
            animation: scanline 3s ease-in-out infinite;
        }

        @keyframes scanline {
            0%, 100% { opacity: 0.3; width: 200px; }
            50% { opacity: 1; width: 400px; }
        }

        h1 {
            font-family: 'JetBrains Mono', monospace;
            font-size: 3.5rem;
            font-weight: 800;
            background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            letter-spacing: -2px;
            margin-bottom: 12px;
            text-transform: uppercase;
        }

        .subtitle {
            font-size: 1.1rem;
            color: var(--text-secondary);
            font-weight: 400;
        }

        .settings-btn {
            position: absolute;
            top: 0;
            right: 0;
            padding: 12px 24px;
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text-primary);
            cursor: pointer;
            transition: all 0.3s ease;
            font-family: 'Sora', sans-serif;
            font-weight: 600;
        }

        .settings-btn:hover {
            border-color: var(--accent-primary);
            transform: translateY(-2px);
        }

        .workflow {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-bottom: 40px;
            padding: 0 20px;
        }
        
        /* Mobile: stack verticale */
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
            position: relative;
            overflow: hidden;
            transition: all 0.3s ease;
            min-height: 500px;
            display: flex;
            flex-direction: column;
        }
        
        /* Mobile: rimuovi min-height */
        @media (max-width: 1200px) {
            .step {
                min-height: auto;
            }
        }

        .step::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
            transform: scaleX(0);
            transform-origin: left;
            transition: transform 0.3s ease;
        }

        .step.active::before {
            transform: scaleX(1);
        }

        .step:hover {
            border-color: var(--accent-primary);
            transform: translateY(-2px);
            box-shadow: var(--shadow);
        }

        .step-number {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
            border-radius: 50%;
            font-family: 'JetBrains Mono', monospace;
            font-weight: 700;
            color: var(--bg-primary);
            margin-bottom: 16px;
        }

        .step-title {
            font-size: 1.3rem;
            font-weight: 700;
            margin-bottom: 12px;
        }

        .step-description {
            color: var(--text-secondary);
            font-size: 0.95rem;
            line-height: 1.6;
            margin-bottom: 20px;
        }

        .upload-zone {
            border: 2px dashed var(--border);
            border-radius: 12px;
            padding: 50px 30px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
            background: var(--bg-tertiary);
            position: relative;
            overflow: hidden;
        }

        .upload-zone:hover {
            border-color: var(--accent-primary);
            background: rgba(0, 255, 136, 0.05);
        }

        .upload-zone.dragover {
            border-color: var(--accent-primary);
            background: rgba(0, 255, 136, 0.1);
            transform: scale(1.02);
        }

        .upload-icon {
            font-size: 3rem;
            margin-bottom: 16px;
            opacity: 0.6;
        }

        .video-preview {
            width: 100%;
            border-radius: 12px;
            margin-top: 16px;
            max-height: 400px;
        }

        .btn {
            font-family: 'Sora', sans-serif;
            padding: 14px 32px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
        }

        .btn::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.2);
            transform: translate(-50%, -50%);
            transition: width 0.5s, height 0.5s;
        }

        .btn:hover::before {
            width: 300px;
            height: 300px;
        }

        .btn-primary {
            background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
            color: var(--bg-primary);
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(0, 255, 136, 0.3);
        }

        .btn-secondary {
            background: var(--bg-tertiary);
            color: var(--text-primary);
            border: 1px solid var(--border);
        }

        .btn-secondary:hover {
            border-color: var(--accent-primary);
        }

        .btn-small {
            padding: 8px 16px;
            font-size: 0.85rem;
        }

        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .config-grid {
            display: grid;
            gap: 20px;
            margin-top: 20px;
        }

        .input-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .input-group label {
            font-weight: 600;
            font-size: 0.9rem;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .input-group input,
        .input-group select,
        .input-group textarea {
            font-family: 'Sora', sans-serif;
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 12px 16px;
            color: var(--text-primary);
            font-size: 1rem;
            transition: all 0.2s ease;
        }

        .input-group input:focus,
        .input-group select:focus,
        .input-group textarea:focus {
            outline: none;
            border-color: var(--accent-primary);
            box-shadow: 0 0 0 3px rgba(0, 255, 136, 0.1);
        }

        .variants-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .variant-card {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px;
            position: relative;
            animation: slideIn 0.4s ease forwards;
            opacity: 0;
        }

        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .variant-card:nth-child(1) { animation-delay: 0.1s; }
        .variant-card:nth-child(2) { animation-delay: 0.2s; }
        .variant-card:nth-child(3) { animation-delay: 0.3s; }
        .variant-card:nth-child(4) { animation-delay: 0.4s; }
        .variant-card:nth-child(5) { animation-delay: 0.5s; }

        .variant-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--border);
        }

        .variant-number {
            font-family: 'JetBrains Mono', monospace;
            font-weight: 700;
            font-size: 0.9rem;
            color: var(--accent-primary);
        }

        .variant-type {
            font-size: 0.8rem;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 1px;
            padding: 4px 12px;
            background: var(--bg-tertiary);
            border-radius: 4px;
        }

        .variant-section {
            margin-bottom: 20px;
        }

        .variant-section h4 {
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--text-secondary);
            margin-bottom: 8px;
        }

        .variant-section p {
            color: var(--text-primary);
            line-height: 1.6;
            font-size: 0.95rem;
        }

        .variant-actions {
            display: flex;
            gap: 8px;
            margin-top: 20px;
        }

        .loading {
            text-align: center;
            padding: 40px;
        }

        .spinner {
            width: 50px;
            height: 50px;
            border: 3px solid var(--border);
            border-top: 3px solid var(--accent-primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .toast {
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--bg-secondary);
            border: 1px solid var(--accent-primary);
            border-radius: 8px;
            padding: 16px 24px;
            box-shadow: var(--shadow);
            animation: slideInRight 0.3s ease;
            z-index: 1000;
        }

        @keyframes slideInRight {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        /* Settings Page */
        .settings-page {
            max-width: 900px;
            margin: 0 auto;
        }

        .settings-card {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 30px;
            margin-bottom: 24px;
        }

        .settings-card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 14px;
            border-radius: 6px;
            font-size: 0.85rem;
            font-weight: 600;
        }

        .status-badge.configured {
            background: rgba(0, 255, 136, 0.1);
            border: 1px solid var(--accent-primary);
            color: var(--accent-primary);
        }

        .status-badge.optional {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border);
            color: var(--text-secondary);
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: currentColor;
        }

        /* Extraction Panel */
        .extraction-panel {
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 20px;
            margin-top: 16px;
        }

        .extraction-grid {
            display: grid;
            gap: 16px;
            margin-top: 16px;
        }

        .extraction-item {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 16px;
        }

        .extraction-item label {
            display: block;
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--text-secondary);
            margin-bottom: 8px;
        }

        .extraction-item .value {
            color: var(--text-primary);
            line-height: 1.6;
        }

        .extraction-item.empty .value {
            color: var(--text-secondary);
            font-style: italic;
        }
    
      `}</style>
                </>
            )
        }
