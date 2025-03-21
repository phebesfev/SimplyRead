console.log("SimplyRead content script loaded.");

// Store original words and their replacements
const wordToggles = new Map();
let GEMINI_API_KEY = "";
let readAloudCounter = 0; // To generate unique IDs

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

// Function to create a dropdown for selecting difficulty level
function chooseDifficulty(selectedWord, x, y) {
    return new Promise((resolve) => {
        const popup = document.createElement("div");
        popup.id = "difficulty-popup";
        popup.style.position = "absolute";
        popup.style.left = `${x}px`;
        popup.style.top = `${y + 20}px`; // Positioning below the selection
        popup.style.background = "#f8f9fa";
        popup.style.color = "#333";
        popup.style.padding = "10px";
        popup.style.borderRadius = "8px";
        popup.style.boxShadow = "0px 4px 6px rgba(0, 0, 0, 0.1)";
        popup.style.zIndex = "10000";
        popup.style.textAlign = "center";
        popup.style.fontFamily = "Montserrat, sans-serif";
        popup.style.fontSize = "14px";

        const message = document.createElement("p");
        message.textContent = `Choose difficulty for "${selectedWord}":`;
        message.style.marginBottom = "8px";
        popup.appendChild(message);

        // Create dropdown
        const select = document.createElement("select");
        select.style.padding = "8px";
        select.style.border = "1px solid #ccc";
        select.style.borderRadius = "5px";
        select.style.fontSize = "14px";
        select.style.cursor = "pointer";
        select.style.background = "white";
        select.style.color = "#333";

        const difficulties = ["Very Easy", "Easy", "Medium"];
        difficulties.forEach(level => {
            const option = document.createElement("option");
            option.textContent = level;
            option.value = level;
            select.appendChild(option);
        });

        select.addEventListener("change", (e) => {
            cleanup();
            resolve(e.target.value);
        });

        popup.appendChild(select);
        document.body.appendChild(popup);

        function cleanup() {
            if (popup) document.body.removeChild(popup);
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

    const rect = range.getBoundingClientRect();
    const chosenDifficulty = await chooseDifficulty(selectedText, rect.left, rect.bottom);

    if (!chosenDifficulty) return;
    console.log(`Chosen difficulty: ${chosenDifficulty}`);

    console.log(`Fetching synonym for: ${selectedText}`);
    
    let simplerWord = await getSimplerWord(selectedText, document.body.innerText, chosenDifficulty);
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

// Detect text selection and show "Read Aloud" button
document.addEventListener("mouseup", async (event) => {
    const selectionObj = window.getSelection();
    const selectedText = selectionObj.toString().trim();

    if (selectedText.length > 0 && selectionObj.rangeCount > 0) {
        const range = selectionObj.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        createReadAloudButton(rect.right, rect.top - 40, selectedText);
    }
});

// Create a floating "Read Aloud" button
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
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(selectedText);
        speechSynthesis.speak(utterance);
        button.remove();
    });

    document.body.appendChild(button);
    setTimeout(() => { if (document.getElementById(buttonId)) document.getElementById(buttonId).remove(); }, 10000);
}
