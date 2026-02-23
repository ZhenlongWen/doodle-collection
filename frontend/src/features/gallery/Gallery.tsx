import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import type { GalleryItem } from "../../lib/types";
import "./Gallery.css";

interface GalleryProps {
  items: GalleryItem[];
}

export function Gallery({ items }: GalleryProps) {
  const THUMB_BASE_WIDTH = 72;
  const THUMB_MAX_HEIGHT = 80;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [thumbSizes, setThumbSizes] = useState<
    Record<string, { width: number; height: number }>
  >({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const thumbnailButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    console.log("[Gallery] items changed -> reset selectedIndex", {
      itemLength: items.length,
      previousSelectedIndex: selectedIndex,
    });
    setSelectedIndex(0);
  }, [items]);

  const activeIndex = selectedIndex < items.length ? selectedIndex : 0;

  console.log("[Gallery] render", {
    itemLength: items.length,
    selectedIndex,
    activeIndex,
    hasResult: items.length > 0,
  });

  if (items.length === 0) {
    console.log("[Gallery] conditional branch: empty");
    return (
      <p className="gallery-empty">No objects found yet. Try another doodle.</p>
    );
  }

  const activeItem = items[activeIndex];

  console.log("[Gallery] conditional branch: detail view", {
    activeId: activeItem.id,
    activeTitle: activeItem.title,
    activeIndex,
  });

  const handleNext = () => {
    const nextIndex = (activeIndex + 1) % items.length;
    console.log("[Gallery] next clicked", {
      activeIndex,
      nextIndex,
      itemLength: items.length,
    });
    setSelectedIndex(nextIndex);
    thumbnailButtonRefs.current[nextIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  };

  const handleThumbnailLoad = (
    itemId: string,
    event: SyntheticEvent<HTMLImageElement>,
  ) => {
    const image = event.currentTarget;
    const naturalWidth = image.naturalWidth || THUMB_BASE_WIDTH;
    const naturalHeight = image.naturalHeight || THUMB_MAX_HEIGHT;

    let width = THUMB_BASE_WIDTH;
    let height = (THUMB_BASE_WIDTH * naturalHeight) / naturalWidth;

    if (height > THUMB_MAX_HEIGHT) {
      const scale = THUMB_MAX_HEIGHT / height;
      width = width * scale;
      height = THUMB_MAX_HEIGHT;
    }

    const nextSize = {
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
    };

    setThumbSizes((previous) => {
      const existing = previous[itemId];
      if (
        existing &&
        existing.width === nextSize.width &&
        existing.height === nextSize.height
      ) {
        return previous;
      }

      return {
        ...previous,
        [itemId]: nextSize,
      };
    });
  };

  return (
    <div className="product-detail-view">
      {/* 1. Main image area */}
      <div className="hero-section">
        {activeItem.imageUrl
          ? (
            <img
              src={activeItem.imageUrl}
              alt={activeItem.title}
              className="hero-image"
            />
          )
          : <div className="hero-placeholder">No Image Available</div>}
      </div>

      {/* 2. Thumbnail carousel row */}
      <div className="thumbnail-carousel-container">
        <div className="thumbnail-row" ref={scrollContainerRef}>
          {items.map((item, idx) => (
            <button
              key={item.id}
              className="thumbnail-btn"
              ref={(element) => {
                thumbnailButtonRefs.current[idx] = element;
              }}
              onClick={() => {
                console.log("[Gallery] thumbnail clicked", {
                  clickedIndex: idx,
                  itemId: item.id,
                });
                setSelectedIndex(idx);
              }}
              aria-label={`View ${item.title}`}
            >
              {item.imageUrl
                ? (
                  <img
                    src={item.imageUrl}
                    alt=""
                    onLoad={(event) => handleThumbnailLoad(item.id, event)}
                    className={`thumbnail-image ${
                      idx === activeIndex ? "is-active" : ""
                    }`}
                    style={thumbSizes[item.id]}
                  />
                )
                : <div className="thumbnail-placeholder">No Img</div>}
            </button>
          ))}
        </div>
        <button
          className="carousel-next-btn"
          onClick={handleNext}
          aria-label="Next image"
        >
          {">"}
        </button>
      </div>

      {/* 3. Text details block */}
      <div className="details-section">
        <h2 className="details-title">{activeItem.title}</h2>

        <div className="details-meta">
          {activeItem.year && activeItem.year !== "Unknown year" && (
            <p>
              <strong>Year:</strong> {activeItem.year}
            </p>
          )}
          {activeItem.creator && activeItem.creator !== "Unknown creator" && (
            <p>
              <strong>Creator:</strong> {activeItem.creator}
            </p>
          )}
          {activeItem.medium && activeItem.medium !== "Unknown medium" && (
            <p>
              <strong>Medium:</strong> {activeItem.medium}
            </p>
          )}
        </div>

        <p className="details-description">{activeItem.description}</p>

        {activeItem.sourceUrl && (
          <a
            className="details-link"
            href={activeItem.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            View on Cooper Hewitt
          </a>
        )}
      </div>
    </div>
  );
}
