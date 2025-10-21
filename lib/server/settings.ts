export const RAGIE_API_BASE_URL =
  process.env.RAGIE_API_BASE_URL || "https://api.ragie.ai";

export const RAGIE_API_KEY = process.env.RAGIE_API_KEY;

export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// CORS allowed origins - comma-separated list or '*' for development
export const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'http://localhost:3000';

if (!RAGIE_API_KEY) {
  throw new Error("RAGIE_API_KEY is not set");
}

if (!ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY is not set");
}
