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


// Function to get a simpler synonym using Gemini API, with a readability level
async function getSimplerWord(word, context, level) {
    try {
        if (!GEMINI_API_KEY) await fetchAPIKey();

        // Construct a prompt that includes the readability difficulty
        const prompt = `Provide only one synonym for '${word}' suitable for a ${level} readability level in this context: ${context}. 
                        Do NOT return a full sentence or explanation—only a single word response.`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [{ text: prompt }]
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

// Function to create a UI popup for selecting a difficulty level with cancellation on outside click
function chooseDifficulty(selectedWord) {
    return new Promise((resolve) => {
        // Create the popup container
        const popup = document.createElement("div");
        popup.id = "difficulty-popup";
        popup.style.position = "fixed";
        popup.style.top = "50%";
        popup.style.left = "50%";
        popup.style.transform = "translate(-50%, -50%)";
        popup.style.background = "white";
        popup.style.padding = "15px";
        popup.style.border = "1px solid black";
        popup.style.zIndex = "10000";
        popup.style.boxShadow = "0px 4px 6px rgba(0, 0, 0, 0.1)";
        popup.style.textAlign = "center";

        // Create a message
        const message = document.createElement("p");
        message.textContent = `Select a difficulty level for "${selectedWord}":`;
        popup.appendChild(message);

        // Array of difficulties
        const difficulties = ["Easy", "Medium", "Hard"];
        difficulties.forEach(level => {
            const button = document.createElement("button");
            button.textContent = level;
            button.style.margin = "5px";
            button.style.padding = "5px 10px";
            button.style.cursor = "pointer";
            button.addEventListener("click", (e) => {
                // Stop the outside click from immediately triggering cancellation
                e.stopPropagation();
                cleanup();
                resolve(level);
            });
            popup.appendChild(button);
        });

        document.body.appendChild(popup);

        // Function to cleanup the popup and event listener
        function cleanup() {
            document.body.removeChild(popup);
            document.removeEventListener("click", outsideClickListener);
        }

        // Outside click listener that cancels the selection if clicked anywhere outside the popup
        function outsideClickListener(e) {
            if (!popup.contains(e.target)) {
                cleanup();
                resolve(null); // Resolve with null to indicate cancellation
            }
        }
        // Add the outside click listener
        document.addEventListener("click", outsideClickListener);
    });
}

// Function to replace or restore a word on double-click
document.addEventListener("dblclick", async (event) => {
    console.log("Double-click detected!");

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    if (!selectedText || selectedText.split(" ").length > 1) return; // Ignore multi-word selections

    // If the double-clicked text is within a simplified span, revert it
    const anchorNode = selection.anchorNode;
    if (anchorNode && anchorNode.parentElement && anchorNode.parentElement.classList.contains("simplified-word")) {
        const originalWord = anchorNode.parentElement.getAttribute("data-original");
        const textNode = document.createTextNode(` ${originalWord} `); // Ensure spacing
        anchorNode.parentElement.replaceWith(textNode);
        // Remove the mapping so the word can be simplified again later
        if (wordToggles.has(originalWord)) {
            wordToggles.delete(originalWord);
        }
        console.log(`Restored "${selectedText}" to "${originalWord}".`);
        return;
    }

    // Prevent re-simplifying if the word is already simplified elsewhere
    if (wordToggles.has(selectedText)) {
        console.log(`"${selectedText}" is already simplified. Double-click on the simplified word to revert.`);
        return;
    }

    let parentElement = range.startContainer.parentElement;
    let fullText = parentElement.innerText;

    console.log(`Fetching synonym for: ${selectedText}`);
    
    // Prompt the user to choose a difficulty level
    const chosenDifficulty = await chooseDifficulty(selectedText);
    if (!chosenDifficulty) {
        console.log("Difficulty selection cancelled.");
        return;
    }
    console.log(`Chosen difficulty: ${chosenDifficulty}`);

    // Call API with the selected readability level
    let simplerWord = await getSimplerWord(selectedText, fullText, chosenDifficulty);
    if (!simplerWord || simplerWord === selectedText) {
        console.log(`No appropriate synonym found for "${selectedText}".`);
        return;
    }
    
    // Store the mapping to prevent multiple simplifications until reverted
    wordToggles.set(selectedText, simplerWord);

    // Create a <span> to highlight the replaced word
    let span = document.createElement("span");
    span.textContent = ` ${simplerWord} `; // Ensure spacing around the word
    span.style.color = "red";
    span.classList.add("simplified-word");
    span.setAttribute("data-word", simplerWord);
    span.setAttribute("data-original", selectedText); // Store original word for reverting

    // Replace only the clicked word with the new <span>
    range.deleteContents();
    range.insertNode(span);

    console.log(`Replaced "${selectedText}" with "${simplerWord}".`);
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