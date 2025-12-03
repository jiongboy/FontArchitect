import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Glyph } from '../types';

interface EditorCanvasProps {
  imageSrc: string | null;
  glyphs: Glyph[];
  selectedGlyphIds: number[];
  onSelectGlyph: (ids: number[]) => void;
  scale: number;
}

const EditorCanvas: React.FC<EditorCanvasProps> = ({
  imageSrc,
  glyphs,
  selectedGlyphIds,
  onSelectGlyph,
  scale,
}) => {
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

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !imgObj) return;

    // Set canvas dimensions based on image and scale
    canvas.width = imgObj.width * scale;
    canvas.height = imgObj.height * scale;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false; // Pixel art friendly

    // Draw Image
    ctx.save();
    ctx.scale(scale, scale);
    ctx.drawImage(imgObj, 0, 0);

    // Draw Glyphs
    glyphs.forEach((glyph) => {
      const isSelected = selectedGlyphIds.includes(glyph.id);
      const isMissingChar = !glyph.char || glyph.char === '';
      
      // Box
      ctx.beginPath();
      ctx.lineWidth = 1 / scale; // Keep line thin regardless of zoom
      ctx.strokeStyle = isSelected ? '#FACC15' : 'rgba(56, 189, 248, 0.6)'; // Yellow if selected, Blue semi-transparent if not
      
      if (isSelected) {
        ctx.lineWidth = 2 / scale;
      } else if (isMissingChar) {
        // Red border for missing chars to make them stand out
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
      }
      
      ctx.rect(glyph.x, glyph.y, glyph.width, glyph.height);
      ctx.stroke();

      // Label (only if zoomed in enough or selected)
      if (scale > 1 || isSelected) {
        ctx.fillStyle = isSelected ? '#FACC15' : 'rgba(56, 189, 248, 0.8)';
        ctx.font = `${10 / scale}px sans-serif`;
        const label = glyph.char || `#${glyph.id}`;
        ctx.fillText(label, glyph.x, glyph.y - (2 / scale));
      }

      // WARNING BADGE for missing chars
      if (isMissingChar) {
          const badgeSize = 14 / scale;
          const cx = glyph.x + glyph.width;
          const cy = glyph.y;
          
          ctx.beginPath();
          ctx.arc(cx, cy, badgeSize / 2, 0, Math.PI * 2);
          ctx.fillStyle = '#EF4444'; // Red-500
          ctx.fill();
          
          ctx.fillStyle = '#FFFFFF';
          ctx.font = `bold ${10 / scale}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('!', cx, cy);
      }
    });

    ctx.restore();
  }, [imgObj, glyphs, selectedGlyphIds, scale]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !imgObj) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    // Find clicked glyph (reverse to pick top-most if overlapping)
    const clickedGlyph = [...glyphs].reverse().find(
      (g) =>
        x >= g.x &&
        x <= g.x + g.width &&
        y >= g.y &&
        y <= g.y + g.height
    );

    if (e.shiftKey) {
        // Multi-select toggle
        if (clickedGlyph) {
            if (selectedGlyphIds.includes(clickedGlyph.id)) {
                onSelectGlyph(selectedGlyphIds.filter(id => id !== clickedGlyph.id));
            } else {
                onSelectGlyph([...selectedGlyphIds, clickedGlyph.id]);
            }
        }
    } else {
        // Single select
        onSelectGlyph(clickedGlyph ? [clickedGlyph.id] : []);
    }
  };

  if (!imageSrc) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-gray-900 rounded-lg border-2 border-dashed border-gray-700">
        <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-lg">请上传图片以开始</p>
      </div>
    );
  }

  return (
    <div 
        ref={containerRef} 
        className="relative overflow-auto bg-gray-950 rounded-lg shadow-inner w-full h-full flex items-center justify-center p-8"
        style={{
            backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)',
            backgroundSize: '20px 20px'
        }}
    >
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="cursor-crosshair shadow-2xl"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
};

export default EditorCanvas;