'use client';

import { useCallback, useState, DragEvent } from 'react';
import { Upload, FileText, X } from 'lucide-react';

interface DropZoneProps {
  label: string;
  accept: string;
  file: File | null;
  onFile: (file: File | null) => void;
  required?: boolean;
}

export default function DropZone({ label, accept, file, onFile, required }: DropZoneProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.csv')) {
      onFile(f);
    }
  }, [onFile]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer
        ${dragOver ? 'border-[var(--accent)] bg-[var(--accent-muted)]' : 'border-[var(--border)] hover:border-[var(--border-light)]'}
        ${file ? 'bg-[var(--bg-tertiary)]' : ''}`}
      onClick={() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.onchange = (e) => {
          const f = (e.target as HTMLInputElement).files?.[0];
          if (f) onFile(f);
        };
        input.click();
      }}
    >
      {file ? (
        <div className="flex items-center justify-center gap-3">
          <FileText size={20} className="text-[var(--accent)]" />
          <span className="text-[var(--text-primary)]">{file.name}</span>
          <span className="text-[var(--text-tertiary)] text-sm">
            ({(file.size / 1024 / 1024).toFixed(1)} MB)
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onFile(null); }}
            className="ml-2 p-1 rounded hover:bg-[var(--bg-hover)]"
          >
            <X size={16} className="text-[var(--text-tertiary)]" />
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <Upload size={24} className="mx-auto text-[var(--text-tertiary)]" />
          <p className="text-[var(--text-secondary)]">
            {label} {required && <span className="text-[var(--danger)]">*</span>}
          </p>
          <p className="text-sm text-[var(--text-tertiary)]">Drop CSV file or click to browse</p>
        </div>
      )}
    </div>
  );
}
