import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import "./features/app/AppShell.css";
import { AnalysisPanel } from "./features/analysis/AnalysisPanel";
import { ArchiveLanding } from "./features/archive/ArchiveLanding";
import { CollectionModal } from "./features/archive/CollectionModal";
import { type SketchCanvasHandle } from "./features/canvas/SketchCanvas";
import { ExploreWorkspace } from "./features/explore/ExploreWorkspace";
import { analyzeImage } from "./lib/api";
import {
  addSharedArchiveEntry,
  auth,
  ensureAnonymousUser,
  getFirebaseErrorMessage,
  saveHistoryEntry,
  subscribeSharedArchive,
  subscribeUserHistory,
} from "./lib/firebase";
import type { CollectionRecord, GalleryItem } from "./lib/types";

type AnalysisStatus = "idle" | "analyzing" | "ready" | "error";
type AuthStatus = "authenticating" | "ready" | "error";
type SaveState = "idle" | "saving" | "saved" | "error";
type DividerPhase = "idle" | "resetting" | "loading" | "complete";
type ViewMode = "archive" | "explore";
type WorkspaceMode = "draw" | "history";
type LayoutMode = "full" | "split";
type ControlsMode = "archive" | "draw" | "history";

interface CurrentResult {
  drawingImageDataUrl: string;
  analysis: string;
  galleryItems: GalleryItem[];
}

