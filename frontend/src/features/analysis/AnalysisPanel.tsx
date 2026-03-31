import { useRef } from "react";

interface AnalysisPanelProps {
  isLoading: boolean;
  showHistoryButton: boolean;
  onPrimaryAction: () => void;
  onBackToArchive: () => void;
  onOpenHistory: () => void;
  onClear: () => void;
  onUpload: (image: HTMLImageElement) => void;
  primaryButtonLabel: string;
  isPrimaryDisabled: boolean;
  isPrimaryCta: boolean;
  primaryTooltip?: string;
}

export function AnalysisPanel({
  isLoading,
  showHistoryButton,
  onPrimaryAction,
  onBackToArchive,
  onOpenHistory,
  onClear,
  onUpload,
  primaryButtonLabel,
  isPrimaryDisabled,
  isPrimaryCta,
  primaryTooltip,
}: AnalysisPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        <button
          className="icon-btn"
          type="button"
          onClick={onBackToArchive}
          aria-label="Back to archive"
          title="Back to archive"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M14.5 5.5L8 12L14.5 18.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => fileInputRef.current?.click()}
        >
          Upload
        </button>
        <button className="btn" type="button" onClick={onClear}>
          Clear
        </button>
        <button
          className={isPrimaryCta ? "workspace-cta action-tooltip" : "btn"}
          type="button"
          onClick={onPrimaryAction}
          disabled={isPrimaryDisabled}
          data-tooltip={primaryTooltip}
        >
          {isLoading ? "Submitting..." : primaryButtonLabel}
        </button>
        {showHistoryButton && (
          <button className="btn" type="button" onClick={onOpenHistory}>
            History
          </button>
        )}
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
