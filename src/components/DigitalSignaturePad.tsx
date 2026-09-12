import React, { useRef, useState, useEffect } from 'react';
import { Eraser, Check, PenTool } from 'lucide-react';
import { triggerLightHaptic } from '../lib/mobileBridge';

interface DigitalSignaturePadProps {
  onSave: (signatureDataUrl: string) => void;
  initialSignature?: string;
  label?: string;
  signeeName?: string;
  height?: number;
}

export function DigitalSignaturePad({
  onSave,
  initialSignature,
  label = 'Driver / Customer Signature',
  signeeName,
  height = 160
}: DigitalSignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(Boolean(initialSignature));
  const [prevPoint, setPrevPoint] = useState<{ x: number; y: number } | null>(null);

  // Initialize canvas resolution for retina displays
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.strokeStyle = '#38bdf8'; // Sky blue ink for high contrast on dark UI
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (initialSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = initialSignature;
    }
  }, [initialSignature]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);
    const coords = getCanvasCoords(e);
    setPrevPoint(coords);
    triggerLightHaptic();
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !prevPoint) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentCoords = getCanvasCoords(e);

    ctx.beginPath();
    ctx.moveTo(prevPoint.x, prevPoint.y);
    ctx.lineTo(currentCoords.x, currentCoords.y);
    ctx.stroke();

    setPrevPoint(currentCoords);
    setHasSignature(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setPrevPoint(null);

    const canvas = canvasRef.current;
    if (canvas && hasSignature) {
      const dataUrl = canvas.toDataURL('image/png');
      onSave(dataUrl);
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasSignature(false);
    onSave('');
    triggerLightHaptic();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-slate-300 font-bold text-xs flex items-center gap-1.5">
          <PenTool className="w-3.5 h-3.5 text-sky-400" />
          <span>{label}</span>
          {signeeName && (
            <span className="text-slate-400 font-normal">({signeeName})</span>
          )}
        </label>
        {hasSignature && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[11px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/20 active:scale-95 transition-all"
          >
            <Eraser className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      <div className="relative rounded-2xl overflow-hidden border-2 border-dashed border-slate-700 bg-slate-950 touch-none select-none">
        <canvas
          ref={canvasRef}
          style={{ height: `${height}px`, width: '100%' }}
          className="cursor-crosshair block w-full"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />

        {/* Guidance Baseline */}
        <div className="absolute bottom-6 left-6 right-6 border-b border-slate-800 pointer-events-none flex justify-between items-center text-[10px] text-slate-600 font-mono">
          <span>Sign above line</span>
          <span>✕</span>
        </div>

        {!hasSignature && !isDrawing && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-500 text-xs gap-1.5">
            <PenTool className="w-5 h-5 text-slate-600" />
            <p className="font-medium">Draw signature with finger or stylus</p>
          </div>
        )}
      </div>
    </div>
  );
}
