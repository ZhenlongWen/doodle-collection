import { loadSync } from "https://deno.land/std@0.214.0/dotenv/mod.ts";

const envFromFile = loadSync({
  envPath: `${Deno.cwd()}/.env`,
  export: false,
});

export const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? envFromFile.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  throw new Error(
    "OPENAI_API_KEY is missing. Add it to your environment or .env file.",
  );
}

export const SERVER_PORT = 8000;
