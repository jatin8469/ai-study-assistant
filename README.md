# AI Study Assistant (StudyMate AI)

An intelligent study platform designed to help students learn smarter with PDFs, AI-powered explanations, structured notes, and interactive practice quizzes.

## Features

- **Study Dashboard**: Track learning streaks, recent materials, and study progress.
- **PDF & Document Library**: Upload and manage study PDFs with server-side validation, Firebase Storage persistence, and page-boundary text extraction.
- **AI Tutor (`@google/genai`)**: Grounded Q&A over uploaded documents with page citations and explicit unsupported-answer detection.
- **Smart Notes & Explanations**: Generate structured summaries, chapter notes, definitions, revision sheets, and level-tailored explanations.
- **Practice Quizzes & Server-Side Grading**: Generate schema-validated 4-option MCQs and grade answers strictly against the server-stored answer key.
- **Study History**: Persist and review chats, notes, explanations, uploads, and quiz attempts in Firestore scoped to each authenticated user.

## Tech Stack

- **Frontend**: [TanStack Start](https://tanstack.com/start), [TanStack Router](https://tanstack.com/router), React 19, Tailwind CSS v4, Radix UI / shadcn/ui
- **Backend**: Node.js, Express, `firebase-admin` (Auth, Firestore, Cloud Storage), `@google/genai`, Multer, `pdf-parse`, Zod, `express-rate-limit`
- **Testing**: Vitest, Supertest, React Testing Library

## Local Setup & Configuration

### 1. Prerequisites

- Node.js (v20+ recommended) and npm
- A **Firebase project** with:
  - **Authentication** enabled (Email/Password or Google Sign-In)
  - **Cloud Firestore** database created
  - **Firebase Storage** bucket initialized
- A **Google Gemini API Key** from [Google AI Studio](https://aistudio.google.com/)

### 2. Install Dependencies

```sh
git clone https://github.com/jatin8469/ai-study-assistant.git
cd ai-study-assistant
npm install --legacy-peer-deps
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your server credentials:

```sh
cp .env.example .env
```

Required environment variables in `.env`:

| Variable | Description |
| --- | --- |
| `PORT` | Express backend port (default `3001`) |
| `CORS_ORIGIN` | Allowed frontend origin(s), comma-separated (default `http://localhost:5173`) |
| `FIREBASE_PROJECT_ID` | Your Firebase Project ID |
| `FIREBASE_CLIENT_EMAIL` | Service account client email (or provide `FIREBASE_SERVICE_ACCOUNT_JSON` / `GOOGLE_APPLICATION_CREDENTIALS`) |
| `FIREBASE_PRIVATE_KEY` | Service account private key (with `\n` newlines preserved) |
| `FIREBASE_STORAGE_BUCKET` | Your Firebase Storage bucket name (e.g., `your-project.firebasestorage.app`) |
| `GEMINI_API_KEY` | Server-side Google Gemini API key for `@google/genai` |
| `GEMINI_MODEL` | Gemini model name (default `gemini-2.5-flash`) |
| `MAX_UPLOAD_MB` | Maximum allowed PDF file size in MB (default `25`) |

> **Security Note**: Never commit `.env` or service account JSON files to version control. All privileged Firebase Admin and Gemini API credentials remain strictly on the server.

### 4. Running the Application

- **Full-stack Dev Server** (Vite frontend + integrated `/api/*` Express middleware on `http://localhost:5173`):
  ```sh
  npm run dev
  ```
- **Standalone Express API Server** (listens on `PORT`, default `http://localhost:3001`):
  ```sh
  npm run server
  ```
- **Watch Mode for Standalone API Server**:
  ```sh
  npm run dev:server
  ```

### 5. Running Tests

```sh
npm test
```

## Backend API Endpoints

All endpoints except `GET /api/health` require a valid Firebase ID token in the `Authorization: Bearer <idToken>` header. Ownership (`uid`) is derived from the verified token and enforced on every read, write, and delete.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Health check and Firebase / Gemini configuration status |
| `GET` | `/api/documents` | List authenticated user's uploaded PDF documents |
| `POST` | `/api/documents` | Upload a validated PDF (`multipart/form-data`, `file` field), extract text per page, store in Firebase Storage & Firestore |
| `DELETE` | `/api/documents/:id` | Delete a document from Firebase Storage and Firestore (owner only) |
| `POST` | `/api/ai/chat` | Grounded document Q&A with page citations and unsupported-claim detection |
| `POST` | `/api/ai/summarize` | Generate structured summaries/notes (`summary`, `chapter`, `definitions`, `revision`) |
| `POST` | `/api/ai/explain` | Generate topic explanations (`beginner`, `intermediate`, `advanced`) from extracted pages |
| `POST` | `/api/ai/quiz` | Generate schema-validated 4-option MCQs; stores answer key on server and returns questions without answers |
| `POST` | `/api/ai/quiz/grade` | Grade submitted quiz answers against the server-stored answer key and return scores & explanations |
| `GET` | `/api/history` | List user's persisted chats, notes, explanations, uploads, and quiz attempts (`?type=...&limit=...`) |
| `GET` | `/api/history/:id` | Get a specific history record (owner only) |
| `DELETE` | `/api/history/:id` | Delete a specific history record (owner only) |
