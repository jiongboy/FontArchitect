import React, { useState, useEffect, useRef } from 'react';
import { Glyph, FontSettings } from '../types';

interface PreviewPanelProps {
  imageSrc: string | null;
  glyphs: Glyph[];
  settings: FontSettings;
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({ imageSrc, glyphs, settings }) => {
  const [text, setText] = useState("Hello World 123");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgObj, setImgObj] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (imageSrc) {
      const img = new Image();
      img.src = imageSrc;
      img.onload = () => setImgObj(img);
    } else {
      setImgObj(null);
    }
  }, [imageSrc]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !imgObj) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set resolution match container
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // Handle High DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;

    // Draw Guidelines
    const startY = 20; // Padding top
    
    // Top line
    ctx.strokeStyle = '#334155'; // Slate 700
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, startY);
    ctx.lineTo(width, startY);
    ctx.stroke();

    // Baseline (Top + Base)
    const baselineY = startY + settings.base;
    ctx.strokeStyle = '#475569'; // Slate 600
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, baselineY);
    ctx.lineTo(width, baselineY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Bottom line (Top + LineHeight)
    const bottomY = startY + settings.lineHeight;
    ctx.strokeStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(0, bottomY);
    ctx.lineTo(width, bottomY);
    ctx.stroke();

    // Draw Text
    let cursorX = 10;
    const tracking = settings.tracking || 0;
    
    for (const char of text) {
      const glyph = glyphs.find(g => g.char === char);
      
      if (glyph) {
        const dstX = cursorX + glyph.xoffset;
        const dstY = startY + glyph.yoffset;

        ctx.drawImage(
          imgObj,
          glyph.x, glyph.y, glyph.width, glyph.height,
          dstX, dstY, glyph.width, glyph.height
        );

        cursorX += glyph.xadvance + tracking;
      } else {
        // Space or missing char
        if (char === ' ') {
            cursorX += (settings.size / 2) + tracking;
        } else {
            // Placeholder for missing
            ctx.fillStyle = 'rgba(239, 68, 68, 0.3)'; // Red
            ctx.fillRect(cursorX, startY, settings.size / 2, settings.lineHeight);
            cursorX += (settings.size / 2 + 2) + tracking;
        }
      }
    }

  }, [text, glyphs, settings, imgObj]);

  if (!imageSrc) return null;

  return (
    <div className="h-48 bg-gray-900 border-t border-gray-800 p-4 flex flex-col shrink-0 z-20">
      <div className="flex justify-between items-center mb-2">
         <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            效果预览 (Preview)
         </h3>
      </div>
      <div className="flex gap-4 h-full">
         <div className="w-1/4 flex flex-col gap-2">
             <textarea 
                value={text}
                onChange={e => setText(e.target.value)}
                className="w-full h-full bg-gray-800 border border-gray-700 rounded p-3 text-white resize-none text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500 font-mono"
                placeholder="在此输入文字以预览效果..."
             />
         </div>
         <div 
            ref={containerRef}
            className="flex-1 bg-gray-800 rounded border border-gray-700 overflow-hidden relative"
            style={{ 
                backgroundImage: 'linear-gradient(45deg, #1f2937 25%, transparent 25%), linear-gradient(-45deg, #1f2937 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1f2937 75%), linear-gradient(-45deg, transparent 75%, #1f2937 75%)',
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px' 
            }}
         >
             <canvas ref={canvasRef} className="w-full h-full block" />
             <div className="absolute top-2 right-2 flex flex-col items-end pointer-events-none opacity-50 space-y-1">
                <div className="flex items-center gap-1">
                    <div className="w-3 h-0 border-t border-dashed border-gray-400"></div>
                    <span className="text-[10px] text-gray-400">Base</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-0 border-t border-gray-500"></div>
                    <span className="text-[10px] text-gray-400">LineHeight</span>
                </div>
             </div>
         </div>
      </div>
    </div>
  );
};

export default PreviewPanel;