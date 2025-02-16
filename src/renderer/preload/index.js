"use strict";
const electron = require("electron");
const SHUNSHOT_BRIDGE_PREFIX = "shunshot";
const createSecureIPC = () => {
  const validChannels = [
    "translog:log",
    "translog:info",
    "translog:warn",
    "translog:error",
    "translog:debug",
    `${SHUNSHOT_BRIDGE_PREFIX}:captureScreen`,
    `${SHUNSHOT_BRIDGE_PREFIX}:onStartCapture`,
    `${SHUNSHOT_BRIDGE_PREFIX}:onScreenCaptureData`,
    `${SHUNSHOT_BRIDGE_PREFIX}:completeCapture`,
    `${SHUNSHOT_BRIDGE_PREFIX}:cancelCapture`,
    `${SHUNSHOT_BRIDGE_PREFIX}:copyToClipboard`,
    `${SHUNSHOT_BRIDGE_PREFIX}:hideWindow`,
    `${SHUNSHOT_BRIDGE_PREFIX}:showWindow`,
    `${SHUNSHOT_BRIDGE_PREFIX}:setWindowSize`,
    `${SHUNSHOT_BRIDGE_PREFIX}:loadPlugin`,
    `${SHUNSHOT_BRIDGE_PREFIX}:requestOCR`,
    `${SHUNSHOT_BRIDGE_PREFIX}:openSettings`,
    `${SHUNSHOT_BRIDGE_PREFIX}:getPreference`,
    `${SHUNSHOT_BRIDGE_PREFIX}:setPreference`,
    `${SHUNSHOT_BRIDGE_PREFIX}:setIgnoreSystemShortcuts`,
    `${SHUNSHOT_BRIDGE_PREFIX}:onCleanupComplete`
  ];
  return {
    invoke: (channel, ...args) => {
      if (validChannels.includes(channel)) {
        return electron.ipcRenderer.invoke(channel, ...args);
      }
      throw new Error(`Invalid channel: ${channel}`);
    },
    on: (channel, callback) => {
      if (validChannels.includes(channel)) {
        const wrappedCallback = (_, ...args) => {
          console.debug(`[Preload] Received event on channel: ${channel}`, {
            hasArgs: args.length > 0,
            timestamp: Date.now()
          });
          callback(...args);
        };
        electron.ipcRenderer.on(channel, wrappedCallback);
        return () => {
          console.debug(`[Preload] Removing listener for channel: ${channel}`);
          electron.ipcRenderer.removeListener(channel, wrappedCallback);
        };
      }
      throw new Error(`Invalid channel: ${channel}`);
    }
  };
};
const translogAPI = {
  log: async (...args) => electron.ipcRenderer.invoke("translog:log", ...args),
  info: async (...args) => electron.ipcRenderer.invoke("translog:info", ...args),
  warn: async (...args) => electron.ipcRenderer.invoke("translog:warn", ...args),
  error: async (...args) => electron.ipcRenderer.invoke("translog:error", ...args),
  debug: async (...args) => electron.ipcRenderer.invoke("translog:debug", ...args)
};
const createCoreAPI = (secureIPC) => {
  console.debug("[Preload] Creating core API");
  return {
    platform: process.platform,
    captureScreen: async () => {
      console.debug("[Preload] Invoking captureScreen");
      return secureIPC.invoke(`${SHUNSHOT_BRIDGE_PREFIX}:captureScreen`);
    },
    onStartCapture: (callback) => {
      console.debug("[Preload] Setting up onStartCapture listener");
      return secureIPC.on(`${SHUNSHOT_BRIDGE_PREFIX}:onStartCapture`, callback);
    },
    onScreenCaptureData: (callback) => {
      console.debug("[Preload] Setting up onScreenCaptureData listener");
      return secureIPC.on(`${SHUNSHOT_BRIDGE_PREFIX}:onScreenCaptureData`, callback);
    },
    onCleanupComplete: (callback) => {
      console.debug("[Preload] Setting up onCleanupComplete listener");
      return secureIPC.on(`${SHUNSHOT_BRIDGE_PREFIX}:onCleanupComplete`, callback);
    },
    completeCapture: async (bounds) => {
      console.debug("[Preload] Invoking completeCapture");
      return secureIPC.invoke(`${SHUNSHOT_BRIDGE_PREFIX}:completeCapture`, bounds);
    },
    cancelCapture: () => {
      console.debug("[Preload] Invoking cancelCapture");
      return secureIPC.invoke(`${SHUNSHOT_BRIDGE_PREFIX}:cancelCapture`);
    },
    copyToClipboard: async (bounds) => {
      console.debug("[Preload] Invoking copyToClipboard");
      return secureIPC.invoke(`${SHUNSHOT_BRIDGE_PREFIX}:copyToClipboard`, bounds);
    },
    hideWindow: async () => {
      console.debug("[Preload] Invoking hideWindow");
      return secureIPC.invoke(`${SHUNSHOT_BRIDGE_PREFIX}:hideWindow`);
    },
    showWindow: async () => {
      console.debug("[Preload] Invoking showWindow");
      return secureIPC.invoke(`${SHUNSHOT_BRIDGE_PREFIX}:showWindow`);
    },
    setWindowSize: async (width, height) => {
      console.debug("[Preload] Invoking setWindowSize");
      return secureIPC.invoke(`${SHUNSHOT_BRIDGE_PREFIX}:setWindowSize`, width, height);
    },
    loadPlugin: async (pluginId) => {
      console.debug("[Preload] Invoking loadPlugin");
      return secureIPC.invoke(`${SHUNSHOT_BRIDGE_PREFIX}:loadPlugin`, pluginId);
    },
    requestOCR: async (bounds) => {
      console.debug("[Preload] Invoking requestOCR");
      return secureIPC.invoke(`${SHUNSHOT_BRIDGE_PREFIX}:requestOCR`, bounds);
    },
    openSettings: async () => {
      console.debug("[Preload] Invoking openSettings");
      return secureIPC.invoke(`${SHUNSHOT_BRIDGE_PREFIX}:openSettings`);
    },
    getPreference: async (key) => {
      console.debug("[Preload] Invoking getPreference", { key });
      return secureIPC.invoke(`${SHUNSHOT_BRIDGE_PREFIX}:getPreference`, key);
    },
    setPreference: async (key, value) => {
      console.debug("[Preload] Invoking setPreference", { key });
      return secureIPC.invoke(`${SHUNSHOT_BRIDGE_PREFIX}:setPreference`, key, value);
    },
    setIgnoreSystemShortcuts: async (ignore) => {
      console.debug("[Preload] Invoking setIgnoreSystemShortcuts", { ignore });
      return secureIPC.invoke(`${SHUNSHOT_BRIDGE_PREFIX}:setIgnoreSystemShortcuts`, ignore);
    }
  };
};
try {
  console.debug("[Preload] Starting API initialization");
  const secureIPC = createSecureIPC();
  const coreAPI = createCoreAPI(secureIPC);
  electron.contextBridge.exposeInMainWorld("translogAPI", translogAPI);
  electron.contextBridge.exposeInMainWorld("shunshotCoreAPI", coreAPI);
  console.debug("[Preload] APIs initialized successfully", {
    hasTranslogAPI: !!translogAPI,
    hasCoreAPI: !!coreAPI,
    timestamp: Date.now()
  });
} catch (error) {
  console.error("[Preload] Failed to initialize APIs:", error instanceof Error ? error : new Error(String(error)));
  const fallbackAPI = {
    platform: process.platform,
    captureScreen: async () => {
      throw new Error("API not available");
    },
    onStartCapture: () => () => {
    },
    onScreenCaptureData: () => () => {
    },
    completeCapture: async () => {
      throw new Error("API not available");
    },
    cancelCapture: () => {
    },
    copyToClipboard: async () => {
      throw new Error("API not available");
    },
    hideWindow: async () => {
      throw new Error("API not available");
    },
    showWindow: async () => {
      throw new Error("API not available");
    },
    setWindowSize: async () => {
      throw new Error("API not available");
    },
    loadPlugin: async () => {
      throw new Error("API not available");
    },
    requestOCR: async () => ({ error: "API not available" })
  };
  electron.contextBridge.exposeInMainWorld("translogAPI", {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console)
  });
  electron.contextBridge.exposeInMainWorld("shunshotCoreAPI", fallbackAPI);
  console.debug("[Preload] Fallback APIs initialized", {
    timestamp: Date.now()
  });
}
window.addEventListener("DOMContentLoaded", () => {
  console.debug("[Preload] DOM content loaded", {
    timestamp: Date.now()
  });
});
