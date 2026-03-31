import type { CollectionRecord } from "../../lib/types";
import "./Archive.css";

interface CollectionGridProps {
  items: CollectionRecord[];
  isLoading?: boolean;
  showMetadata?: boolean;
  variant?: "default" | "wall";
  onSelect: (item: CollectionRecord) => void;
}

function formatDate(createdAtMs: number) {
  if (!createdAtMs) {
    return "Just now";
  }

  return new Date(createdAtMs).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CollectionGrid({
  items,
  isLoading = false,
  showMetadata = false,
  variant = "default",
  onSelect,
}: CollectionGridProps) {
  if (isLoading) {
    return null;
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className={`collection-grid collection-grid-${variant}`}>
      {items.map((item) => (
        <button
          key={item.id}
          className={`collection-card collection-card-${variant}`}
          type="button"
          onClick={() => onSelect(item)}
        >
          <div className="collection-card-artwork">
            <img
              className="collection-card-image"
              src={item.drawingImageUrl}
              alt="Archived drawing"
            />
          </div>

          {showMetadata && (
            <div className="collection-card-meta">
              <p className="collection-card-analysis">{item.analysis}</p>
              <p className="collection-card-date">{formatDate(item.createdAtMs)}</p>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
