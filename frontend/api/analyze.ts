const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const COOPER_HEWITT_API_URL = "https://api.cooperhewitt.org/";

interface CooperHewittRecord {
  id?: string | number;
  title?: string | { value?: string }[];
  description?: string | { value?: string }[];
  url?: string;
  multimedia?: {
    large?: {
      url?: string;
    };
  }[];
  date?: { value?: string }[];
  medium?: { value?: string }[];
  maker?: { name?: { value?: string }[] }[];
}

function getFirstText(
  value: CooperHewittRecord["title"] | CooperHewittRecord["description"],
  fallback: string,
): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  if (Array.isArray(value)) {
    const firstValue = value[0]?.value;
    if (typeof firstValue === "string" && firstValue.trim().length > 0) {
      return firstValue;
    }
  }

  return fallback;
}

function normalizeRecord(record: CooperHewittRecord, index: number) {
  return {
    id: String(record.id ?? `item-${index}`),
    title: getFirstText(record.title, "Untitled object"),
    description: getFirstText(record.description, "No description available."),
    imageUrl: record.multimedia?.[0]?.large?.url ?? null,
    sourceUrl: record.url ?? null,
    year: record.date?.[0]?.value ?? "Unknown year",
    medium: record.medium?.[0]?.value ?? "Unknown medium",
    creator: record.maker?.[0]?.name?.[0]?.value ?? "Unknown creator",
  };
}

async function analyzeImageWithGPT(base64Image: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing in Vercel environment variables.");
  }

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

async function searchCooperHewittAPI(queryText: string) {
  const query = `
    query SearchObjects($description: String!) {
      object(
        size: 50
        hasImages: true
        description: $description
        department: "Product Design and Decorative Arts"
      ) {
        id
        title
        description
        multimedia
        date
        medium
        maker {
          name
        }
      }
    }
  `;

  const response = await fetch(COOPER_HEWITT_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: {
        description: queryText,
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Cooper Hewitt request failed (${response.status}): ${details}`);
  }

  const data = await response.json();
  const records: CooperHewittRecord[] = Array.isArray(data?.data?.object) ? data.data.object : [];

  return records.slice(0, 12).map(normalizeRecord);
}

function parseBody(body: unknown): Record<string, unknown> {
  if (!body) {
    return {};
  }

  if (typeof body === "string") {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  if (typeof body === "object") {
    return body as Record<string, unknown>;
  }

  return {};
}

export const config = {
  maxDuration: 60,
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const payload = parseBody(req.body);
    const image = payload.image;

    if (typeof image !== "string" || image.length === 0) {
      res.status(400).json({ error: "Field 'image' is required." });
      return;
    }

    const analysis = await analyzeImageWithGPT(image);
    const galleryItems = await searchCooperHewittAPI(analysis);

    res.status(200).json({
      analysis,
      galleryItems,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    res.status(500).json({ error: message });
  }
}
