const browserApi = globalThis.browser ?? null;
const chromeApi = globalThis.chrome ?? null;

export const extensionApi = browserApi ?? chromeApi ?? null;

export function sendRuntimeMessage(message) {
  if (browserApi?.runtime?.sendMessage) {
    return browserApi.runtime.sendMessage(message);
  }

  if (chromeApi?.runtime?.sendMessage) {
    return new Promise((resolve, reject) => {
      chromeApi.runtime.sendMessage(message, (response) => {
        const lastError = chromeApi.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }

        resolve(response);
      });
    });
  }

  return Promise.reject(new Error("Extension runtime is unavailable."));
}

export function createTab(createProperties) {
  if (browserApi?.tabs?.create) {
    return browserApi.tabs.create(createProperties);
  }

  if (chromeApi?.tabs?.create) {
    return new Promise((resolve, reject) => {
      chromeApi.tabs.create(createProperties, (tab) => {
        const lastError = chromeApi.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }

        resolve(tab);
      });
    });
  }

  return Promise.reject(new Error("Extension tabs API is unavailable."));
}

export function getTab(tabId) {
  if (browserApi?.tabs?.get) {
    return browserApi.tabs.get(tabId);
  }

  if (chromeApi?.tabs?.get) {
    return new Promise((resolve, reject) => {
      chromeApi.tabs.get(tabId, (tab) => {
        const lastError = chromeApi.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }

        resolve(tab);
      });
    });
  }

  return Promise.reject(new Error("Extension tabs API is unavailable."));
}

export function removeTab(tabId) {
  if (browserApi?.tabs?.remove) {
    return browserApi.tabs.remove(tabId);
  }

  if (chromeApi?.tabs?.remove) {
    return new Promise((resolve, reject) => {
      chromeApi.tabs.remove(tabId, () => {
        const lastError = chromeApi.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }

        resolve();
      });
    });
  }

  return Promise.reject(new Error("Extension tabs API is unavailable."));
}

export function executeScript(details) {
  if (browserApi?.scripting?.executeScript) {
    return browserApi.scripting.executeScript(details);
  }

  if (chromeApi?.scripting?.executeScript) {
    return new Promise((resolve, reject) => {
      chromeApi.scripting.executeScript(details, (results) => {
        const lastError = chromeApi.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }

        resolve(results ?? []);
      });
    });
  }

  return Promise.reject(new Error("Extension scripting API is unavailable."));
}
