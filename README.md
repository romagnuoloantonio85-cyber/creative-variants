# 🎬 Creative Variants - AI Video Generation Platform

Piattaforma per generare varianti intelligenti di creative video con AI.

## 🚀 Features

- ✅ **Autenticazione** con Supabase
- ✅ **Upload video** e estrazione frame automatica
- ✅ **AI Data Extraction** con Gemini
- ✅ **Generazione varianti** intelligenti con Gemini
- ✅ **Video AI Generation** con Luma via PiAPI
- ✅ **3 video da 3 frame** (inizio, metà, fine)
- ✅ **Cloud-managed** - Zero configurazione utente

## 📋 Prerequisiti

- Account [Supabase](https://supabase.com) (gratis)
- Account [Vercel](https://vercel.com) (gratis)
- Account [Cloudinary](https://cloudinary.com) (gratis)
- API Keys:
  - Google Gemini AI
  - PiAPI (per Luma)

## 🔧 Setup Locale

### 1. Installa dipendenze

```bash
npm install
```

### 2. Configura Environment Variables

Copia `.env.example` in `.env.local`:

```bash
cp .env.example .env.local
```

Compila con i tuoi valori:

```env
# Supabase (Pubbliche - già configurate)
NEXT_PUBLIC_SUPABASE_URL=https://hmrxxbhmlyqyetlhzzow.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_HvRKDEq_H8s83DgEu1qFBw_yQGZH5G8

# API Keys (Private - Server-side only)
GEMINI_API_KEY=your_gemini_key_here
PIAPI_KEY=your_piapi_key_here
CLOUDINARY_CLOUD_NAME=dyj8vr9xan
CLOUDINARY_UPLOAD_PRESET=video_frames
```

### 3. Avvia Development Server

```bash
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000)

## ☁️ Deploy su Vercel

### 1. Push su GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/creative-variants.git
git push -u origin main
```

### 2. Import su Vercel

1. Vai su [vercel.com](https://vercel.com)
2. Click "Import Project"
3. Seleziona il tuo repo GitHub
4. Configura Environment Variables (vedi sotto)
5. Deploy!

### 3. Configura Environment Variables su Vercel

**Settings → Environment Variables:**

```
NEXT_PUBLIC_SUPABASE_URL = https://hmrxxbhmlyqyetlhzzow.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = sb_publishable_HvRKDEq_H8s83DgEu1qFBw_yQGZH5G8
GEMINI_API_KEY = [La tua key]
PIAPI_KEY = [La tua key]
CLOUDINARY_CLOUD_NAME = dyj8vr9xan
CLOUDINARY_UPLOAD_PRESET = video_frames
```

✅ **FATTO! L'app è online!**

## 📊 Struttura Progetto

```
creative-variants-app/
├── pages/
│   ├── index.js              # Homepage con login/signup
│   ├── dashboard.js          # Dashboard principale
│   ├── _app.js               # Entry point Next.js
│   └── api/                  # API Routes (Backend)
│       ├── extract-data.js   # Estrazione dati con Gemini
│       ├── generate-variants.js  # Generazione varianti
│       └── generate-video.js # Generazione video Luma
├── lib/
│   └── supabase.js           # Client Supabase
├── styles/
│   └── globals.css           # Stili globali
├── package.json
├── next.config.js
└── .env.example
```

## 🔐 Sicurezza

- ✅ API Keys **mai esposte** al client
- ✅ Tutte le chiamate API protette server-side
- ✅ Autenticazione JWT con Supabase
- ✅ Row Level Security su database

## 💰 Costi

Con piano gratuito:
- **Supabase:** Gratis (500MB database, 50k utenti/mese)
- **Vercel:** Gratis (100GB bandwidth, unlimited sites)
- **Cloudinary:** Gratis (25GB storage, 25GB bandwidth/mese)
- **PiAPI:** $0.20 per video generato
- **Gemini:** Gratis (fino 60 richieste/minuto)

## 🚨 Troubleshooting

### "Missing Supabase environment variables"
→ Verifica di aver impostato `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### "Cloudinary not configured"
→ Imposta `CLOUDINARY_CLOUD_NAME` e `CLOUDINARY_UPLOAD_PRESET` nelle env variables

### "Gemini API key not configured"
→ Imposta `GEMINI_API_KEY` nelle env variables

### "PiAPI key not configured"
→ Imposta `PIAPI_KEY` nelle env variables

## 📞 Support

Per problemi o domande:
- Email: [Il tuo email]
- Issues: [GitHub Issues]

## 📜 License

Private - Tutti i diritti riservati
