import type { CollectionRecord } from "../../lib/types";
import { CollectionGrid } from "./CollectionGrid";

interface ArchiveLandingProps {
  items: CollectionRecord[];
  isLoading: boolean;
  onSelect: (item: CollectionRecord) => void;
  onExplore: () => void;
}

export function ArchiveLanding({
  items,
  isLoading,
  onSelect,
  onExplore,
}: ArchiveLandingProps) {
  return (
    <main className="app-page app-page-landing">
      <section className="landing-shell">
        <h1 className="app-title">Doodle Collection</h1>
        <CollectionGrid
          items={items}
          emptyMessage="No drawings have been added to the shared archive yet."
          isLoading={isLoading}
          variant="wall"
          onSelect={onSelect}
        />
        <div className="landing-actions">
          <button className="archive-cta" type="button" onClick={onExplore}>
            Draw to explore
          </button>
        </div>
      </section>
    </main>
  );
}
