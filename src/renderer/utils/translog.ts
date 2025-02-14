class TransLog {
  static instance: TransLog

  static getInstance(): TransLog {
    if (!TransLog.instance) {
      TransLog.instance = new TransLog()
    }
    return TransLog.instance
  }

  async log(...args: any[]) {
    return window.translogAPI.log(...args)
  }

  async info(...args: any[]) {
    return window.translogAPI.info(...args)
  }

  async warn(...args: any[]) {
    return window.translogAPI.warn(...args)
  }

  async error(...args: any[]) {
    return window.translogAPI.error(...args)
  }

  async debug(...args: any[]) {
    return window.translogAPI.debug(...args)
  }
}

export const translog = TransLog.getInstance() 