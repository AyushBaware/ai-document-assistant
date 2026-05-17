# AI Document Assistant

An AI-powered MERN application that allows users to upload PDF documents, extract text content, and generate intelligent summaries, study notes, and beginner-friendly explanations using Gemini AI.

---

# Live Project Vision

This project is being developed into a complete AI-powered document intelligence platform with future support for:

- RAG (Retrieval-Augmented Generation)
- Embeddings
- Vector Databases
- Semantic Search
- Conversational PDF Chat
- Multi-document Intelligence

---

# Current MVP Features

## AI-Powered PDF Processing
- Upload PDF documents
- Extract text from PDFs
- Process extracted content using Gemini AI

## AI Content Generation
- Generate document summaries
- Generate structured study notes
- Explain complex content in beginner-friendly language

## Modern UI/UX
- Responsive design for all devices
- Glassmorphism interface
- Framer Motion animations
- Smooth user experience

## Scalable MERN Architecture
- React + Vite frontend
- Express backend
- Modular API structure
- AI-ready backend architecture

---

# Tech Stack

## Frontend
- React
- Vite
- Tailwind CSS v4
- Framer Motion
- Axios

## Backend
- Node.js
- Express.js
- Multer
- PDF.js
- Gemini AI API

---

# Project Architecture

```bash
ai-document-assistant/
│
├── client/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── App.jsx
│   │   └── main.jsx
│   │
│   └── package.json
│
├── server/
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── uploads/
│   ├── utils/
│   ├── .env
│   └── server.js
│
└── README.md
```

---

# How It Works

```text
PDF Upload
   ↓
Text Extraction
   ↓
Gemini AI Processing
   ↓
Summary / Notes / Explanations
```

---

# Installation

## Clone Repository

```bash
git clone https://github.com/AyushBaware/ai-document-assistant.git

```

---

# Frontend Setup

```bash
cd client
npm install
npm run dev
```

Frontend runs on:

```bash
http://localhost:5173
```

---

# Backend Setup

```bash
cd server
npm install
npm run dev
```

Backend runs on:

```bash
http://localhost:5000
```

---

# Environment Variables

Create:

```bash
server/.env
```

Add:

```env
PORT=5000
MONGO_URI=your_mongodb_connection
GEMINI_API_KEY=your_gemini_api_key
```

---

# Current Development Focus

The current focus is building a strong AI-document-processing foundation before implementing advanced RAG architecture.

Upcoming improvements include:
- intelligent chunking
- conversational PDF chat
- embeddings
- vector search
- semantic retrieval
- cloud storage integration

---

# Future Roadmap

## Phase 1 — Current MVP
- PDF upload
- Text extraction
- Gemini integration
- AI summaries and notes

## Phase 2 — AI Scaling
- Chunking system
- Chat with PDF
- Streaming AI responses

## Phase 3 — Advanced RAG
- Embeddings
- Vector database
- Semantic search
- Multi-document querying

---

# License

MIT