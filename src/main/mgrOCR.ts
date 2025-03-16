import type { NativeImage } from 'electron'
import OpenAI from 'openai'
import { Logger } from './logger'
import { mgrPreference } from './mgrPreference'
import { OpenAIClientManager } from './mgrAgents'

// OCR处理模式
export enum OCRProcessMode {
  Default = 'default',       // 普通识别
  Formal = 'formal',         // 正式化
  Simple = 'simple',         // 简化表达
  Polish = 'polish',         // 润色完善
  Bullets = 'bullets',       // 要点归纳
  Expand = 'expand'          // 内容扩展
}

// OCR选项接口
export interface OCROptions {
  mode?: OCRProcessMode;     // 处理模式
  customPrompt?: string;     // 自定义提示词
  existingText?: string;     // 已有文本（用于改写）
}

// 各种处理模式的系统提示词
const SYSTEM_PROMPTS: Record<OCRProcessMode, string> = {
  [OCRProcessMode.Default]: `你是一个图片内容识别专家，根据用户给到的图片，识别出原始文本, 组织格式后输出
注意:
- 用 Markdown 格式输出
- 如果没有文字，就返回"未检测到文字
- 只输出原始内容，不要加任何解释，也不要变成别的语言
- 文本分为多个区域时，也分段输出。顺序按照布局从上到下, 从左到右进行
- 识别到代码时，用代码段输出`,

  [OCRProcessMode.Formal]: `你是一个图片内容识别与文本编辑专家，请执行两个步骤：
1. 首先，准确识别图片中的所有文本
2. 然后，将识别出的文本改写为正式、专业的表达风格，保持原意但使用更加规范的词汇和句式
注意:
- 用 Markdown 格式输出最终结果
- 如果没有文字，就返回"未检测到文字"
- 保持内容的核心含义，但使用更加正式的语言
- 文本分为多个区域时，也分段输出，保持原有布局
- 识别到代码时，用代码段输出`,

  [OCRProcessMode.Simple]: `你是一个图片内容识别与文本编辑专家，请执行两个步骤：
1. 首先，准确识别图片中的所有文本
2. 然后，将识别出的文本简化，使用更简单的词汇和句式，让内容更容易理解，但保持核心含义
注意:
- 用 Markdown 格式输出最终结果
- 如果没有文字，就返回"未检测到文字"
- 简化复杂表达，但不要遗漏重要信息
- 文本分为多个区域时，也分段输出
- 识别到代码时，用代码段输出，可以添加简短注释解释复杂代码`,

  [OCRProcessMode.Polish]: `你是一个图片内容识别与文本编辑专家，请执行两个步骤：
1. 首先，准确识别图片中的所有文本
2. 然后，润色识别出的文本，使其更加流畅自然，表达更加准确，但不要改变原意
注意:
- 用 Markdown 格式输出最终结果
- 如果没有文字，就返回"未检测到文字"
- 修正语法和拼写错误
- 保持原文的风格和语气，只提高表达的质量
- 文本分为多个区域时，也分段输出
- 识别到代码时，用代码段输出，保持代码的正确性`,

  [OCRProcessMode.Bullets]: `你是一个图片内容识别与文本编辑专家，请执行两个步骤：
1. 首先，准确识别图片中的所有文本
2. 然后，将识别出的文本转换为简洁的要点列表，突出关键信息
注意:
- 用 Markdown 格式输出最终结果，使用项目符号标记每个要点
- 如果没有文字，就返回"未检测到文字"
- 抓取主要观点和关键事实，忽略次要细节
- 每个要点应该简明扼要，通常不超过一两句话
- 保持原文的主要内容和顺序
- 识别到代码时，可以总结代码的主要功能要点`,

  [OCRProcessMode.Expand]: `你是一个图片内容识别与文本编辑专家，请执行两个步骤：
1. 首先，准确识别图片中的所有文本
2. 然后，基于识别出的文本进行扩展，添加更多相关细节和信息，使内容更加丰富但保持原意
注意:
- 用 Markdown 格式输出最终结果
- 如果没有文字，就返回"未检测到文字"
- 添加相关的解释、例子或背景信息
- 扩展内容要与原文保持一致，不要引入矛盾
- 保持专业和客观的语气
- 文本分为多个区域时，也分段输出
- 识别到代码时，用代码段输出，可以添加对代码功能的详细解释`
};

