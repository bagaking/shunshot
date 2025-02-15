import type { NativeImage } from 'electron'
import OpenAI from 'openai'
import { Logger } from './logger'
import { mgrPreference } from './mgrPreference'

/**
 * OCR 管理器
 */
export class OCRManager {
  private openai: OpenAI | null = null
  private unsubscribe: (() => void) | null = null

  constructor() {
    this.initializeOpenAI()
    
    // 监听配置变更
    this.unsubscribe = mgrPreference.subscribe((key, _) => {
      if (key.startsWith('aiModel.vision')) {
        this.initializeOpenAI()
      }
    })
  }

  private initializeOpenAI() {
    try {
      const config = mgrPreference.get<{
        apiKey: string
        baseURL: string
        modelName: string
      }>('aiModel.vision')

      if (config.apiKey) {
        this.openai = new OpenAI({
          apiKey: config.apiKey,
          baseURL: config.baseURL,
        })
        Logger.log('OCR service initialized')
      } else {
        this.openai = null
        Logger.warn('OCR service disabled: API key not found')
      }
    } catch (error) {
      Logger.error('Failed to initialize OCR service', error as Error)
      this.openai = null
    }
  }

  /**
   * 识别图像中的文字
   */
  async recognizeText(image: NativeImage): Promise<{ text: string } | { error: string }> {
    try {
      if (!this.openai) {
        return { error: 'OCR service not available' }
      }

      const config = mgrPreference.get<{
        apiKey: string
        baseURL: string
        modelName: string
      }>('aiModel.vision')

      // 转换为 base64
      const base64Image = image.toDataURL().replace(/^data:image\/\w+;base64,/, '')
      
      // 调用 OCR API
      const response = await this.openai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `你是一个图片内容识别专家，根据用户给到的图片，识别出原始文本, 组织格式后输出
注意:
- 用 Markdown 格式输出
- 如果没有文字，就返回"未检测到文字
- 只输出原始内容，不要加任何解释
- 文本分为多个区域时，也分段输出。顺序按照布局从上到下, 从左到右进行
- 识别到代码时，用代码段输出
`
          },
          {
            role: 'user',
            content: [
              { type: 'text', 
                text: '这张图片说了啥' 
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

      const result = response.choices[0]?.message?.content || '识别失败'
      Logger.log('OCR result: '+ result)
      
      return { text: result }
    } catch (error) {
      Logger.error('Failed to process OCR', error as Error)
      return { error: 'OCR processing failed' }
    }
  }
}

// 创建单例
export const mgrOCR = new OCRManager() 