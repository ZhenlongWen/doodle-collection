import type { CollectionRecord } from "../../lib/types";
import "./HistoryWorkspace.css";

interface HistorySketchListProps {
  items: CollectionRecord[];
  selectedId: string | null;
  onSelect: (item: CollectionRecord) => void;
}

export function HistorySketchList({
  items,
  selectedId,
  onSelect,
}: HistorySketchListProps) {
  if (items.length === 0) {
    return (
      <div className="history-empty-panel">
        No history yet. Submit a sketch first and it will show up here.
      </div>
    );
  }

  return (
    <div className="history-panel">
      <div className="history-grid">
        {items.map((item) => (
          <button
            key={item.id}
            className={`history-sketch-btn ${
              item.id === selectedId ? "is-selected" : ""
            }`}
            type="button"
            onClick={() => onSelect(item)}
            aria-label={`Open history sketch ${item.analysis || item.id}`}
          >
            <div className="history-sketch-artwork">
              <img
                className="history-sketch-image"
                src={item.drawingImageUrl}
                alt="History sketch"
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
