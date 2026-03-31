import { useEffect, useRef, useState } from "react";
import { Gallery } from "../gallery/Gallery";
import type { CollectionRecord } from "../../lib/types";
import "./Archive.css";

interface CollectionModalProps {
  item: CollectionRecord | null;
  onClose: () => void;
}

export function CollectionModal({ item, onClose }: CollectionModalProps) {
  const [isClosing, setIsClosing] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const backdropPointerDownRef = useRef(false);

  useEffect(() => {
    if (!item) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsClosing(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [item]);

  useEffect(() => {
    if (!isClosing) {
      return;
    }

    closeTimeoutRef.current = window.setTimeout(() => {
      onClose();
      closeTimeoutRef.current = null;
    }, 220);

    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, [isClosing, onClose]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  if (!item) {
    return null;
  }

  const beginClose = () => {
    if (isClosing) {
      return;
    }

    setIsClosing(true);
  };

  return (
    <div
      className={`collection-modal-backdrop ${isClosing ? "is-closing" : ""}`}
      onMouseDown={(event) => {
        backdropPointerDownRef.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (
          backdropPointerDownRef.current &&
          event.target === event.currentTarget
        ) {
          beginClose();
        }
        backdropPointerDownRef.current = false;
      }}
    >
      <div
        className={`collection-modal ${isClosing ? "is-closing" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Collection details"
        onMouseDown={() => {
          backdropPointerDownRef.current = false;
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="collection-modal-close"
          type="button"
          aria-label="Close archive detail"
          onClick={beginClose}
        >
          ×
        </button>

        <div className="collection-modal-shell">
          <section className="collection-modal-left">
            <div className="collection-modal-drawing-stage">
              <div className="collection-modal-drawing">
                <img src={item.drawingImageUrl} alt="Original drawing" />
              </div>
            </div>
          </section>

          <div className="collection-modal-divider" />

          <section className="collection-modal-right">
            <div className="collection-modal-body">
              <Gallery items={item.galleryItems} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
