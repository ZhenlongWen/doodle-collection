import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

const STROKE_COLOR = "#0f172a";
const STROKE_WIDTH = 3;
const EXPORT_MIN_SIZE = 1024;
const EXPORT_MAX_SIZE = 1600;
const EXPORT_PADDING = 36;
const HINT_FONT_SIZE = 22;
const MAX_DEVICE_PIXEL_RATIO = 2;
const UPLOAD_PREVIEW_MAX_CSS_SIZE = 320;
const getClampedDevicePixelRatio = () =>
  Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);

export interface SketchCanvasHandle {
  clear: () => void;
  drawImage: (image: HTMLImageElement) => void;
  getImageBase64: () => string;
  hasDrawing: boolean;
}

interface SketchCanvasProps {
  onDrawStart?: () => void;
}

export const SketchCanvas = forwardRef<SketchCanvasHandle, SketchCanvasProps>(
  ({ onDrawStart }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const clearTimeoutRef = useRef<number | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawing, setHasDrawing] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const [showHint, setShowHint] = useState(true);
    const lastPoint = useRef({ x: 0, y: 0 });
    const contentModeRef = useRef<"empty" | "drawing" | "upload">("empty");
    const uploadedImageRef = useRef<HTMLImageElement | null>(null);
    const uploadedPreviewCssSizeRef = useRef<{ width: number; height: number } | null>(null);

    function drawHint(shouldShowHint: boolean) {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context || !shouldShowHint) return;

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#828791";
      context.font = `${
        HINT_FONT_SIZE * getClampedDevicePixelRatio()
      }px "Spline Sans Mono", monospace`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(
        "*Draw to explore",
        canvas.width / 2,
        canvas.height / 2,
      );
    }

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const parent = canvas.parentElement;
      const dpr = getClampedDevicePixelRatio();
      if (parent) {
        const cssWidth = parent.clientWidth || window.innerWidth;
        const cssHeight = parent.clientHeight || window.innerHeight;
        canvas.width = Math.max(1, Math.round(cssWidth * dpr));
        canvas.height = Math.max(1, Math.round(cssHeight * dpr));
      } else {
        canvas.width = Math.max(1, Math.round(window.innerWidth * dpr));
        canvas.height = Math.max(1, Math.round(window.innerHeight * dpr));
      }
      canvas.style.touchAction = "none";

      drawHint(true);

      let timeoutId: number | null = null;
      const redrawUploadedPreview = (
        targetCanvas: HTMLCanvasElement,
        targetContext: CanvasRenderingContext2D,
      ): boolean => {
        const uploadedImage = uploadedImageRef.current;
        const previewSize = uploadedPreviewCssSizeRef.current;
        if (!uploadedImage || !previewSize) {
          return false;
        }

        const dpr = getClampedDevicePixelRatio();
        const drawWidth = Math.max(1, Math.round(previewSize.width * dpr));
        const drawHeight = Math.max(1, Math.round(previewSize.height * dpr));
        const x = (targetCanvas.width - drawWidth) / 2;
        const y = (targetCanvas.height - drawHeight) / 2;

        targetContext.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
        targetContext.imageSmoothingEnabled = true;
        targetContext.imageSmoothingQuality = "high";
        targetContext.drawImage(uploadedImage, x, y, drawWidth, drawHeight);
        return true;
      };

      const applyResize = (newCssWidth: number, newCssHeight: number) => {
        if (!newCssWidth || !newCssHeight) return;
        const dpr = getClampedDevicePixelRatio();
        const newWidth = Math.max(1, Math.round(newCssWidth * dpr));
        const newHeight = Math.max(1, Math.round(newCssHeight * dpr));
        if (
          Math.abs(canvas.width - newWidth) < 2 &&
          Math.abs(canvas.height - newHeight) < 2
        ) return;

        const shouldRedrawUpload = contentModeRef.current === "upload" &&
          uploadedImageRef.current !== null &&
          uploadedPreviewCssSizeRef.current !== null;
        let backup: HTMLCanvasElement | null = null;

        if (!shouldRedrawUpload) {
          backup = document.createElement("canvas");
          backup.width = canvas.width;
          backup.height = canvas.height;
          const bCtx = backup.getContext("2d");
          if (bCtx) {
            bCtx.drawImage(canvas, 0, 0);
          }
        }

        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        if (shouldRedrawUpload && redrawUploadedPreview(canvas, ctx)) {
          return;
        }
        if (!backup) {
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        const scale = Math.min(newWidth / backup.width, newHeight / backup.height);
        const scaledWidth = backup.width * scale;
        const scaledHeight = backup.height * scale;
        const xOffset = (newWidth - scaledWidth) / 2;
        const yOffset = (newHeight - scaledHeight) / 2;
        ctx.drawImage(backup, xOffset, yOffset, scaledWidth, scaledHeight);
      };

      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        const newCssWidth = entry.contentRect.width;
        const newCssHeight = entry.contentRect.height;

        if (contentModeRef.current === "upload") {
          if (timeoutId !== null) {
            window.clearTimeout(timeoutId);
            timeoutId = null;
          }
          applyResize(newCssWidth, newCssHeight);
          return;
        }

        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
        timeoutId = window.setTimeout(() => {
          applyResize(newCssWidth, newCssHeight);
          timeoutId = null;
        }, 120);
      });

      if (parent) {
        observer.observe(parent);
      }

      return () => {
        observer.disconnect();
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
      };
    }, []);

    useEffect(() => {
      return () => {
        if (clearTimeoutRef.current !== null) {
          window.clearTimeout(clearTimeoutRef.current);
        }
      };
    }, []);

    useEffect(() => {
      if (showHint) {
        drawHint(showHint);
      }
    }, [showHint]);

    useEffect(() => {
      if (!showHint) return;
      if (!("fonts" in document)) return;

      let cancelled = false;
      document.fonts.load(`${HINT_FONT_SIZE}px "Spline Sans Mono"`).then(() => {
        if (!cancelled && showHint) {
          drawHint(showHint);
        }
      });

      return () => {
        cancelled = true;
      };
    }, [showHint]);

    const beginDrawing = (x: number, y: number) => {
      if (isClearing) {
        setIsClearing(false);
      }
      uploadedImageRef.current = null;
      uploadedPreviewCssSizeRef.current = null;
      contentModeRef.current = "drawing";
      setIsDrawing(true);
      lastPoint.current = { x, y };

      if (showHint) {
        setShowHint(false);
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (canvas && context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
        }
      }

      if (!hasDrawing) {
        setHasDrawing(true);
        onDrawStart?.();
      }
    };

    const continueDrawing = (x: number, y: number) => {
      if (!isDrawing) return;

      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;

      context.beginPath();
      context.moveTo(lastPoint.current.x, lastPoint.current.y);
      context.lineTo(x, y);
      context.lineCap = "round";
      context.lineWidth = STROKE_WIDTH * getClampedDevicePixelRatio();
      context.strokeStyle = STROKE_COLOR;
      context.stroke();

      lastPoint.current = { x, y };
    };

    const endDrawing = () => {
      setIsDrawing(false);
    };

    const getPointFromMouse = (event: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const visualScale = Math.min(
        rect.width / canvas.width,
        rect.height / canvas.height,
      );
      const visualWidth = canvas.width * visualScale;
      const visualHeight = canvas.height * visualScale;
      const offsetX = (rect.width - visualWidth) / 2;
      const offsetY = (rect.height - visualHeight) / 2;

      return {
        x: (event.clientX - rect.left - offsetX) / visualScale,
        y: (event.clientY - rect.top - offsetY) / visualScale,
      };
    };

    const getPointFromTouch = (event: React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const visualScale = Math.min(
        rect.width / canvas.width,
        rect.height / canvas.height,
      );
      const visualWidth = canvas.width * visualScale;
      const visualHeight = canvas.height * visualScale;
      const offsetX = (rect.width - visualWidth) / 2;
      const offsetY = (rect.height - visualHeight) / 2;
      const touch = event.touches[0];
      return {
        x: (touch.clientX - rect.left - offsetX) / visualScale,
        y: (touch.clientY - rect.top - offsetY) / visualScale,
      };
    };

    const getContentBounds = (
      canvas: HTMLCanvasElement,
    ): { x: number; y: number; width: number; height: number } | null => {
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return null;

      const { width, height } = canvas;
      const pixels = context.getImageData(0, 0, width, height).data;

      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const alpha = pixels[(y * width + x) * 4 + 3];
          if (alpha === 0) continue;

          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }

      if (maxX < minX || maxY < minY) return null;

      const left = Math.max(0, minX - EXPORT_PADDING);
      const top = Math.max(0, minY - EXPORT_PADDING);
      const right = Math.min(width, maxX + 1 + EXPORT_PADDING);
      const bottom = Math.min(height, maxY + 1 + EXPORT_PADDING);

      return {
        x: left,
        y: top,
        width: Math.max(1, right - left),
        height: Math.max(1, bottom - top),
      };
    };

    useImperativeHandle(ref, () => ({
      clear: () => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;

        if (clearTimeoutRef.current !== null) {
          window.clearTimeout(clearTimeoutRef.current);
          clearTimeoutRef.current = null;
        }

        setIsClearing(true);
        clearTimeoutRef.current = window.setTimeout(() => {
          context.clearRect(0, 0, canvas.width, canvas.height);
          setHasDrawing(false);
          setShowHint(true);
          uploadedImageRef.current = null;
          uploadedPreviewCssSizeRef.current = null;
          contentModeRef.current = "empty";
          setIsClearing(false);
          clearTimeoutRef.current = null;
        }, 180);
      },
      drawImage: (image: HTMLImageElement) => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;

        if (clearTimeoutRef.current !== null) {
          window.clearTimeout(clearTimeoutRef.current);
          clearTimeoutRef.current = null;
        }
        if (isClearing) {
          setIsClearing(false);
        }

        const dpr = getClampedDevicePixelRatio();
        const canvasCssWidth = canvas.width / dpr;
        const canvasCssHeight = canvas.height / dpr;
        const naturalWidth = image.naturalWidth || image.width;
        const naturalHeight = image.naturalHeight || image.height;

        const maxPreviewWidth = Math.min(canvasCssWidth * 0.82, UPLOAD_PREVIEW_MAX_CSS_SIZE);
        const maxPreviewHeight = Math.min(canvasCssHeight * 0.82, UPLOAD_PREVIEW_MAX_CSS_SIZE);
        const scale = Math.min(
          maxPreviewWidth / naturalWidth,
          maxPreviewHeight / naturalHeight,
          1,
        );
        const drawCssWidth = naturalWidth * scale;
        const drawCssHeight = naturalHeight * scale;
        const drawWidth = Math.max(1, Math.round(drawCssWidth * dpr));
        const drawHeight = Math.max(1, Math.round(drawCssHeight * dpr));
        const x = (canvas.width - drawWidth) / 2;
        const y = (canvas.height - drawHeight) / 2;

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(image, x, y, drawWidth, drawHeight);

        setShowHint(false);
        setHasDrawing(true);
        uploadedImageRef.current = image;
        uploadedPreviewCssSizeRef.current = {
          width: drawCssWidth,
          height: drawCssHeight,
        };
        contentModeRef.current = "upload";
      },
      getImageBase64: () => {
        const canvas = canvasRef.current;
        if (!canvas) return "";

        const crop = getContentBounds(canvas) ?? {
          x: 0,
          y: 0,
          width: canvas.width,
          height: canvas.height,
        };

        console.log("[SketchCanvas] export image", {
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          cropX: crop.x,
          cropY: crop.y,
          cropWidth: crop.width,
          cropHeight: crop.height,
          devicePixelRatio: getClampedDevicePixelRatio(),
        });

        const longestEdge = Math.max(crop.width, crop.height);
        const exportSize = Math.min(
          EXPORT_MAX_SIZE,
          Math.max(EXPORT_MIN_SIZE, Math.round(longestEdge)),
        );
        console.log("[SketchCanvas] export target size", { exportSize });

        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = exportSize;
        exportCanvas.height = exportSize;
        const exportContext = exportCanvas.getContext("2d");
        if (!exportContext) return "";

        exportContext.imageSmoothingEnabled = true;
        exportContext.imageSmoothingQuality = "high";
        exportContext.fillStyle = "white";
        exportContext.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

        const scale = Math.min(
          exportCanvas.width / crop.width,
          exportCanvas.height / crop.height,
        );
        const drawWidth = crop.width * scale;
        const drawHeight = crop.height * scale;
        const x = (exportCanvas.width - drawWidth) / 2;
        const y = (exportCanvas.height - drawHeight) / 2;

        exportContext.drawImage(
          canvas,
          crop.x,
          crop.y,
          crop.width,
          crop.height,
          x,
          y,
          drawWidth,
          drawHeight,
        );

        return exportCanvas.toDataURL("image/png");
      },
      hasDrawing,
    }));

    return (
      <canvas
        ref={canvasRef}
        className={isClearing ? "canvas-clearing" : ""}
        onMouseDown={(event) => {
          const point = getPointFromMouse(event);
          if (point) beginDrawing(point.x, point.y);
        }}
        onMouseMove={(event) => {
          const point = getPointFromMouse(event);
          if (point) continueDrawing(point.x, point.y);
        }}
        onMouseUp={endDrawing}
        onMouseLeave={endDrawing}
        onTouchStart={(event) => {
          event.preventDefault();
          const point = getPointFromTouch(event);
          if (point) beginDrawing(point.x, point.y);
        }}
        onTouchMove={(event) => {
          event.preventDefault();
          const point = getPointFromTouch(event);
          if (point) continueDrawing(point.x, point.y);
        }}
        onTouchEnd={endDrawing}
      />
    );
  },
);

SketchCanvas.displayName = "SketchCanvas";
