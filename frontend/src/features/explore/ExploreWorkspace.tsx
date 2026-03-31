import {
  SketchCanvas,
  type SketchCanvasHandle,
} from "../canvas/SketchCanvas";
import { Gallery } from "../gallery/Gallery";
import { HistorySketchList } from "../history/HistorySketchList";
import type { CollectionRecord, GalleryItem } from "../../lib/types";

type AnalysisStatus = "idle" | "analyzing" | "ready" | "error";
type DividerPhase = "idle" | "resetting" | "loading" | "complete";
type WorkspaceMode = "draw" | "history";

interface ExploreWorkspaceProps {
  canvasRef: React.RefObject<SketchCanvasHandle | null>;
  isExplored: boolean;
  workspaceMode: WorkspaceMode;
  isLoading: boolean;
  dividerPhase: DividerPhase;
  animateDividerReveal: boolean;
  isClearingGallery: boolean;
  analysisStatus: AnalysisStatus;
  galleryItems: GalleryItem[];
  historyItems: CollectionRecord[];
  selectedHistoryId: string | null;
  selectedHistoryItem: CollectionRecord | null;
  errorMessage: string | null;
  onSelectHistoryItem: (item: CollectionRecord) => void;
}

export function ExploreWorkspace({
  canvasRef,
  isExplored,
  workspaceMode,
  isLoading,
  dividerPhase,
  animateDividerReveal,
  isClearingGallery,
  analysisStatus,
  galleryItems,
  historyItems,
  selectedHistoryId,
  selectedHistoryItem,
  errorMessage,
  onSelectHistoryItem,
}: ExploreWorkspaceProps) {
  const isHistoryMode = workspaceMode === "history";
  const effectiveDividerPhase = !isExplored
    ? "idle"
    : dividerPhase === "idle"
    ? "complete"
    : dividerPhase;
  const rightPanelItems = isHistoryMode
    ? selectedHistoryItem?.galleryItems ?? []
    : galleryItems;

  return (
    <main
      className={`app-shell ${isExplored ? "is-explored" : "is-initial"} ${
        isLoading ? "is-analyzing" : ""
      }`}
    >
      <section className="left-panel">
        <div className="workspace-left-body">
          <div className={`canvas-stage ${isHistoryMode ? "is-hidden" : ""}`}>
            <SketchCanvas ref={canvasRef} />
          </div>

          {isHistoryMode && (
            <div className="history-layer">
              <HistorySketchList
                items={historyItems}
                selectedId={selectedHistoryId}
                onSelect={onSelectHistoryItem}
              />
            </div>
          )}
        </div>
      </section>

      <div
        className={`divider divider-${effectiveDividerPhase} ${
          animateDividerReveal && effectiveDividerPhase === "complete" ? "animate-reveal" : ""
        }`}
      />

      <section className="right-panel">
        <div className={`right-content ${isClearingGallery ? "is-clearing" : ""}`}>
          {isHistoryMode && rightPanelItems.length > 0 && <Gallery items={rightPanelItems} />}

          {isHistoryMode && rightPanelItems.length === 0 && (
            <div className="right-empty">No history item selected yet.</div>
          )}

          {!isHistoryMode && isExplored && analysisStatus === "analyzing" && (
            <div className="right-loading">Analyzing…</div>
          )}

          {!isHistoryMode && isExplored && analysisStatus === "ready" &&
            rightPanelItems.length > 0 && <Gallery items={rightPanelItems} />}

          {!isHistoryMode && isExplored && analysisStatus === "ready" &&
            rightPanelItems.length === 0 && (
            <div className="right-empty">No matches found, try another one!</div>
          )}

          {!isHistoryMode && isExplored && analysisStatus === "error" && (
            <div className="right-error">{errorMessage ?? "Error"}</div>
          )}
        </div>
      </section>
    </main>
  );
}
