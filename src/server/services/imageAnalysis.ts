import { OPENAI_API_KEY } from "../config.ts";

export async function analyzeImageWithGPT(
  base64Image: string,
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Recognize the main object in this image, output a query term describing what does it look like, avoid words like irregular. only output the term, try to use one word to describe the most defining feature. examples: Teardrop, Tripod, Stars, Tablet, Apple, Fragments, Gourd, Woodenbox, Spikes…. If there’s people in it, describe their activity, only using one word.",
            },
            {
              type: "image_url",
              image_url: { url: base64Image },
            },
          ],
        },
      ],
      max_tokens: 30,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${details}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("OpenAI did not return usable text.");
  }

  return content.trim();
}
