import { useEffect, useRef, useState } from "react";
import { AnalysisPanel } from "./features/analysis/AnalysisPanel";
import {
  SketchCanvas,
  type SketchCanvasHandle,
} from "./features/canvas/SketchCanvas";
import { Gallery } from "./features/gallery/Gallery";
import { analyzeImage } from "./lib/api";
import type { GalleryItem } from "./lib/types";

type AnalysisStatus = "idle" | "analyzing" | "ready" | "error";
type DividerPhase = "idle" | "resetting" | "loading" | "complete";

const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export default function App() {
  const canvasRef = useRef<SketchCanvasHandle>(null);

  const [analysis, setAnalysis] = useState<string | null>(null);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>("idle");
  const [isExplored, setIsExplored] = useState(false);

  const [dividerPhase, setDividerPhase] = useState<DividerPhase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const analyzeInFlightRef = useRef(false);
  const requestIdRef = useRef(0);
  const dividerTimeoutRef = useRef<number | null>(null);

  const isLoading = analysisStatus === "analyzing";

  const logState = (label: string, extra?: Record<string, unknown>) => {
    console.log(`[App] ${label}`, {
      analysisStatus,
      isExplored,
      resultLength: galleryItems.length,
      dividerPhase,
      errorMessage,
      requestId: requestIdRef.current,
      ...extra,
    });
  };

  useEffect(() => {
    return () => {
      if (dividerTimeoutRef.current !== null) {
        window.clearTimeout(dividerTimeoutRef.current);
      }
    };
  }, []);

  const handleClear = () => {
    logState("Clear clicked");

    if (dividerTimeoutRef.current !== null) {
      window.clearTimeout(dividerTimeoutRef.current);
      dividerTimeoutRef.current = null;
    }

    // Invalidate any in-flight response so clear won't be overwritten by stale data.
    requestIdRef.current += 1;
    analyzeInFlightRef.current = false;

    canvasRef.current?.clear();

    setAnalysis(null);
    setGalleryItems([]);
    setErrorMessage(null);

    // Keep split layout but blank gallery after clear.
    setAnalysisStatus("idle");
    setDividerPhase(isExplored ? "complete" : "idle");
  };

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

    // ✅ 保证 split view 先打开
    if (!isExplored) setIsExplored(true);

    // ✅ 进入 analyzing：右侧显示 loading，不会再显示 “No object found”
    setAnalysisStatus("analyzing");
    setErrorMessage(null);

    // ✅ 动效：重置并开始 loading
    startDividerLoading(requestId, splitViewAlreadyActive);

    try {
      const maxAttempts = 3;
      let result: Awaited<ReturnType<typeof analyzeImage>> | null = null;
      let nextItems: GalleryItem[] = [];
      let finalAttempt = 0;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        // ✅ 关键稳定性修复：等一帧，让 canvas 最后一笔先渲染完成
        await raf();

        const payload = canvasRef.current.getImageBase64();
        console.log("[App] analysis request sent", {
          requestId,
          attempt,
          payloadLength: payload.length,
        });

        const attemptResult = await analyzeImage(payload);

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

      setAnalysis(result.analysis);
      setGalleryItems(nextItems);
      setAnalysisStatus("ready");
      setErrorMessage(null);

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
      setAnalysis("Something went wrong while analyzing the image.");
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

  return (
    <main
      className={`app-shell ${isExplored ? "is-explored" : "is-initial"} ${
        isLoading ? "is-analyzing" : ""
      }`}
    >
      <section className="left-panel">
        <h1 className="app-title">Doodle Collection</h1>
        <SketchCanvas ref={canvasRef} />
        <div className="bottom-controls">
          <AnalysisPanel
            analysis={analysis}
            isLoading={isLoading}
            onAnalyze={handleAnalyze}
            onClear={handleClear}
            onUpload={(image) => canvasRef.current?.drawImage(image)}
          />
        </div>
      </section>

      <div className={`divider divider-${dividerPhase}`} />

      <section className="right-panel">
        {/* ✅ 核心：右侧只按 status 渲染，不会“提前 empty” */}
        {!isExplored && <div className="right-placeholder" />}

        {isExplored && analysisStatus === "idle" && (
          <div className="right-placeholder" />
        )}

        {isExplored && analysisStatus === "analyzing" && (
          <div className="right-loading">Analyzing…</div>
        )}

        {isExplored && analysisStatus === "ready" && galleryItems.length > 0 &&
          <Gallery items={galleryItems} />}

        {isExplored && analysisStatus === "ready" &&
          galleryItems.length === 0 && (
          <div className="right-empty">No object found</div>
        )}

        {isExplored && analysisStatus === "error" && (
          <div className="right-error">{errorMessage ?? "Error"}</div>
        )}
      </section>
    </main>
  );
}
