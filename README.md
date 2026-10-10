# 📖 Patient Intake & Survey Engine

**A modern, AI-powered patient intake and survey platform built with TanStack Start and Lovable.**

## ✨ Overview

This project is a sophisticated patient intake application designed to streamline the collection and review of medical survey data. By leveraging AI capabilities for generating intake forms and practitioner dictation, it eliminates friction in the patient experience. The platform works seamlessly across desktop, tablet, and mobile, ensuring an honest, engaging completion flow for patients while providing actionable, compact reports for practitioners.

## 🛠 Features

* **Multi-Phase Patient Flow:** An intuitive "Question x of y" experience across mobile and desktop.
* **AI-Powered Workflows:** Automated edit proposals, practitioner dictation (Groq + Gemini), and whole-intake generation.
* **Deterministic Survey Engine:** A shared, robust engine to handle dynamic forms, branching logic, and persistence.
* **Smart Reporting:** Compact report findings with easy "Copy summary" functionality.
* **Seamless Builder:** Sticky publish bar, whole-section editing, inline autocomplete, and robust search functionality for creating templates.

## 📋 Tech Stack

* **TanStack Start:** The core full-stack React framework managing routing, SSR, and API handling.
* **React & TypeScript:** The foundation for building robust, type-safe user interfaces.
* **Tailwind CSS & Radix UI:** Used for crafting responsive, accessible, and highly customizable UI components.
* **Supabase:** Provides backend database management, authentication, and data persistence (Lovable Cloud).
* **Drizzle ORM:** Type-safe database interactions and schema management.
* **Vite:** Lightning-fast frontend tooling and development server.

## 🚀 Prerequisites

Before you start, ensure you have the following installed:

* **Node.js** (v18 or higher recommended)
* **Git**
* A **Supabase** account and project (for database and API keys)

## 💻 Local Development

Follow these steps to get the project running on your local machine:

**1. Clone the repository:**
```bash
git clone <repository-url>
cd <repository-name>
```

**2. Install dependencies:**
```bash
npm install
```
*(Note: You can also use `bun install` as the project includes a `bun.lock` file).*

**3. Environment setup:**
Create a `.env` file in the root directory (you can copy from an `.env.example` if one exists, or create a new one). You will need to obtain your project URL and keys from your Supabase dashboard:
```bash
cp .env.example .env
```
Ensure your `.env` file contains the following keys:
```env
SUPABASE_PROJECT_ID="your_supabase_project_id"
SUPABASE_PUBLISHABLE_KEY="your_supabase_publishable_key"
SUPABASE_URL="https://your_supabase_project_id.supabase.co"

VITE_SUPABASE_PROJECT_ID="your_supabase_project_id"
VITE_SUPABASE_PUBLISHABLE_KEY="your_supabase_publishable_key"
VITE_SUPABASE_URL="https://your_supabase_project_id.supabase.co"
```

**4. Run the development server:**
```bash
npm run dev
```
Your app should now be running locally, typically at `http://localhost:3000` or the port specified in your terminal.

**5. Build for production:**
```bash
npm run build
```

## 🧠 How It Works (Architecture)

The application follows a modern full-stack React architecture powered by TanStack Start.
1. **Routing & SSR:** Requests hit the TanStack Start server (`src/server.ts`), which handles Server-Side Rendering (SSR) and routing logic via file-based routes in `src/routes/`.
2. **Data Fetching & State:** The frontend components use TanStack Query and standard React hooks to manage survey states and fetch data.
3. **Database & AI:** For persistence, the app connects to Supabase via Drizzle ORM. Backend API endpoints coordinate AI interactions (using Groq/Gemini) to process survey dictations, generate edit proposals, and finalize report summaries.

## 📁 Folder Structure

Here is a simplified overview of the project's structure:

```text
├── drizzle/              # Database schema definitions and migration files
├── src/                  # Main application source code
│   ├── components/       # Reusable UI components (Intake forms, buttons, layout)
│   ├── lib/              # Core utilities, AI logic, survey store, error reporting
│   ├── routes/           # File-based routing (pages like /patient, /intakes, /reports)
│   ├── server.ts         # Server entry point and error wrapper
│   └── styles.css        # Global CSS and Tailwind directives
├── supabase/             # Supabase configuration and edge functions
├── .env                  # Local environment variables
├── drizzle.config.ts     # Drizzle ORM configuration
├── package.json          # Project dependencies and scripts
└── vite.config.ts        # Vite configuration tailored for TanStack Start
```