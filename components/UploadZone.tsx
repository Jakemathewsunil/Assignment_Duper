import React, { useCallback } from 'react';
import { Upload, X, FileText, Image as ImageIcon } from 'lucide-react';

interface UploadZoneProps {
  label: string;
  description: string;
  file: File | null;
  previewUrl: string | null;
  onFileSelect: (file: File) => void;
  onClear: () => void;
  accept?: string;
  variant?: 'retro-question' | 'retro-handwriting' | 'default';
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  label,
  description,
  file,
  previewUrl,
  onFileSelect,
  onClear,
  accept = "image/*",
  variant = 'default'
}) => {
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  }, [onFileSelect]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  // --- RETRO QUESTION STYLE (Lime Green Box) ---
  if (variant === 'retro-question') {
    return (
      <div className="relative w-full max-w-xl group">
        <div 
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={handleDrop}
          className={`
            relative z-10 bg-[#ccff00] border-4 border-black p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.8)]
            transition-transform hover:-translate-y-1 active:translate-y-0 cursor-pointer
            flex flex-col
          `}
        >
          <input 
            type="file" 
            onChange={handleChange} 
            accept={accept} 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" 
          />
          
          <div className="flex items-start gap-3">
            <span className="font-bold text-xl md:text-2xl text-black bg-white px-2 border-2 border-black shrink-0">
              USER:
            </span>
            <div className="font-mono text-black text-lg md:text-xl leading-tight pt-1">
              {file ? (
                <span className="break-all">{file.name} (Loaded)</span>
              ) : (
                 <span>{label} <span className="opacity-50 text-sm block mt-1">{description}</span></span>
              )}
            </div>
          </div>

          {previewUrl && (
            <div className="mt-4 relative bg-white border-2 border-black p-1">
              <img src={previewUrl} alt="Preview" className="w-full h-32 md:h-48 object-cover grayscale contrast-125" />
              <button 
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClear(); }}
                className="absolute -top-3 -right-3 bg-red-500 text-white border-2 border-black p-1 hover:scale-110 transition-transform z-30"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          
          {!previewUrl && (
             <div className="mt-4 h-32 md:h-48 border-2 border-dashed border-black/30 flex items-center justify-center bg-black/5">
                <span className="text-black/50 font-bold uppercase tracking-widest">[ Drop File Here ]</span>
             </div>
          )}
        </div>
      </div>
    );
  }

  // --- RETRO HANDWRITING STYLE (Photo Frame) ---
  if (variant === 'retro-handwriting') {
    return (
      <div 
        className="relative w-full max-w-sm rotate-1 hover:rotate-0 transition-transform duration-300"
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={handleDrop}
      >
        <div className="bg-white p-3 pb-8 border border-slate-300 shadow-xl relative">
          <input 
            type="file" 
            onChange={handleChange} 
            accept={accept} 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" 
          />
          
          <div className="w-full aspect-square bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden relative">
            {previewUrl ? (
              <img src={previewUrl} alt="Handwriting" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center p-4">
                 <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                 <p className="text-slate-400 text-sm font-mono">Upload Handwriting Reference</p>
              </div>
            )}
             
            {previewUrl && (
              <button 
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClear(); }}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 z-30 shadow-md hover:bg-red-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <div className="mt-4 text-center font-handwriting text-slate-600 text-lg rotate-[-1deg]">
            {file ? "My Handwriting Style" : "Ref: handwriting_sample.jpg"}
          </div>
          
          {/* Tape effect */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-8 bg-yellow-100/80 rotate-2 shadow-sm backdrop-blur-sm border border-yellow-200/50"></div>
        </div>
      </div>
    );
  }

  // --- DEFAULT FALLBACK ---
  return (
    <div 
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={handleDrop}
      className="w-full h-64 border-2 border-dashed border-slate-300 rounded-xl hover:border-indigo-500 hover:bg-indigo-50/30 transition-all cursor-pointer relative bg-slate-50 flex flex-col items-center justify-center p-6 text-center group"
    >
      <input 
        type="file" 
        onChange={handleChange} 
        accept={accept} 
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
      />
      <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
        {label.includes("Question") ? (
          <FileText className="w-8 h-8 text-indigo-500" />
        ) : (
          <ImageIcon className="w-8 h-8 text-emerald-500" />
        )}
      </div>
      <h3 className="text-lg font-semibold text-slate-800 mb-1">{label}</h3>
      <p className="text-sm text-slate-500 max-w-xs">{description}</p>
    </div>
  );
};