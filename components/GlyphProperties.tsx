import React from 'react';
import { Glyph } from '../types';

interface GlyphPropertiesProps {
  selectedGlyphs: Glyph[];
  onUpdate: (updated: Glyph) => void;
  onMerge: () => void;
  onDelete: () => void;
}

const GlyphProperties: React.FC<GlyphPropertiesProps> = ({ selectedGlyphs, onUpdate, onMerge, onDelete }) => {
  if (selectedGlyphs.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>未选择字符</p>
        <p className="text-sm mt-2">点击画布中的方框以编辑。</p>
        <p className="text-xs mt-4 text-gray-600">提示: 按住 Shift 键点击可选择多个字符进行合并。</p>
      </div>
    );
  }

  if (selectedGlyphs.length > 1) {
      return (
        <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
            <h3 className="text-lg font-semibold text-white mb-4 border-b border-gray-700 pb-2">
                批量操作
            </h3>
            <div className="bg-gray-800 p-4 rounded mb-4 text-center">
                <span className="text-2xl font-bold text-blue-400">{selectedGlyphs.length}</span>
                <p className="text-gray-400 text-sm">已选择个对象</p>
            </div>
            
            <button
                onClick={onMerge}
                className="w-full mb-3 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors flex items-center justify-center gap-2"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                合并选中 (Merge)
            </button>
             <p className="text-xs text-gray-500 mb-4">
                 合并会将选中的多个方框组合成一个字符（用于修复分离的 "i", "!" 等）。
             </p>
            
            <button
                onClick={onDelete}
                className="w-full py-2 bg-red-900/50 hover:bg-red-900 text-red-200 border border-red-800 rounded transition-colors text-sm"
            >
                删除选中
            </button>
        </div>
      );
  }

  // Single Glyph Mode
  const glyph = selectedGlyphs[0];
  const isMissingChar = !glyph.char || glyph.char === '';

  const handleChange = (field: keyof Glyph, value: string | number) => {
    onUpdate({ ...glyph, [field]: value });
  };
  
  const handleAsciiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const code = parseInt(e.target.value);
      if (!isNaN(code) && code >= 0) {
          onUpdate({ ...glyph, char: String.fromCharCode(code) });
      } else if (e.target.value === '') {
          onUpdate({ ...glyph, char: '' });
      }
  };

  const InputField = ({ label, field, type = 'number' }: { label: string; field: keyof Glyph; type?: string }) => (
    <div className="mb-3">
      <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={glyph[field]}
        onChange={(e) => {
            const val = type === 'number' ? parseInt(e.target.value) || 0 : e.target.value;
            handleChange(field, val);
        }}
        className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
      />
    </div>
  );

  return (
    <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
      <h3 className="text-lg font-semibold text-white mb-4 border-b border-gray-700 pb-2 flex justify-between items-center">
        <span>属性</span>
        <span className="text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded">ID: {glyph.id}</span>
      </h3>
      
      <div className={`grid grid-cols-1 gap-2 mb-4 p-3 rounded border ${isMissingChar ? 'bg-red-900/10 border-red-800' : 'bg-gray-800 border-gray-700'}`}>
        <div className="flex flex-col items-center justify-center">
             <span className="text-xs text-gray-500 mb-1">字符 (Char)</span>
             <input 
                type="text" 
                maxLength={1}
                value={glyph.char}
                onChange={(e) => handleChange('char', e.target.value)}
                className={`bg-transparent text-center text-4xl font-bold focus:outline-none w-20 border-b border-transparent focus:border-blue-500 ${isMissingChar ? 'text-red-500' : 'text-yellow-400'}`}
                placeholder="?"
             />
             
             {isMissingChar && (
                 <span className="text-[10px] text-red-400 font-bold mt-1">未识别 (Missing)</span>
             )}
             
             <div className="w-full mt-3 pt-3 border-t border-gray-700/50 flex items-center justify-between">
                 <label className="text-xs text-gray-500 whitespace-nowrap mr-2">ASCII Code:</label>
                 <input 
                    type="number"
                    value={glyph.char ? glyph.char.charCodeAt(0) : ''}
                    onChange={handleAsciiChange}
                    className="w-16 bg-gray-900 border border-gray-600 rounded px-1 py-1 text-xs text-center text-white focus:border-blue-500 outline-none"
                    placeholder="N/A"
                 />
             </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <InputField label="X 坐标" field="x" />
        <InputField label="Y 坐标" field="y" />
        <InputField label="宽度" field="width" />
        <InputField label="高度" field="height" />
        <InputField label="X 偏移" field="xoffset" />
        <InputField label="Y 偏移" field="yoffset" />
        <div className="col-span-2">
            <InputField label="X 步进 (X Advance)" field="xadvance" />
        </div>
      </div>
      
       <div className="p-4 border-t border-gray-800 mt-4 -mx-4 pb-0">
         <button
            onClick={onDelete}
            className="w-full py-2 bg-red-900/50 hover:bg-red-900 text-red-200 border border-red-800 rounded transition-colors text-sm"
         >
             删除选中字符
         </button>
     </div>
    </div>
  );
};

export default GlyphProperties;