// 定义纯文本处理的系统提示词
const TEXT_PROCESS_PROMPTS: Record<OCRProcessMode, string> = {
  [OCRProcessMode.Default]: `你是一个文本处理专家，请直接返回输入的文本，不要做任何修改。`,
  
  [OCRProcessMode.Formal]: `你是一个文本编辑专家，请将给定文本改写为正式、专业的表达风格，保持原意但使用更加规范的词汇和句式。
注意:
- 用 Markdown 格式输出
- 保持内容的核心含义，但使用更加正式的语言
- 保持原有布局和段落结构
- 代码段保持原样输出`,

  [OCRProcessMode.Simple]: `你是一个文本编辑专家，请将给定文本简化，使用更简单的词汇和句式，让内容更容易理解，但保持核心含义。
注意:
- 用 Markdown 格式输出
- 简化复杂表达，但不要遗漏重要信息
- 保持原有布局和段落结构
- 代码段可以保持原样输出，或添加简短注释解释复杂代码`,

  [OCRProcessMode.Polish]: `你是一个文本编辑专家，请润色给定文本，使其更加流畅自然，表达更加准确，但不要改变原意。
注意:
- 用 Markdown 格式输出
- 修正语法和拼写错误
- 保持原文的风格和语气，只提高表达的质量
- 保持原有布局和段落结构
- 代码段保持原样输出，保持代码的正确性`,

  [OCRProcessMode.Bullets]: `你是一个文本编辑专家，请将给定文本转换为简洁的要点列表，突出关键信息。
注意:
- 用 Markdown 格式输出，使用项目符号标记每个要点
- 抓取主要观点和关键事实，忽略次要细节
- 每个要点应该简明扼要，通常不超过一两句话
- 保持原文的主要内容和顺序
- 代码段可以总结为主要功能要点`,

  [OCRProcessMode.Expand]: `你是一个文本编辑专家，请基于给定文本进行扩展，添加更多相关细节和信息，使内容更加丰富但保持原意。
注意:
- 用 Markdown 格式输出
- 添加相关的解释、例子或背景信息
- 扩展内容要与原文保持一致，不要引入矛盾
- 保持专业和客观的语气
- 保持原有布局和段落结构
- 代码段可以保持原样输出，也可以添加对代码功能的详细解释`
};

/**
 * OCR 管理器
 */
export class OCRManager {
  private clientManager: OpenAIClientManager;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    this.clientManager = new OpenAIClientManager();
    
