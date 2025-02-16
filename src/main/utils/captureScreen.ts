import { desktopCapturer, Display, NativeImage } from 'electron'
import { Logger } from '../logger'

/**
 * 捕获指定显示器的屏幕内容
 * @param display 要捕获的显示器
 * @returns 返回截图的 NativeImage 对象
 */
export async function captureScreen(display: Display): Promise<NativeImage | null> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(display.bounds.width * display.scaleFactor),
        height: Math.round(display.bounds.height * display.scaleFactor)
      }
    })

    if (!sources || sources.length === 0) {
      throw new Error('No screen sources found')
    }

    // 找到对应的源
    const source = sources.find(s => 
      s.display_id === display.id?.toString() || 
      s.id.includes(display.id?.toString() || '')
    ) || sources[0]

    const thumbnail = source.thumbnail
    if (!thumbnail || thumbnail.isEmpty()) {
      throw new Error('Invalid thumbnail')
    }

    const thumbnailSize = thumbnail.getSize()
    if (thumbnailSize.width === 0 || thumbnailSize.height === 0) {
      throw new Error(`Invalid thumbnail dimensions: ${JSON.stringify(thumbnailSize)}`)
    }

    Logger.debug({
      message: 'Screen captured successfully',
      data: {
        sourceId: source.id,
        thumbnailSize,
        displayBounds: display.bounds,
        scaleFactor: display.scaleFactor
      }
    })

    return thumbnail
  } catch (error) {
    Logger.error('Failed to capture screen', error as Error)
    return null
  }
} 