const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export default function App() {
  const canvasRef = useRef<SketchCanvasHandle>(null);

  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>("idle");
  const [authStatus, setAuthStatus] = useState<AuthStatus>("authenticating");
  const [viewMode, setViewMode] = useState<ViewMode>("archive");
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("draw");
  const [isClearingGallery, setIsClearingGallery] = useState(false);
  const [dividerPhase, setDividerPhase] = useState<DividerPhase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [, setAuthErrorMessage] = useState<string | null>(null);
  const [sharedArchiveItems, setSharedArchiveItems] = useState<CollectionRecord[]>([]);
  const [historyItems, setHistoryItems] = useState<CollectionRecord[]>([]);
  const [isSharedArchiveLoading, setIsSharedArchiveLoading] = useState(true);
  const [, setIsHistoryLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<CollectionRecord | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentResult, setCurrentResult] = useState<CurrentResult | null>(null);
  const [latestHistoryEntry, setLatestHistoryEntry] = useState<CollectionRecord | null>(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [, setHistorySaveState] = useState<SaveState>("idle");
  const [collectionSaveState, setCollectionSaveState] = useState<SaveState>("idle");

  const analyzeInFlightRef = useRef(false);
  const requestIdRef = useRef(0);
  const dividerTimeoutRef = useRef<number | null>(null);
  const clearGalleryTimeoutRef = useRef<number | null>(null);
  const canvasSnapshotRef = useRef<string | null>(null);
  const controlsTransitionTimeoutRef = useRef<number | null>(null);
  const dividerRevealTimeoutRef = useRef<number | null>(null);
  const previousLayoutModeRef = useRef<LayoutMode>("full");
  const [displayedControlsMode, setDisplayedControlsMode] = useState<ControlsMode>("archive");
  const [exitingControlsMode, setExitingControlsMode] = useState<ControlsMode | null>(null);
  const [animateDividerReveal, setAnimateDividerReveal] = useState(false);

  const isLoading = analysisStatus === "analyzing";
  const isExplored =
    historyItems.length > 0 ||
    workspaceMode === "history" ||
    analysisStatus !== "idle" ||
    galleryItems.length > 0 ||
    isClearingGallery;
  const layoutMode: LayoutMode =
    viewMode === "archive"
      ? "full"
      : isExplored
      ? "split"
      : "full";
  const controlsMode: ControlsMode =
    viewMode === "archive"
      ? "archive"
      : workspaceMode === "history"
      ? "history"
      : "draw";

  const logState = (label: string, extra?: Record<string, unknown>) => {
    console.log(`[App] ${label}`, {
      analysisStatus,
      authStatus,
      viewMode,
      workspaceMode,
      isExplored,
      resultLength: galleryItems.length,
      dividerPhase,
      errorMessage,
      requestId: requestIdRef.current,
      ...extra,
    });
  };

  useEffect(() => {
    setAuthStatus("authenticating");

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);

      if (user) {
        setAuthStatus("ready");
        setAuthErrorMessage(null);
      }
    });

    ensureAnonymousUser().catch((error) => {
      console.error("[App] anonymous auth failed", error);
      setAuthStatus("error");
      setAuthErrorMessage(getFirebaseErrorMessage(error));
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeSharedArchive(
      (items) => {
        setSharedArchiveItems(items);
        setIsSharedArchiveLoading(false);
      },
      (error) => {
        console.error("[App] shared archive subscription failed", error);
        setIsSharedArchiveLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setHistoryItems([]);
      setIsHistoryLoading(false);
      return;
    }

    setIsHistoryLoading(true);
    const unsubscribe = subscribeUserHistory(
      currentUser.uid,
      (items) => {
        setHistoryItems(items);
        setIsHistoryLoading(false);
      },
      (error) => {
        console.error("[App] history subscription failed", error);
        setIsHistoryLoading(false);
      },
    );

    return unsubscribe;
  }, [currentUser]);

  useEffect(() => {
    if (historyItems.length === 0) {
      setSelectedHistoryId(null);
      return;
    }

    const selectedStillExists = historyItems.some((item) => item.id === selectedHistoryId);
    if (!selectedStillExists) {
      setSelectedHistoryId(historyItems[0].id);
    }
  }, [historyItems, selectedHistoryId]);

  useEffect(() => {
    return () => {
      if (dividerTimeoutRef.current !== null) {
        window.clearTimeout(dividerTimeoutRef.current);
      }
      if (clearGalleryTimeoutRef.current !== null) {
        window.clearTimeout(clearGalleryTimeoutRef.current);
      }
      if (controlsTransitionTimeoutRef.current !== null) {
        window.clearTimeout(controlsTransitionTimeoutRef.current);
      }
      if (dividerRevealTimeoutRef.current !== null) {
        window.clearTimeout(dividerRevealTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (controlsMode === displayedControlsMode) {
      return;
    }

    if (controlsTransitionTimeoutRef.current !== null) {
      window.clearTimeout(controlsTransitionTimeoutRef.current);
    }

    setExitingControlsMode(displayedControlsMode);
    setDisplayedControlsMode(controlsMode);

    controlsTransitionTimeoutRef.current = window.setTimeout(() => {
      setExitingControlsMode(null);
      controlsTransitionTimeoutRef.current = null;
    }, 380);
  }, [controlsMode, displayedControlsMode]);

  useEffect(() => {
    const previousLayoutMode = previousLayoutModeRef.current;

    if (
      previousLayoutMode === "full" &&
      layoutMode === "split" &&
      analysisStatus === "idle"
    ) {
      if (dividerRevealTimeoutRef.current !== null) {
        window.clearTimeout(dividerRevealTimeoutRef.current);
      }

      setAnimateDividerReveal(true);
      dividerRevealTimeoutRef.current = window.setTimeout(() => {
        setAnimateDividerReveal(false);
        dividerRevealTimeoutRef.current = null;
      }, 820);
    }

    previousLayoutModeRef.current = layoutMode;
  }, [layoutMode, analysisStatus]);

  const handleClear = () => {
    logState("Clear clicked");

    if (dividerTimeoutRef.current !== null) {
      window.clearTimeout(dividerTimeoutRef.current);
      dividerTimeoutRef.current = null;
    }
    if (clearGalleryTimeoutRef.current !== null) {
      window.clearTimeout(clearGalleryTimeoutRef.current);
      clearGalleryTimeoutRef.current = null;
    }

    // Invalidate any in-flight response so clear won't be overwritten by stale data.
    requestIdRef.current += 1;
    analyzeInFlightRef.current = false;

    canvasRef.current?.clear();
    canvasSnapshotRef.current = null;

    setErrorMessage(null);
    setCurrentResult(null);
    setLatestHistoryEntry(null);
    setHistorySaveState("idle");
    setCollectionSaveState("idle");

    const hasGalleryToFade = analysisStatus === "ready" && galleryItems.length > 0;
    if (isExplored && hasGalleryToFade) {
      setIsClearingGallery(true);
      clearGalleryTimeoutRef.current = window.setTimeout(() => {
        setIsClearingGallery(false);
        setGalleryItems([]);
        setAnalysisStatus("idle");
        setDividerPhase("complete");
        clearGalleryTimeoutRef.current = null;
      }, 220);
      return;
    }

    setIsClearingGallery(false);
    setGalleryItems([]);
    // Keep split layout but blank gallery after clear.
    setAnalysisStatus("idle");
    setDividerPhase(isExplored ? "complete" : "idle");
  };

  const selectedHistoryItem = historyItems.find((item) => item.id === selectedHistoryId) ?? null;

  const startDividerLoading = (
    requestId: number,
    splitViewAlreadyActive: boolean,
  ) => {
    if (dividerTimeoutRef.current !== null) {
      window.clearTimeout(dividerTimeoutRef.current);
      dividerTimeoutRef.current = null;
    }

    if (splitViewAlreadyActive) {
      setDividerPhase("resetting");
      dividerTimeoutRef.current = window.setTimeout(() => {
        setDividerPhase("idle");
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (requestId !== requestIdRef.current) {
              return;
            }
            console.log("[App] divider transition", {
              requestId,
              from: "idle",
              to: "loading",
            });
            setDividerPhase("loading");
          });
        });
        console.log("[App] divider transition", {
          requestId,
          from: "resetting",
          to: "idle",
        });
      }, 220);
    } else {
      setDividerPhase("loading");
    }
  };

  const completeDivider = () => {
    if (dividerTimeoutRef.current !== null) {
      window.clearTimeout(dividerTimeoutRef.current);
      dividerTimeoutRef.current = null;
    }
    setDividerPhase("complete");
  };

  const handleAnalyze = async () => {
    logState("Explore clicked");

    if (analyzeInFlightRef.current) {
      logState("Explore ignored: analysis already in flight");
      return;
    }

    if (!canvasRef.current?.hasDrawing) {
      logState("Explore blocked: no drawing");
      alert("Please draw or upload an image first.");
      return;
    }

    analyzeInFlightRef.current = true;
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    const splitViewAlreadyActive = isExplored;

    console.log("[App] analysis start", {
      requestId,
      splitViewAlreadyActive,
      currentResultLength: galleryItems.length,
    });

    // ✅ 进入 analyzing：右侧显示 loading，不会再显示 “No object found”
    setAnalysisStatus("analyzing");
    setErrorMessage(null);
    setCurrentResult(null);
    setLatestHistoryEntry(null);
    setHistorySaveState("idle");
    setCollectionSaveState("idle");

    // ✅ 动效：重置并开始 loading
    startDividerLoading(requestId, splitViewAlreadyActive);

    try {
      const maxAttempts = 3;
      let result: Awaited<ReturnType<typeof analyzeImage>> | null = null;
      let nextItems: GalleryItem[] = [];
      let finalAttempt = 0;

      await raf();

      const drawingImageDataUrl = canvasRef.current.getImageBase64();

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        console.log("[App] analysis request sent", {
          requestId,
          attempt,
          payloadLength: drawingImageDataUrl.length,
        });

        const attemptResult = await analyzeImage(drawingImageDataUrl);

        console.log("[App] analysis response received", {
          requestId,
          attempt,
          analysisLength: attemptResult.analysis?.length ?? 0,
          resultLength: attemptResult.galleryItems?.length ?? 0,
        });

        // ✅ 防止旧请求覆盖新请求
        if (requestId !== requestIdRef.current) {
          console.log("[App] stale response ignored", {
            requestId,
            activeRequestId: requestIdRef.current,
          });
          return;
        }

        const attemptItems = Array.isArray(attemptResult.galleryItems)
          ? attemptResult.galleryItems
          : [];

        result = attemptResult;
        nextItems = attemptItems;
        finalAttempt = attempt;

        if (attemptItems.length > 0) break;

        if (attempt < maxAttempts) {
          console.warn("[App] empty gallery, retrying", {
            requestId,
            attempt,
            nextAttempt: attempt + 1,
          });
        }
      }

      if (!result) throw new Error("No analysis result received.");

      // ✅ 结果 ready：divider 迅速完成
      completeDivider();

      setGalleryItems(nextItems);
      setAnalysisStatus("ready");
      setIsClearingGallery(false);
      setErrorMessage(null);

      const nextResult: CurrentResult = {
        drawingImageDataUrl,
        analysis: result.analysis,
        galleryItems: nextItems,
      };

      setCurrentResult(nextResult);
      void persistHistoryEntry(nextResult, requestId);

      console.log("[App] ready committed", {
        requestId,
        finalAttempt,
        nextResultLength: nextItems.length,
      });
    } catch (error) {
      console.error("[App] analysis failed", { requestId, error });

      if (requestId !== requestIdRef.current) {
        console.log("[App] stale error ignored", {
          requestId,
          activeRequestId: requestIdRef.current,
        });
        return;
      }

      completeDivider();
      setAnalysisStatus("error");
      setErrorMessage("Something went wrong while analyzing the image.");
    } finally {
      if (requestId === requestIdRef.current) {
        analyzeInFlightRef.current = false;
      }

      console.log("[App] analysis end", {
        requestId,
        activeRequestId: requestIdRef.current,
        inFlight: analyzeInFlightRef.current,
      });
    }
  };

  const persistHistoryEntry = async (
    result: CurrentResult,
    requestId: number,
  ) => {
    if (!currentUser) {
      return;
    }

    setHistorySaveState("saving");

    try {
      const entry = await saveHistoryEntry(currentUser.uid, {
        drawingImageDataUrl: result.drawingImageDataUrl,
        analysis: result.analysis,
        galleryItems: result.galleryItems,
      });

      if (requestId !== requestIdRef.current) {
        return;
      }

      setLatestHistoryEntry(entry);
      setHistorySaveState("saved");
    } catch (error) {
      console.error("[App] history save failed", error);

      if (requestId !== requestIdRef.current) {
        return;
      }

      setHistorySaveState("error");
    }
  };

  const handleAddToCollection = async () => {
    if (!currentUser || !currentResult) {
      return;
    }

    setCollectionSaveState("saving");

    try {
      await addSharedArchiveEntry(currentUser.uid, {
        drawingImageUrl: latestHistoryEntry?.drawingImageUrl,
        drawingImageDataUrl: latestHistoryEntry
          ? undefined
          : currentResult.drawingImageDataUrl,
        analysis: currentResult.analysis,
        galleryItems: currentResult.galleryItems,
      });

      setCollectionSaveState("saved");
    } catch (error) {
      console.error("[App] collection save failed", error);
      setCollectionSaveState("error");
    }
  };

  const isReadyToAdd = analysisStatus === "ready" && currentResult !== null;

  const primaryButtonLabel =
    collectionSaveState === "saving"
      ? "Adding..."
      : collectionSaveState === "saved"
      ? "Added"
      : isReadyToAdd
      ? "Add"
      : "Submit";

  const primaryButtonTooltip =
    isReadyToAdd && collectionSaveState !== "saving" && collectionSaveState !== "saved"
      ? "Add this sketch to shared archive"
      : undefined;

  const handlePrimaryAction = () => {
    if (isReadyToAdd) {
      void handleAddToCollection();
      return;
    }

    void handleAnalyze();
  };

  const captureCanvasSnapshot = () => {
    canvasSnapshotRef.current = canvasRef.current?.getCanvasSnapshot() ?? null;
  };

  const restoreCanvasSnapshot = () => {
    const snapshot = canvasSnapshotRef.current;
    if (!snapshot) {
      return;
    }

    requestAnimationFrame(() => {
      canvasRef.current?.restoreCanvasSnapshot(snapshot);
    });
  };

  const handleOpenHistory = () => {
    captureCanvasSnapshot();
    setWorkspaceMode("history");
    setViewMode("explore");
    setDividerPhase("complete");
  };

  const handleExitHistoryMode = () => {
    setWorkspaceMode("draw");
    restoreCanvasSnapshot();
  };

  return (
    <>
      <div className={viewMode === "archive" ? "view-layer" : "view-layer is-hidden"}>
        <ArchiveLanding
          items={sharedArchiveItems}
          isLoading={isSharedArchiveLoading}
          onSelect={setSelectedRecord}
        />
      </div>

      <div className={viewMode === "explore" ? "view-layer" : "view-layer is-hidden"}>
        <ExploreWorkspace
          canvasRef={canvasRef}
          isExplored={isExplored}
          workspaceMode={workspaceMode}
          isLoading={isLoading}
          dividerPhase={dividerPhase}
          animateDividerReveal={animateDividerReveal}
          isClearingGallery={isClearingGallery}
          analysisStatus={analysisStatus}
          galleryItems={galleryItems}
          historyItems={historyItems}
          selectedHistoryId={selectedHistoryId}
          selectedHistoryItem={selectedHistoryItem}
          errorMessage={errorMessage}
          onSelectHistoryItem={(item) => setSelectedHistoryId(item.id)}
        />
      </div>

      <h1 className={`app-title global-title layout-${layoutMode}`}>Doodle Collection</h1>

      <div className={`global-controls layout-${layoutMode}`}>
        <div className="global-controls-stack">
          {(displayedControlsMode === "archive" || exitingControlsMode === "archive") && (
            <div
              className={`global-controls-panel ${
                displayedControlsMode === "archive"
                  ? "is-active"
                  : exitingControlsMode === "archive"
                  ? "is-exiting"
                  : ""
              }`}
            >
              <button
                className="archive-cta"
                type="button"
                onClick={() => {
                  setViewMode("explore");
                  restoreCanvasSnapshot();
                }}
              >
                Draw to explore
              </button>
            </div>
          )}

          {(displayedControlsMode === "draw" || exitingControlsMode === "draw") && (
            <div
              className={`global-controls-panel global-controls-panel--draw ${
                displayedControlsMode === "draw"
                  ? "is-active"
                  : exitingControlsMode === "draw"
                  ? "is-exiting"
                  : ""
              }`}
            >
              <AnalysisPanel
                isLoading={isLoading}
                showHistoryButton={historyItems.length > 0}
                onPrimaryAction={handlePrimaryAction}
                onBackToArchive={() => {
                  captureCanvasSnapshot();
                  setViewMode("archive");
                }}
                onOpenHistory={handleOpenHistory}
                onClear={handleClear}
                onUpload={(image) => canvasRef.current?.drawImage(image)}
                primaryButtonLabel={primaryButtonLabel}
                isPrimaryDisabled={
                  isLoading ||
                  collectionSaveState === "saving" ||
                  collectionSaveState === "saved"
                }
                isPrimaryCta={isReadyToAdd}
                primaryTooltip={primaryButtonTooltip}
              />
            </div>
          )}

          {(displayedControlsMode === "history" || exitingControlsMode === "history") && (
            <div
              className={`global-controls-panel ${
                displayedControlsMode === "history"
                  ? "is-active"
                  : exitingControlsMode === "history"
                  ? "is-exiting"
                  : ""
              }`}
            >
              <button className="history-cta" type="button" onClick={handleExitHistoryMode}>
                Draw to explore
              </button>
            </div>
          )}
        </div>
      </div>

      <CollectionModal
        key={selectedRecord?.id ?? "collection-modal-empty"}
        item={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    </>
  );
}
