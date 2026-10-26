import { useRef, useState, type DragEvent } from 'react';
import { fileErrors, t } from '../lib/messages';

interface Props {
  disabled: boolean;
  onFile: (file: File) => void;
  onReject: (message: string) => void;
}

/** F-01: drag & drop + file picker. Keyboard users use the button. */
export function FileDrop({ disabled, onFile, onReject }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const pick = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (files.length > 1) {
      onReject(fileErrors.tooMany);
      return;
    }
    const file = files[0];
    if (file) onFile(file);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    if (!disabled) pick(e.dataTransfer.files);
  };

  return (
    <div
      className={`drop${over ? ' drop--over' : ''}${disabled ? ' drop--disabled' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <svg className="drop__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M12 18v-6M9 15l3-3 3 3" />
      </svg>
      <p className="drop__title">{t.dropTitle}</p>
      <p className="drop__or">{t.dropOr}</p>
      <button
        type="button"
        className="btn btn--primary"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {t.dropButton}
      </button>
      <p className="drop__hint" id="drop-hint">
        {t.dropHint}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="visually-hidden"
        tabIndex={-1}
        aria-describedby="drop-hint"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
