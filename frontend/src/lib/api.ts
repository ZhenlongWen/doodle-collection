import type { AnalyzeResponse } from "./types";

export async function analyzeImage(image: string): Promise<AnalyzeResponse> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ image }),
  });

  if (!response.ok) {
    throw new Error(`Analyze request failed: ${response.status}`);
  }

  return response.json();
}
