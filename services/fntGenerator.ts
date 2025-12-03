import { Glyph, FontSettings } from '../types';

export const generateFnt = (
  glyphs: Glyph[],
  settings: FontSettings,
  imageFileName: string
): string => {
  const lines: string[] = [];

  // Info line
  lines.push(`info face="${settings.face}" size=${settings.size} bold=${settings.bold ? 1 : 0} italic=${settings.italic ? 1 : 0} charset="" unicode=1 stretchH=100 smooth=1 aa=1 padding=0,0,0,0 spacing=1,1 outline=0`);
  
  // Common line
  lines.push(`common lineHeight=${settings.lineHeight} base=${settings.base} scaleW=${settings.scaleW} scaleH=${settings.scaleH} pages=1 packed=0 alphaChnl=1 redChnl=0 greenChnl=0 blueChnl=0`);
  
  // Page line
  lines.push(`page id=0 file="${imageFileName}"`);
  
  // Chars count
  lines.push(`chars count=${glyphs.length}`);

  // Char lines
  const globalTracking = settings.tracking || 0;

  glyphs.forEach(g => {
    // Determine char ID (ASCII code)
    let charId = -1;
    if (g.char && g.char.length > 0) {
      charId = g.char.charCodeAt(0);
    }
    
    // Apply global tracking to xadvance
    const finalXAdvance = g.xadvance + globalTracking;

    lines.push(`char id=${charId} x=${g.x} y=${g.y} width=${g.width} height=${g.height} xoffset=${g.xoffset} yoffset=${g.yoffset} xadvance=${finalXAdvance} page=0 chnl=15`);
  });

  return lines.join('\n');
};