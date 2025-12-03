import { Glyph } from '../types';

export const packTexture = async (
  imageSrc: string,
  glyphs: Glyph[]
): Promise<{ imageSrc: string; glyphs: Glyph[]; width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageSrc;
    img.onload = () => {
      // 1. Extract individual glyph images
      // We create a mini-canvas for each glyph to preserve its pixel data
      const items = glyphs.map(g => {
        const canvas = document.createElement('canvas');
        canvas.width = g.width;
        canvas.height = g.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            // Copy exact pixels from source
            ctx.drawImage(img, g.x, g.y, g.width, g.height, 0, 0, g.width, g.height);
        }
        return {
          id: g.id,
          w: g.width,
          h: g.height,
          canvas: canvas,
          originalGlyph: g
        };
      });

      // 2. Sort by height (descending) for better packing efficiency
      // Taller items first helps keep rows even.
      items.sort((a, b) => b.h - a.h);

      // 3. Estimate needed size
      const totalArea = items.reduce((acc, item) => acc + (item.w * item.h), 0);
      // Add 10% padding for safety
      const side = Math.ceil(Math.sqrt(totalArea * 1.1));
      
      // Pick a Power-of-Two width closest to the square root, or at least 128
      let targetWidth = 128;
      while (targetWidth < side) targetWidth *= 2;
      
      const padding = 2; // Spacing between characters
      let x = padding;
      let y = padding;
      let currentRowHeight = 0;
      
      // 4. Perform Layout (Shelf Packing)
      const packedItems: any[] = [];
      
      items.forEach(item => {
        // Check if item fits in current row
        if (x + item.w + padding > targetWidth) {
            // Move to next row
            x = padding;
            y += currentRowHeight + padding;
            currentRowHeight = 0;
        }
        
        packedItems.push({
            ...item,
            newX: x,
            newY: y
        });
        
        // Update cursor and row height
        currentRowHeight = Math.max(currentRowHeight, item.h);
        x += item.w + padding;
      });
      
      const finalHeight = y + currentRowHeight + padding;
      
      // 5. Draw to new final canvas
      const resultCanvas = document.createElement('canvas');
      resultCanvas.width = targetWidth;
      resultCanvas.height = finalHeight;
      const ctx = resultCanvas.getContext('2d');
      if (!ctx) {
        reject("Canvas context creation failed");
        return;
      }
      
      // Ensure transparent background
      ctx.clearRect(0, 0, targetWidth, finalHeight);
      
      const newGlyphs: Glyph[] = [];
      
      packedItems.forEach(p => {
          ctx.drawImage(p.canvas, p.newX, p.newY);
          newGlyphs.push({
              ...p.originalGlyph, // Keep char, id, offsets, advance
              x: p.newX,
              y: p.newY
          });
      });
      
      // Restore original order (by ID) so the list doesn't jump around
      newGlyphs.sort((a, b) => a.id - b.id);
      
      resolve({
          imageSrc: resultCanvas.toDataURL('image/png'),
          glyphs: newGlyphs,
          width: targetWidth,
          height: finalHeight
      });
    };
    img.onerror = (err) => reject(err);
  });
};