import React, { useState, useCallback, useRef } from 'react';
import { Glyph, FontSettings, ToolState } from './types';
import EditorCanvas from './components/EditorCanvas';
import GlyphProperties from './components/GlyphProperties';
import PreviewPanel from './components/PreviewPanel';
import { detectGlyphs, extractGlyphImages } from './services/imageProcessor';
import { generateFnt } from './services/fntGenerator';
import { identifyGlyphs } from './services/geminiService';
import { packTexture } from './services/texturePacker';

export default function App() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [originalFileName, setOriginalFileName] = useState<string>("font.png");
  const [glyphs, setGlyphs] = useState<Glyph[]>([]);
  const [selectedGlyphIds, setSelectedGlyphIds] = useState<number[]>([]);
  const [scale, setScale] = useState<number>(1);
  const [toolState, setToolState] = useState<ToolState>(ToolState.IDLE);
  
  const [fontSettings, setFontSettings] = useState<FontSettings>({
    face: 'CustomFont',
    size: 32,
    bold: false,
    italic: false,
    lineHeight: 32,
    base: 24,
    scaleW: 512,
    scaleH: 512,
    tracking: 0,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Handlers ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOriginalFileName(file.name);
    
    // Auto-set font face name from filename (remove extension)
    const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      setImageSrc(src);
      setToolState(ToolState.PROCESSING_IMAGE);
      
      // Auto-process
      const img = new Image();
      img.src = src;
      img.onload = () => {
        const tempCanvas = document.createElement('canvas');
        const detected = detectGlyphs(img, tempCanvas);
        setGlyphs(detected);
        setFontSettings(prev => ({
            ...prev,
            face: nameWithoutExt, // Automatically set font face name
            scaleW: img.width,
            scaleH: img.height,
            lineHeight: detected.length > 0 ? detected[0].height + 2 : 32
        }));
        setToolState(ToolState.IDLE);
      };
    };
    reader.readAsDataURL(file);
  };

  const handleIdentifyChars = async () => {
    if (!imageSrc || glyphs.length === 0) return;
    
    setToolState(ToolState.IDENTIFYING_CHARS);
    try {
        const base64Images = await extractGlyphImages(imageSrc, glyphs);
        
        // Identify in batches
        const BATCH_SIZE = 50;
        let allIdentifiedChars: Record<number, string> = {};

        for (let i = 0; i < base64Images.length; i += BATCH_SIZE) {
            const batch = base64Images.slice(i, i + BATCH_SIZE);
            const batchResults = await identifyGlyphs(batch);
            
            // Merge results
            batchResults.forEach(res => {
                const originalIndex = i + res.index;
                allIdentifiedChars[originalIndex] = res.char;
            });
        }
        
        setGlyphs(prev => prev.map((g, idx) => {
            if (allIdentifiedChars[idx]) {
                return { ...g, char: allIdentifiedChars[idx] };
            }
            return g;
        }));

    } catch (err) {
        console.error(err);
        alert("识别字符失败。请检查控制台日志。");
    } finally {
        setToolState(ToolState.IDLE);
    }
  };

  const handleAlignBaseline = () => {
      if (!imageSrc) return;
      const img = new Image();
      img.src = imageSrc;
      img.onload = () => {
          const tempCanvas = document.createElement('canvas');
          const detected = detectGlyphs(img, tempCanvas);
          
          // Basic heuristic merge to keep manually entered chars if simple re-detect
          // NOTE: This resets manually adjusted coords.
          if (detected.length === glyphs.length) {
              const updated = detected.map((newG, i) => ({
                  ...newG,
                  char: glyphs[i].char, 
                  id: glyphs[i].id
              }));
              setGlyphs(updated);
          } else {
              setGlyphs(detected);
          }
      };
  };

  const handleRepack = async () => {
      if (!imageSrc || glyphs.length === 0) return;
      
      setToolState(ToolState.PROCESSING_IMAGE);
      try {
          const result = await packTexture(imageSrc, glyphs);
          
          setImageSrc(result.imageSrc);
          setGlyphs(result.glyphs);
          setFontSettings(prev => ({
              ...prev,
              scaleW: result.width,
              scaleH: result.height
          }));
          
          alert(`布局优化完成！\n新尺寸: ${result.width} x ${result.height}`);
      } catch (e) {
          console.error(e);
          alert("布局优化失败，请重试。");
      } finally {
          setToolState(ToolState.IDLE);
      }
  };

  const handleUpdateGlyph = (updated: Glyph) => {
    setGlyphs((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
  };
  
  const handleDeleteGlyphs = () => {
      if (selectedGlyphIds.length === 0) return;
      setGlyphs(prev => prev.filter(g => !selectedGlyphIds.includes(g.id)));
      setSelectedGlyphIds([]);
  };

  const handleMergeGlyphs = () => {
      if (selectedGlyphIds.length < 2) return;
      
      const targetGlyphs = glyphs.filter(g => selectedGlyphIds.includes(g.id));
      if (targetGlyphs.length === 0) return;

      // Calculate union rectangle
      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;
      
      targetGlyphs.forEach(g => {
          minX = Math.min(minX, g.x);
          minY = Math.min(minY, g.y);
          maxX = Math.max(maxX, g.x + g.width);
          maxY = Math.max(maxY, g.y + g.height);
      });
      
      const newW = maxX - minX;
      const newH = maxY - minY;
      
      // Create new merged glyph
      const first = targetGlyphs[0];
      const mergedGlyph: Glyph = {
          ...first,
          x: minX,
          y: minY,
          width: newW,
          height: newH,
          xadvance: newW + 1,
          char: first.char // Keep first char name or empty
      };
      
      // Remove old ones, add new one
      const remaining = glyphs.filter(g => !selectedGlyphIds.includes(g.id));
      setGlyphs([...remaining, mergedGlyph]);
      setSelectedGlyphIds([mergedGlyph.id]);
  };

  const handleExportFnt = () => {
    const emptyChars = glyphs.filter(g => !g.char).length;
    if (emptyChars > 0) {
        const proceed = window.confirm(
            `警告：检测到 ${emptyChars} 个字符没有设置对应的文字(Char)。\n\n` +
            `这些字符在 .fnt 文件中的 ID 将为 -1，导致游戏引擎无法识别它们。\n\n` +
            `建议先使用“自动识别字符”或手动填写。是否仍要导出？`
        );
        if (!proceed) return;
    }

    const baseName = fontSettings.face;
    const imageExtension = originalFileName.substring(originalFileName.lastIndexOf('.'));
    const exportImageName = `${baseName}${imageExtension}`;

    const content = generateFnt(glyphs, fontSettings, exportImageName);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}.fnt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportImage = () => {
    if (!imageSrc) return;
    const a = document.createElement('a');
    a.href = imageSrc;
    const baseName = fontSettings.face;
    const imageExtension = originalFileName.substring(originalFileName.lastIndexOf('.'));
    a.download = `${baseName}${imageExtension}`;
    a.click();
  };

  const updateSetting = (key: keyof FontSettings, val: any) => {
    setFontSettings(prev => ({ ...prev, [key]: val }));
  };

  // --- Render ---

  const selectedGlyphs = glyphs.filter(g => selectedGlyphIds.includes(g.id));

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-950 text-gray-100 font-sans">
      
      {/* Left Sidebar: Settings & Controls */}
      <aside className="w-80 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col z-10">
        <div className="p-5 border-b border-gray-800">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span className="text-blue-500">◆</span> Font Architect
          </h1>
          <p className="text-xs text-gray-500 mt-1">位图字体生成器</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* File Input */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">1. 源文件</h2>
            <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden" 
            />
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-lg border border-gray-700 transition-all text-sm font-medium"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {imageSrc ? "重新上传" : "上传字体图片"}
            </button>
            <p className="text-[10px] text-gray-500 text-center">支持 PNG, JPG (建议透明背景)</p>
          </div>

          {/* AI Controls */}
          {glyphs.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-gray-800">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">2. 智能识别</h2>
              <button 
                onClick={handleIdentifyChars}
                disabled={toolState === ToolState.IDENTIFYING_CHARS}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all ${
                    toolState === ToolState.IDENTIFYING_CHARS 
                        ? 'bg-blue-900/50 text-blue-300 cursor-wait' 
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
                }`}
              >
                {toolState === ToolState.IDENTIFYING_CHARS ? (
                    <>
                        <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        正在识别...
                    </>
                ) : (
                    <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                        自动识别字符
                    </>
                )}
              </button>
              <div className="flex justify-between text-xs text-gray-500 px-1">
                 <span>已检测: {glyphs.length}</span>
                 <span>已识别: {glyphs.filter(g => g.char).length}</span>
              </div>
            </div>
          )}

          {/* Global Settings */}
          {imageSrc && (
              <div className="space-y-4 pt-4 border-t border-gray-800">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">3. 字体设置</h2>
                
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">字体名称 (控制导出文件名)</label>
                        <input 
                            type="text" 
                            value={fontSettings.face}
                            onChange={(e) => updateSetting('face', e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">字号 (Size)</label>
                            <input 
                                type="number" 
                                value={fontSettings.size}
                                onChange={(e) => updateSetting('size', parseInt(e.target.value))}
                                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">行高 (LineHeight)</label>
                            <input 
                                type="number" 
                                value={fontSettings.lineHeight}
                                onChange={(e) => updateSetting('lineHeight', parseInt(e.target.value))}
                                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                         <div>
                            <label className="block text-xs text-gray-400 mb-1">基线 (Base)</label>
                            <input 
                                type="number" 
                                value={fontSettings.base}
                                onChange={(e) => updateSetting('base', parseInt(e.target.value))}
                                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">字间距 (Spacing)</label>
                            <input 
                                type="number" 
                                value={fontSettings.tracking}
                                onChange={(e) => updateSetting('tracking', parseInt(e.target.value) || 0)}
                                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                    </div>
                    
                    <button 
                        onClick={handleAlignBaseline}
                        className="w-full mt-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs py-2 rounded text-gray-300 transition-colors"
                    >
                        自动对齐基线 (Auto Align)
                    </button>
                    
                    <button 
                        onClick={handleRepack}
                        disabled={toolState === ToolState.PROCESSING_IMAGE}
                        className="w-full mt-2 bg-indigo-900/50 hover:bg-indigo-800 border border-indigo-700 text-indigo-100 text-xs py-2 rounded transition-colors flex items-center justify-center gap-2"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                        优化布局 (Repack)
                    </button>
                </div>
              </div>
          )}
          
          {/* Export */}
          {imageSrc && (
             <div className="pt-6 mt-auto">
                 <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">4. 导出</h2>
                 <p className="text-[10px] text-yellow-500/80 mb-3 bg-yellow-900/20 p-2 rounded border border-yellow-900/30">
                     注意：必须同时下载这两个文件，并确保它们在同一个文件夹中文件名一致。
                 </p>
                 <div className="flex gap-2">
                    <button 
                        onClick={handleExportFnt}
                        className="flex-1 bg-green-700 hover:bg-green-600 text-white py-2 rounded text-sm font-medium transition-colors flex flex-col items-center justify-center gap-1"
                    >
                        <span>下载配置 (.fnt)</span>
                        <span className="text-[10px] opacity-70 font-mono">{fontSettings.face}.fnt</span>
                    </button>
                    <button 
                        onClick={handleExportImage}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-sm font-medium transition-colors flex flex-col items-center justify-center gap-1"
                    >
                        <span>下载图片 (.png)</span>
                        <span className="text-[10px] opacity-70 font-mono">{fontSettings.face}.png</span>
                    </button>
                 </div>
             </div>
          )}

        </div>
      </aside>

      {/* Main Content: Canvas */}
      <main className="flex-1 flex flex-col min-w-0 bg-gray-950">
        {/* Toolbar */}
        <div className="h-12 border-b border-gray-800 bg-gray-900 flex items-center px-4 justify-between">
            <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-400">缩放:</span>
                <input 
                    type="range" 
                    min="0.5" 
                    max="4" 
                    step="0.1" 
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="w-32 accent-blue-500"
                />
                <span className="text-xs font-mono text-gray-500">{Math.round(scale * 100)}%</span>
            </div>
            <div className="text-xs text-gray-500">
                {imageSrc ? "Shift + 点击可选择多个字符进行合并" : ""}
            </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative overflow-hidden">
             <EditorCanvas 
                imageSrc={imageSrc}
                glyphs={glyphs}
                selectedGlyphIds={selectedGlyphIds}
                onSelectGlyph={setSelectedGlyphIds}
                scale={scale}
             />
        </div>
        
        {/* Preview Panel */}
        {imageSrc && (
            <PreviewPanel 
                imageSrc={imageSrc}
                glyphs={glyphs}
                settings={fontSettings}
            />
        )}
      </main>

      {/* Right Sidebar: Details */}
      <aside className="w-72 flex-shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col z-10">
         <GlyphProperties 
            selectedGlyphs={selectedGlyphs}
            onUpdate={handleUpdateGlyph}
            onMerge={handleMergeGlyphs}
            onDelete={handleDeleteGlyphs}
         />
      </aside>

    </div>
  );
}