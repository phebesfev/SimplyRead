console.log("SimplyRead content script loaded.");

// Store original words and their replacements
const wordToggles = new Map();
let GEMINI_API_KEY = "";
let readAloudCounter = 0; // to generate unique ids

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

// Function to get a simpler synonym using Gemini API, with a readability level
async function getSimplerWord(word, context, level) {
    try {
        if (!GEMINI_API_KEY) await fetchAPIKey();

        const prompt = `Provide only one synonym for '${word}' suitable for a ${level} readability level in this context: ${context}. 
                        Do NOT return a full sentence or explanation—only a single word response.`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        { parts: [{ text: prompt }] }
                    ]
                })
            }
        );

        if (!response.ok) throw new Error(`API Error: ${response.status} - ${response.statusText}`);

        const data = await response.json();
        const synonymText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const simplerWord = synonymText.split(/[.,\s]/)[0].trim();

        return simplerWord && simplerWord !== word ? simplerWord : word;
    } catch (error) {
        console.error("Failed to fetch simpler word:", error);
        return word;
    }
}

// Function to create a UI popup for selecting a difficulty level with cancellation on outside click
function chooseDifficulty(selectedWord) {
    return new Promise((resolve) => {
        const popup = document.createElement("div");
        popup.id = "difficulty-popup";
        popup.style.position = "fixed";
        popup.style.top = "50%";
        popup.style.left = "50%";
        popup.style.transform = "translate(-50%, -50%)";
        // Updated: set the entire popup background to red with white text for contrast
        popup.style.background = "red";
        popup.style.color = "white";
        popup.style.padding = "15px";
        popup.style.border = "1px solid black";
        popup.style.zIndex = "10000";
        popup.style.boxShadow = "0px 4px 6px rgba(0, 0, 0, 0.1)";
        popup.style.textAlign = "center";

        const message = document.createElement("p");
        message.textContent = `Select a difficulty level for "${selectedWord}":`;
        popup.appendChild(message);

        const difficulties = ["Easy", "Medium", "Hard"];
        difficulties.forEach(level => {
            const button = document.createElement("button");
            button.textContent = level;
            button.style.margin = "5px";
            button.style.padding = "5px 10px";
            button.style.cursor = "pointer";
            // Updated: ensure button background remains red for consistency
            button.style.background = "red";
            button.style.color = "white";
            button.style.border = "none";
            button.style.borderRadius = "4px";
            button.addEventListener("click", (e) => {
                e.stopPropagation();
                cleanup();
                resolve(level);
            });
            popup.appendChild(button);
        });

        document.body.appendChild(popup);

        function cleanup() {
            document.body.removeChild(popup);
            document.removeEventListener("click", outsideClickListener);
        }

        function outsideClickListener(e) {
            if (!popup.contains(e.target)) {
                cleanup();
                resolve(null);
            }
        }
        document.addEventListener("click", outsideClickListener);
    });
}

// Replace or restore a word on double-click
document.addEventListener("dblclick", async (event) => {
    console.log("Double-click detected!");
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    if (!selectedText || selectedText.split(" ").length > 1) return;

    const anchorNode = selection.anchorNode;
    if (anchorNode && anchorNode.parentElement && anchorNode.parentElement.classList.contains("simplified-word")) {
        const originalWord = anchorNode.parentElement.getAttribute("data-original");
        const textNode = document.createTextNode(` ${originalWord} `);
        anchorNode.parentElement.replaceWith(textNode);
        if (wordToggles.has(originalWord)) {
            wordToggles.delete(originalWord);
        }
        console.log(`Restored "${selectedText}" to "${originalWord}".`);
        return;
    }

    if (wordToggles.has(selectedText)) {
        console.log(`"${selectedText}" is already simplified. Double-click on the simplified word to revert.`);
        return;
    }

    let parentElement = range.startContainer.parentElement;
    let fullText = parentElement.innerText;
    console.log(`Fetching synonym for: ${selectedText}`);
    
    const chosenDifficulty = await chooseDifficulty(selectedText);
    if (!chosenDifficulty) {
        console.log("Difficulty selection cancelled.");
        return;
    }
    console.log(`Chosen difficulty: ${chosenDifficulty}`);

    let simplerWord = await getSimplerWord(selectedText, fullText, chosenDifficulty);
    if (!simplerWord || simplerWord === selectedText) {
        console.log(`No appropriate synonym found for "${selectedText}".`);
        return;
    }
    
    wordToggles.set(selectedText, simplerWord);
    let span = document.createElement("span");
    span.textContent = ` ${simplerWord} `;
    span.style.color = "red";
    span.classList.add("simplified-word");
    span.setAttribute("data-word", simplerWord);
    span.setAttribute("data-original", selectedText);

    range.deleteContents();
    range.insertNode(span);
    console.log(`Replaced "${selectedText}" with "${simplerWord}".`);
});

