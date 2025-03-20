chrome.runtime.onInstalled.addListener(() => {
    console.log("SimplyRead extension installed.");
  });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getAPIKey") {
        sendResponse({ apiKey: "AIzaSyBZdYhxO7TWP6XEK9dNAx4Ov0gBoHnE4ek" });
    }
});
