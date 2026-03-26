import { CollectionGrid } from "../archive/CollectionGrid";
import type { CollectionRecord } from "../../lib/types";

interface HistoryPageProps {
  items: CollectionRecord[];
  isLoading: boolean;
  onSelect: (item: CollectionRecord) => void;
  onBackToArchive: () => void;
  onExplore: () => void;
}

export function HistoryPage({
  items,
  isLoading,
  onSelect,
  onBackToArchive,
  onExplore,
}: HistoryPageProps) {
  return (
    <main className="app-page">
      <section className="archive-shell">
        <header className="page-header">
          <div>
            <p className="page-kicker">History</p>
            <h1 className="page-title">Your anonymous search history</h1>
            <p className="page-copy">
              Every successful search is saved here with the drawing and fetched
              objects, even before it is added to the shared archive.
            </p>
          </div>

          <div className="page-actions">
            <button className="btn" type="button" onClick={onBackToArchive}>
              Back to archive
            </button>
            <button className="archive-cta" type="button" onClick={onExplore}>
              Draw to explore
            </button>
          </div>
        </header>

        <CollectionGrid
          items={items}
          emptyMessage="Your history is empty right now. Run a drawing search to start filling it."
          isLoading={isLoading}
          showMetadata
          onSelect={onSelect}
        />
      </section>
    </main>
  );
}