// Fetch a concise definition using Gemini API
async function getDefinition(word, context) {
    try {
        if (!GEMINI_API_KEY) await fetchAPIKey();
        const prompt = `Provide a concise, easy-to-understand definition for the word '${word}' in this context: ${context}. Do NOT provide any extra commentary—only the definition.`;
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [ { parts: [{ text: prompt }] } ]
                })
            }
        );

        if (!response.ok)
            throw new Error(`API Error: ${response.status} - ${response.statusText}`);

        const data = await response.json();
        const definitionText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        return definitionText.trim();
    } catch (error) {
        console.error("Failed to fetch definition:", error);
        return "";
    }
}

// Create a tooltip-style pop-up
function createTooltip(text, x, y) {
    let existingTooltip = document.getElementById("definition-tooltip");
    if (existingTooltip) existingTooltip.remove();

    const tooltip = document.createElement("div");
    tooltip.id = "definition-tooltip";
    tooltip.style.position = "absolute";
    tooltip.style.left = `${x + 10}px`;
    tooltip.style.top = `${y + 10}px`;
    tooltip.style.background = "rgba(0, 0, 0, 0.8)";
    tooltip.style.color = "white";
    tooltip.style.padding = "5px 8px";
    tooltip.style.borderRadius = "4px";
    tooltip.style.zIndex = "10000";
    tooltip.style.fontSize = "14px";
    tooltip.style.maxWidth = "250px";
    tooltip.style.wordWrap = "break-word";
    tooltip.textContent = text;
    document.body.appendChild(tooltip);
}

// Remove the tooltip
function removeTooltip() {
    let tooltip = document.getElementById("definition-tooltip");
    if (tooltip) tooltip.remove();
}

// Show definition tooltip on hover for difficult words
document.addEventListener("mouseover", async (event) => {
    const target = event.target;
    if (target.classList.contains("difficult-word")) {
        const word = target.textContent.trim();
        const context = target.parentElement ? target.parentElement.innerText : "";
        const definition = await getDefinition(word, context);
        if (definition) createTooltip(definition, event.pageX, event.pageY);
    }
});

document.addEventListener("mouseout", (event) => {
    const target = event.target;
    if (target.classList.contains("difficult-word")) removeTooltip();
});

// Analyze text for bias and create a floating analysis box
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
                        { parts: [ { text: `Analyze the following paragraph for bias, misinformation, or sensationalism. 
                                                   If biased, explain why briefly. If misinformation, correct it. 
                                                   Otherwise, return 'Neutral'. Provide a 1-2 sentence explanation.
                                                   \n\nParagraph: "${text}"` } ] }
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

function createAnalysisBox(result) {
    let existingBox = document.getElementById("bias-analysis-box");
    if (existingBox) existingBox.remove();

    let analysisBox = document.createElement("div");
    analysisBox.id = "bias-analysis-box";
    analysisBox.textContent = result;
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

    setTimeout(() => { if (analysisBox) analysisBox.remove(); }, 3000);
}

// Create a floating "Read Aloud" button near the text selection
function createReadAloudButton(x, y, selectedText) {
    readAloudCounter++;
    const button = document.createElement("button");
    const buttonId = `read-aloud-button-${readAloudCounter}`;
    button.id = buttonId;
    button.textContent = "Read Aloud";
    button.style.position = "absolute";
    button.style.left = `${x}px`;
    button.style.top = `${y}px`;
    button.style.zIndex = "10000";
    button.style.padding = "8px 12px";
    button.style.fontSize = "14px";
    button.style.cursor = "pointer";
    button.style.background = "red";
    button.style.color = "white";
    button.style.border = "none";
    button.style.borderRadius = "4px";

    button.addEventListener("click", () => {
        console.log("Read Aloud button clicked. Speaking text:", selectedText);
        // Cancel any ongoing speech to avoid overlaps
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(selectedText);
        speechSynthesis.speak(utterance);
        // Remove button after click
        button.remove();
    });

    document.body.appendChild(button);

    // Auto-remove the button after 10 seconds if not clicked
    setTimeout(() => {
        if (document.getElementById(buttonId)) {
            document.getElementById(buttonId).remove();
        }
    }, 10000);
}

// Detect text selection and show "Read Aloud" button plus trigger bias analysis if applicable
document.addEventListener("mouseup", async (event) => {
    const selectionObj = window.getSelection();
    const selectedText = selectionObj.toString().trim();

    // Only create a new button if there is a valid selection.
    if (selectedText.length > 0 && selectionObj.rangeCount > 0) {
        const range = selectionObj.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        createReadAloudButton(rect.right, rect.top - 40, selectedText);
    }

    // Trigger bias analysis if selected text is long enough
    if (selectedText.length > 20 && selectedText.includes(".")) {
        console.log(`Analyzing selected text: "${selectedText}"`);
        let result = await analyzeTextForBias(selectedText);
        createAnalysisBox(result);
    } else {
        console.log("Selected text is too short for bias detection.");
    }
});
