const STROKE_COLOR = "#000000";
const STROKE_WIDTH = 3;
const TEXTURE_BRUSH_SIZE = STROKE_WIDTH * 4;
const TEXTURE_BRUSH_STAMP_SPACING = 0.2;
const TEXTURE_BRUSH_ALPHA = 1;
const TEXTURE_BRUSH_SOURCE = "/brushes/converted_splash.png";
const TEXTURE_BRUSH_BLACK_THRESHOLD = 8;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export interface Point {
  x: number;
  y: number;
}

export class TextureBrush {
  private brushTip: HTMLCanvasElement | null = null;
  private fallbackBrushTip: HTMLCanvasElement | null = null;

  load() {
    let cancelled = false;
    const image = new Image();

    image.onload = () => {
      if (cancelled) return;

      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      const tip = document.createElement("canvas");
      tip.width = width;
      tip.height = height;
      const context = tip.getContext("2d");
      if (!context) return;

      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      const imageData = context.getImageData(0, 0, width, height);
      const { data } = imageData;

      for (let index = 0; index < data.length; index += 4) {
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const a = data[index + 3];
        const brightness = Math.max(r, g, b);

        if (a === 0 || brightness <= TEXTURE_BRUSH_BLACK_THRESHOLD) {
          data[index] = 0;
          data[index + 1] = 0;
          data[index + 2] = 0;
          data[index + 3] = 0;
          continue;
        }

        const normalizedAlpha = Math.min(
          255,
          Math.round(
            ((brightness - TEXTURE_BRUSH_BLACK_THRESHOLD) /
              (255 - TEXTURE_BRUSH_BLACK_THRESHOLD)) * 255,
          ),
        );

        data[index] = 0;
        data[index + 1] = 0;
        data[index + 2] = 0;
        data[index + 3] = Math.max(a, normalizedAlpha);
      }

      context.putImageData(imageData, 0, 0);

      const composedTip = document.createElement("canvas");
      composedTip.width = width;
      composedTip.height = height;
      const composedContext = composedTip.getContext("2d");
      if (!composedContext) {
        this.brushTip = tip;
        return;
      }

      const centerX = width / 2;
      const centerY = height / 2;
      const coreRadius = Math.min(width, height) * 0.12;
      const coreGradient = composedContext.createRadialGradient(
        centerX,
        centerY,
        coreRadius * 0.1,
        centerX,
        centerY,
        coreRadius,
      );
      coreGradient.addColorStop(0, "rgba(0,0,0,0.55)");
      coreGradient.addColorStop(0.8, "rgba(0,0,0,0.18)");
      coreGradient.addColorStop(1, "rgba(0,0,0,0)");
      composedContext.fillStyle = coreGradient;
      composedContext.beginPath();
      composedContext.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
      composedContext.fill();

      const scales = [1, 0.84, 0.68, 0.52, 0.38, 0.26];
      const alphas = [1, 0.52, 0.34, 0.24, 0.16, 0.1];

      scales.forEach((scale, index) => {
        const drawWidth = width * scale;
        const drawHeight = height * scale;
        composedContext.globalAlpha = alphas[index] ?? 0.1;
        composedContext.drawImage(
          tip,
          (width - drawWidth) / 2,
          (height - drawHeight) / 2,
          drawWidth,
          drawHeight,
        );
      });

      composedContext.globalAlpha = 1;
      this.brushTip = composedTip;
    };

    image.src = TEXTURE_BRUSH_SOURCE;

    return () => {
      cancelled = true;
    };
  }

  drawStroke(
    context: CanvasRenderingContext2D,
    from: Point,
    to: Point,
    speed: number,
    dpr: number,
  ) {
    const brushTip = this.getTip();
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy);
    const speedFactor = clamp(speed / 1.4, 0, 1);
    const stampSize = TEXTURE_BRUSH_SIZE * dpr * (1 - speedFactor * 0.08);
    const spacing = Math.max(1, stampSize * TEXTURE_BRUSH_STAMP_SPACING);
    const steps = Math.max(1, Math.ceil(distance / spacing));

    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.globalAlpha = TEXTURE_BRUSH_ALPHA * (1.02 - speedFactor * 0.16);

    for (let step = 0; step <= steps; step += 1) {
      const t = steps === 0 ? 0 : step / steps;
      const centerX = from.x + dx * t;
      const centerY = from.y + dy * t;
      const jitterX = (Math.random() - 0.5) * stampSize * 0.04;
      const jitterY = (Math.random() - 0.5) * stampSize * 0.04;
      context.drawImage(
        brushTip,
        centerX - stampSize / 2 + jitterX,
        centerY - stampSize / 2 + jitterY,
        stampSize,
        stampSize,
      );
    }

    context.restore();
  }

  private getTip() {
    if (this.brushTip) {
      return this.brushTip;
    }
    if (!this.fallbackBrushTip) {
      this.fallbackBrushTip = this.createFallbackBrushTip();
    }
    return this.fallbackBrushTip;
  }

  private createFallbackBrushTip() {
    const size = Math.max(24, Math.round(TEXTURE_BRUSH_SIZE * 6));
    const tip = document.createElement("canvas");
    tip.width = size;
    tip.height = size;
    const context = tip.getContext("2d");
    if (!context) {
      return tip;
    }

    const center = size / 2;
    const radius = size * 0.3;
    const gradient = context.createRadialGradient(
      center,
      center,
      radius * 0.12,
      center,
      center,
      radius,
    );
    gradient.addColorStop(0, STROKE_COLOR);
    gradient.addColorStop(0.55, "rgba(0,0,0,0.4)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(center, center, radius, 0, Math.PI * 2);
    context.fill();
    return tip;
  }
}
