import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

const STROKE_COLOR = "#0f172a";
const STROKE_WIDTH = 3;
const EXPORT_SIZE = 800;
const EXPORT_PADDING = 36;

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

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth || window.innerWidth;
        canvas.height = parent.clientHeight || window.innerHeight;
      } else {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
      canvas.style.touchAction = "none";

      renderHint();

      let timeoutId: number;
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
          const newWidth = entry.contentRect.width;
          const newHeight = entry.contentRect.height;
          if (!newWidth || !newHeight) return;
          if (
            Math.abs(canvas.width - newWidth) < 2 &&
            Math.abs(canvas.height - newHeight) < 2
          ) return;

          const backup = document.createElement("canvas");
          backup.width = canvas.width;
          backup.height = canvas.height;
          const bCtx = backup.getContext("2d");
          if (bCtx) {
            bCtx.drawImage(canvas, 0, 0);
          }

          canvas.width = newWidth;
          canvas.height = newHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const scale = Math.min(
              newWidth / backup.width,
              newHeight / backup.height,
            );
            const scaledWidth = backup.width * scale;
            const scaledHeight = backup.height * scale;
            const xOffset = (newWidth - scaledWidth) / 2;
            const yOffset = (newHeight - scaledHeight) / 2;
            ctx.drawImage(backup, xOffset, yOffset, scaledWidth, scaledHeight);
          }
        }, 600);
      });

      if (parent) {
        observer.observe(parent);
      }

      return () => {
        observer.disconnect();
        window.clearTimeout(timeoutId);
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
        renderHint();
      }
    }, [showHint]);

    const renderHint = () => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context || !showHint) return;

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#9ca3af";
      context.font = "22px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(
        "Draw to explore",
        canvas.width / 2,
        canvas.height / 2,
      );
    };

    const beginDrawing = (x: number, y: number) => {
      if (isClearing) {
        setIsClearing(false);
      }
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
      context.lineWidth = STROKE_WIDTH;
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
          setShowHint(false);
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

        const scale = Math.min(
          canvas.width / image.width,
          canvas.height / image.height,
        );
        const drawWidth = image.width * scale;
        const drawHeight = image.height * scale;
        const x = (canvas.width - drawWidth) / 2;
        const y = (canvas.height - drawHeight) / 2;

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, x, y, drawWidth, drawHeight);

        setShowHint(false);
        setHasDrawing(true);
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
        });

        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = EXPORT_SIZE;
        exportCanvas.height = EXPORT_SIZE;
        const exportContext = exportCanvas.getContext("2d");
        if (!exportContext) return "";

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
