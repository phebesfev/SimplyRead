console.log("SimplyRead content script loaded.");

const simpleWords = {
    "utilize": "use",
    "commence": "start",
    "terminate": "end",
    "endeavor": "try",
    "facilitate": "help"
};

// Store original words for toggling
const wordToggles = new Map();

document.addEventListener("dblclick", (event) => {
    console.log("Double-click detected!");

    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (!selectedText) return;

    const selectedWord = selectedText.toLowerCase();
    let range = selection.getRangeAt(0);
    let node = range.startContainer;

    if (node.nodeType === Node.TEXT_NODE) {
        let parentElement = node.parentNode;

        // Check if the word is already replaced
        if (wordToggles.has(node)) {
            node.textContent = wordToggles.get(node); // Restore original word
            parentElement.style.color = ""; // Reset color
            wordToggles.delete(node);
            console.log(`Restored '${selectedText}' to its original state.`);
        } else if (simpleWords[selectedWord]) {
            wordToggles.set(node, selectedText); // Store original word
            node.textContent = simpleWords[selectedWord]; // Replace with simpler word
            parentElement.style.color = "red"; // Change color to red
            console.log(`Replaced '${selectedText}' with '${simpleWords[selectedWord]}', changed color to red`);
        }
    }
});
