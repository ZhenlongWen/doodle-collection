import type { CollectionRecord } from "../../lib/types";
import { CollectionGrid } from "./CollectionGrid";

interface ArchiveLandingProps {
  items: CollectionRecord[];
  isLoading: boolean;
  onSelect: (item: CollectionRecord) => void;
}

export function ArchiveLanding({
  items,
  isLoading,
  onSelect,
}: ArchiveLandingProps) {
  return (
    <main className="app-page app-page-landing">
      <CollectionGrid
        items={items}
        isLoading={isLoading}
        variant="wall"
        onSelect={onSelect}
      />
    </main>
  );
}
