console.log("SimplyRead content script loaded.");

// Store original words and their replacements
const wordToggles = new Map();
let GEMINI_API_KEY = "";

// Function to get API key
function fetchAPIKey() {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: "getAPIKey" }, (response) => {
            if (response && response.apiKey) {
                GEMINI_API_KEY = response.apiKey;
                console.log("API Key received:", GEMINI_API_KEY);
                resolve(GEMINI_API_KEY);
            } else {
                console.error("Failed to retrieve API Key.");
                reject("No API Key");
            }
        });
    });
}

// Function to get simpler synonym using Gemini API
async function getSimplerWord(word, context) {
    try {
        if (!GEMINI_API_KEY) await fetchAPIKey();

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: `Provide only one simpler synonym (a single word) for '${word}' in this context: ${context}. 
                                    Do NOT return a full sentence or explanation—only a single word response.`
                                }
                            ]
                        }
                    ]
                })
            }
        );

        if (!response.ok) throw new Error(`API Error: ${response.status} - ${response.statusText}`);

        const data = await response.json();
        const synonymText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

        // Extract only the first word (if the API still returns a phrase)
        const simplerWord = synonymText.split(/[.,\s]/)[0].trim();

        return simplerWord && simplerWord !== word ? simplerWord : word;
        
    } catch (error) {
        console.error("Failed to fetch simpler word:", error);
        return word; // If API fails, return the original word
    }
}

// Function to replace or restore a word on double click
document.addEventListener("dblclick", async (event) => {
    console.log("Double-click detected!");

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    if (!selectedText || selectedText.split(" ").length > 1) return; // Ignore multi-word selections

    let node = range.startContainer;
    if (node.nodeType !== 3) return; // Ensure it's a text node

    let parentElement = node.parentElement;
    let fullText = parentElement.innerText;

    // Check if the word was previously replaced
    let existingSpan = document.querySelector(`span.simplified-word[data-word="${selectedText}"]`);
    if (existingSpan) {
        let originalWord = existingSpan.getAttribute("data-original");

        // Replace the span with the original word
        let textNode = document.createTextNode(` ${originalWord} `); // Ensure spacing
        existingSpan.replaceWith(textNode);

        console.log(`Restored '${selectedText}' to '${originalWord}' (black color).`);
        return;
    }

    console.log(`Fetching synonym for: ${selectedText}`);
    
    // Call API only once and store result
    let simplerWord;
    if (!wordToggles.has(selectedText)) {
        simplerWord = await getSimplerWord(selectedText, fullText);
        if (!simplerWord || simplerWord === selectedText) {
            console.log(`No appropriate synonym found for '${selectedText}'.`);
            return;
        }
        wordToggles.set(simplerWord, selectedText); // Store for toggling later
    } else {
        simplerWord = wordToggles.get(selectedText);
    }

    // Create a <span> to highlight only the replaced word
    let span = document.createElement("span");
    span.textContent = ` ${simplerWord} `; // Ensures spacing around the word
    span.style.color = "red";
    span.classList.add("simplified-word");
    span.setAttribute("data-word", simplerWord);
    span.setAttribute("data-original", selectedText); // Store original word for reverting

    // Replace only the clicked word with the new <span>
    range.deleteContents();
    range.insertNode(span);

    console.log(`Replaced '${selectedText}' with '${simplerWord}' (red color).`);
});
