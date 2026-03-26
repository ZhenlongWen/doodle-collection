import { useEffect } from "react";
import { Gallery } from "../gallery/Gallery";
import type { CollectionRecord } from "../../lib/types";
import "./Archive.css";

interface CollectionModalProps {
  item: CollectionRecord | null;
  onClose: () => void;
}

export function CollectionModal({ item, onClose }: CollectionModalProps) {
  useEffect(() => {
    if (!item) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [item, onClose]);

  if (!item) {
    return null;
  }

  return (
    <div className="collection-modal-backdrop" onClick={onClose}>
      <div
        className="collection-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Collection details"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="collection-modal-header">
          <div className="collection-modal-summary">
            <div className="collection-modal-drawing">
              <img src={item.drawingImageUrl} alt="Original drawing" />
            </div>

            <div className="collection-modal-copy">
              <p className="collection-modal-kicker">Original drawing</p>
              <h2 className="collection-modal-title">Objects and info</h2>
              <p className="collection-modal-analysis">{item.analysis}</p>
            </div>
          </div>

          <button className="btn collection-modal-close" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="collection-modal-body">
          <Gallery items={item.galleryItems} />
        </div>
      </div>
    </div>
  );
}
