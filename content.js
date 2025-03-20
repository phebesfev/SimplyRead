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



// Bias & Misinformation Detection
async function analyzeTextForBias(text) {
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
                                    text: `Analyze the following paragraph for bias, misinformation, or sensationalism. 
                                           If biased, explain why briefly. If misinformation, correct it. 
                                           Otherwise, return 'Neutral'. Provide a 1-2 sentence explanation.
                                           \n\nParagraph: "${text}"`
                                }
                            ]
                        }
                    ]
                })
            }
        );

        if (!response.ok) throw new Error(`API Error: ${response.status} - ${response.statusText}`);

        const data = await response.json();
        const analysis = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No analysis available.";

        return analysis;
        
    } catch (error) {
        console.error("Failed to analyze text:", error);
        return "Error analyzing text.";
    }
}

// Function to create a floating box for displaying analysis
function createAnalysisBox(result) {
    let existingBox = document.getElementById("bias-analysis-box");
    if (existingBox) existingBox.remove(); // Remove old box if present

    let analysisBox = document.createElement("div");
    analysisBox.id = "bias-analysis-box";
    analysisBox.textContent = result;

    // Style the box
    analysisBox.style.position = "fixed";
    analysisBox.style.bottom = "20px";
    analysisBox.style.left = "50%";
    analysisBox.style.transform = "translateX(-50%)";
    analysisBox.style.padding = "15px";
    analysisBox.style.borderRadius = "8px";
    analysisBox.style.boxShadow = "0px 4px 10px rgba(0,0,0,0.2)";
    analysisBox.style.fontSize = "16px";
    analysisBox.style.fontWeight = "bold";
    analysisBox.style.zIndex = "9999";
    analysisBox.style.backgroundColor = result.toLowerCase().includes("neutral") ? "#4CAF50" : "#D32F2F";
    analysisBox.style.color = "white";
    analysisBox.style.maxWidth = "80%";
    analysisBox.style.textAlign = "center";

    document.body.appendChild(analysisBox);

    // Remove the box after 7 seconds
    setTimeout(() => {
        if (analysisBox) analysisBox.remove();
    }, 7000);
}

// Detect text selection and trigger analysis (only for full sentences/paragraphs)
document.addEventListener("mouseup", async () => {
    let selection = window.getSelection().toString().trim();

    if (selection.length > 20 && selection.includes(".")) { // Ensure it's at least a sentence
        console.log(`Analyzing selected text: "${selection}"`);
        let result = await analyzeTextForBias(selection);
        createAnalysisBox(result);
    } else {
        console.log("Selected text is too short for bias detection.");
    }
});