import { useEffect, useRef } from "react";

interface AnalysisPanelProps {
  analysis: string | null;
  isLoading: boolean;
  onAnalyze: () => void;
  onClear: () => void;
  onUpload: (image: HTMLImageElement) => void;
}

export function AnalysisPanel({
  analysis,
  isLoading,
  onAnalyze,
  onClear,
  onUpload,
}: AnalysisPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // Analysis is not shown in the panel anymore
  }, [analysis, isLoading]);

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (readerEvent) => {
      const source = readerEvent.target?.result;
      if (typeof source !== "string") return;

      const image = new Image();
      image.onload = () => onUpload(image);
      image.src = source;
    };
  };

  return (
    <section className="analysis-panel">
      <div className="controls-row">
        <button className="btn" type="button" onClick={onClear}>
          Clear
        </button>
        <button
          className="btn"
          type="button"
          onClick={onAnalyze}
          disabled={isLoading}
        >
          {isLoading ? "Analyzing..." : "Explore"}
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => fileInputRef.current?.click()}
        >
          Upload
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleUpload}
      />
    </section>
  );
}
