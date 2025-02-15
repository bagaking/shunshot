const { notarize } = require('@electron/notarize')
const { build } = require('../package.json')

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context
  if (electronPlatformName !== 'darwin') {
    return
  }

  // 如果没有设置 Apple ID 环境变量，跳过公证
  if (!process.env.APPLE_ID || !process.env.APPLE_ID_PASSWORD) {
    console.warn('Skipping notarization: APPLE_ID and APPLE_ID_PASSWORD environment variables must be set')
    return
  }

  const appName = context.packager.appInfo.productFilename
  const appPath = `${appOutDir}/${appName}.app`

  console.log(`Notarizing ${appPath} with Apple ID ${process.env.APPLE_ID}...`)

  try {
    await notarize({
      tool: 'notarytool',
      appPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID
    })
  } catch (error) {
    console.error('Notarization failed:', error)
    throw error
  }

  console.log('Notarization complete!')
} 