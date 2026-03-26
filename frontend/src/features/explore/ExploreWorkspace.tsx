import { AnalysisPanel } from "../analysis/AnalysisPanel";
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
  isClearingGallery: boolean;
  analysisStatus: AnalysisStatus;
  galleryItems: GalleryItem[];
  historyItems: CollectionRecord[];
  selectedHistoryId: string | null;
  selectedHistoryItem: CollectionRecord | null;
  errorMessage: string | null;
  primaryButtonLabel: string;
  isPrimaryDisabled: boolean;
  isPrimaryCta: boolean;
  primaryTooltip?: string;
  workspaceStatusMessage: string | null;
  onPrimaryAction: () => void;
  onBackToArchive: () => void;
  onOpenHistory: () => void;
  onSelectHistoryItem: (item: CollectionRecord) => void;
  onExitHistoryMode: () => void;
  onClear: () => void;
  onUpload: (image: HTMLImageElement) => void;
}

export function ExploreWorkspace({
  canvasRef,
  isExplored,
  workspaceMode,
  isLoading,
  dividerPhase,
  isClearingGallery,
  analysisStatus,
  galleryItems,
  historyItems,
  selectedHistoryId,
  selectedHistoryItem,
  errorMessage,
  primaryButtonLabel,
  isPrimaryDisabled,
  isPrimaryCta,
  primaryTooltip,
  workspaceStatusMessage,
  onPrimaryAction,
  onBackToArchive,
  onOpenHistory,
  onSelectHistoryItem,
  onExitHistoryMode,
  onClear,
  onUpload,
}: ExploreWorkspaceProps) {
  const isHistoryMode = workspaceMode === "history";
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
        <h1 className="app-title">Doodle Collection</h1>
        {isHistoryMode
          ? (
            <>
              <HistorySketchList
                items={historyItems}
                selectedId={selectedHistoryId}
                onSelect={onSelectHistoryItem}
              />
              <div className="history-bottom-actions">
                <button className="archive-cta" type="button" onClick={onExitHistoryMode}>
                  Draw to explore
                </button>
              </div>
            </>
          )
          : (
            <>
              <div className="canvas-stage">
                <SketchCanvas ref={canvasRef} />
              </div>
              <div className="bottom-controls">
                <AnalysisPanel
                  isLoading={isLoading}
                  onPrimaryAction={onPrimaryAction}
                  onBackToArchive={onBackToArchive}
                  onOpenHistory={onOpenHistory}
                  onClear={onClear}
                  onUpload={onUpload}
                  primaryButtonLabel={primaryButtonLabel}
                  isPrimaryDisabled={isPrimaryDisabled}
                  isPrimaryCta={isPrimaryCta}
                  primaryTooltip={primaryTooltip}
                />
                {workspaceStatusMessage && (
                  <p className="workspace-status">{workspaceStatusMessage}</p>
                )}
              </div>
            </>
          )}
      </section>

      <div className={`divider divider-${dividerPhase}`} />

      <section className="right-panel">
        <div className={`right-content ${isClearingGallery ? "is-clearing" : ""}`}>
          {!isExplored && !isHistoryMode && <div className="right-placeholder" />}

          {isHistoryMode && rightPanelItems.length > 0 && <Gallery items={rightPanelItems} />}

          {isHistoryMode && rightPanelItems.length === 0 && (
            <div className="right-empty">No history item selected yet.</div>
          )}

          {!isHistoryMode && isExplored && analysisStatus === "idle" && (
            <div className="right-placeholder" />
          )}

          {!isHistoryMode && isExplored && analysisStatus === "analyzing" && (
            <div className="right-loading">Analyzing…</div>
          )}

          {!isHistoryMode && isExplored && analysisStatus === "ready" &&
            rightPanelItems.length > 0 && <Gallery items={rightPanelItems} />}

          {!isHistoryMode && isExplored && analysisStatus === "ready" &&
            rightPanelItems.length === 0 && (
            <div className="right-empty">No object found</div>
          )}

          {!isHistoryMode && isExplored && analysisStatus === "error" && (
            <div className="right-error">{errorMessage ?? "Error"}</div>
          )}
        </div>
      </section>
    </main>
  );
}
