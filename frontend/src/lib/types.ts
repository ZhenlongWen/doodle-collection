export interface GalleryItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  sourceUrl: string | null;
  year?: string;
  creator?: string;
  medium?: string;
}

export interface AnalyzeResponse {
  analysis: string;
  galleryItems: GalleryItem[];
}
