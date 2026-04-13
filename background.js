// Only fire once when the page finishes loading, not on every state change
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    tab.url.includes("youtube.com/watch")
  ) {
    const queryParameters = tab.url.split("?")[1];
    const urlParameters = new URLSearchParams(queryParameters);

    chrome.tabs.sendMessage(tabId, {
      type: "NEW",
      videoId: urlParameters.get("v"),
    });
  }
});

// Update the extension icon badge with bookmark count
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "UPDATE_BADGE") {
    const count = message.count;
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
    chrome.action.setBadgeBackgroundColor({ color: "#ff0000" });
  }
});

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === "LOGIN_SUCCESS") {
    chrome.storage.local.set({ token: message.token }, () => {
      console.log("Token synced from website");
    });
  }
});