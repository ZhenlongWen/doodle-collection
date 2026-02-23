import type { GalleryItem } from "../types.ts";

const API_URL = "https://api.cooperhewitt.org/";

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

function normalizeRecord(
  record: CooperHewittRecord,
  index: number,
): GalleryItem {
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

export async function searchCooperHewittAPI(
  queryText: string,
): Promise<GalleryItem[]> {
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

  const response = await fetch(API_URL, {
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
    throw new Error(
      `Cooper Hewitt request failed (${response.status}): ${details}`,
    );
  }

  const data = await response.json();
  const records: CooperHewittRecord[] = Array.isArray(data?.data?.object)
    ? data.data.object
    : [];

  const rawCount = records.length;
  const returnedCount = Math.min(rawCount, 12);

  console.log("[CooperHewitt] search completed", {
    queryText,
    rawCount,
    returnedCount,
  });

  return records.slice(0, 12).map(normalizeRecord);
}
