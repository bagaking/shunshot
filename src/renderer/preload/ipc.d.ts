export interface IpcAPI {
  // ... existing methods ...
  
  // OCR处理模式
  OCRProcessMode: {
    Default: 'default';
    Formal: 'formal';
    Simple: 'simple';
    Polish: 'polish';
    Bullets: 'bullets';
    Expand: 'expand';
  };
  
  // OCR相关
  ocrImage: (imageData: string, options?: { 
    mode?: string; 
    customPrompt?: string; 
  }) => Promise<{ text?: string; error?: string }>;
  
  // ... existing methods ...
} 