    // 监听配置变更
    this.unsubscribe = mgrPreference.subscribe((key, _) => {
      if (key.startsWith('aiModel.vision')) {
        // 配置变更时重新初始化客户端
        this.clientManager = new OpenAIClientManager();
      }
    });
  }

  /**
   * 识别图像中的文字，可选择不同的处理模式
   * @param image 要识别的图像
   * @param options 可选的OCR处理选项
   * @returns 识别结果或错误信息
   */
  async recognizeText(
    image: NativeImage, 
    options?: OCROptions
  ): Promise<{ text: string } | { error: string }> {
    try {
      // 如果提供了现有文本，则直接处理文本而不进行OCR
      if (options?.existingText && (options.mode !== OCRProcessMode.Default || options.customPrompt)) {
        return this.processExistingText(options.existingText, options);
      }
      
      const config = await mgrPreference.get<{
        apiKey: string
        baseURL: string
        modelName: string
      }>('aiModel.vision')

      if (!config?.modelName) {
        Logger.error('OCR service not configured: model name missing')
        return { error: 'OCR service not configured: model name missing' }
      }

      // 转换为 base64
      const base64Image = image.toDataURL().replace(/^data:image\/\w+;base64,/, '')
      
      // 获取处理模式
      const mode = options?.mode || OCRProcessMode.Default;
      
      // 获取系统提示词，优先使用自定义提示词
      let systemPrompt = options?.customPrompt;
      if (!systemPrompt) {
        systemPrompt = SYSTEM_PROMPTS[mode];
      }
      
      Logger.debug(`Calling OCR API with model ${config.modelName}, mode: ${mode}, image size ${JSON.stringify(image.getSize())}`)
      
      // 调用 OCR API with rate limiting and retries
      const response = await this.clientManager.executeWithRetry(
        'vision',
        async (client) => {
          return client.chat.completions.create({
            messages: [
              {
                role: 'system',
                content: systemPrompt
              },
              {
                role: 'user',
                content: [
                  { 
                    type: 'text', 
                    text: mode === OCRProcessMode.Default 
                      ? '这张图片说了啥' 
                      : '请识别并处理这张图片中的文本' 
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:image/png;base64,${base64Image}`,
                    },
                  },
                ],
              },
            ],
            model: config.modelName,
            max_tokens: 4096,
            temperature: 0,
          })
        }
      )

      const result = response.choices[0]?.message?.content || '识别失败'
      Logger.log(`OCR result (mode: ${mode}): ${result.substring(0, 50)}...`)
      Logger.debug(`OCR response complete: ${result ? result.substring(0, 30) + '...' : 'no content'}`)
      
      // 确保返回格式正确
      return { text: result || '识别失败，无内容返回' }
    } catch (error) {
      Logger.error('Failed to process OCR', error as Error)
      return { error: error instanceof Error ? error.message : 'OCR processing failed' }
    }
  }

  /**
   * 直接处理现有文本，不进行OCR识别
   * @param text 要处理的文本
   * @param options 处理选项
   * @returns 处理后的文本或错误信息
   */
  private async processExistingText(
    text: string,
    options: OCROptions
  ): Promise<{ text: string } | { error: string }> {
    try {
      Logger.debug('Processing existing text', { 
        textLength: text.length,
        mode: options.mode,
        hasCustomPrompt: !!options.customPrompt
      });
      
      const config = await mgrPreference.get<{
        apiKey: string
        baseURL: string
        chatModelName: string
      }>('aiModel.chat'); // 使用聊天模型来处理文本
      
      if (!config?.chatModelName) {
        Logger.error('Text processing service not configured: model name missing');
        return { error: 'Text processing service not configured' };
      }
      
      // 获取处理模式
      const mode = options.mode || OCRProcessMode.Default;
      
      // 获取系统提示词，优先使用自定义提示词
      let systemPrompt = options.customPrompt;
      if (!systemPrompt) {
        systemPrompt = TEXT_PROCESS_PROMPTS[mode];
      }
      
      Logger.debug(`Processing text with model ${config.chatModelName}, mode: ${mode}`);
      
      // 调用 API with rate limiting and retries
      const response = await this.clientManager.executeWithRetry(
        'chat',
        async (client) => {
          return client.chat.completions.create({
            messages: [
              {
                role: 'system',
                content: systemPrompt
              },
              {
                role: 'user',
                content: text
              }
            ],
            model: config.chatModelName,
            max_tokens: 4096,
            temperature: 0,
          });
        }
      );
      
      const result = response.choices[0]?.message?.content || '处理失败';
      Logger.log(`Text processing result (mode: ${mode}): ${result.substring(0, 50)}...`);
      
      return { text: result };
    } catch (error) {
      Logger.error('Failed to process text', error as Error);
      return { error: error instanceof Error ? error.message : 'Text processing failed' };
    }
  }

  dispose() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}

// 创建单例
export const mgrOCR = new OCRManager() 