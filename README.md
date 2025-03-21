# AI-Powered Readability & Bias-Free Content Assistant

Unified Concept:  
A Chrome extension that simplifies complex text while also detecting and neutralizing biased or misleading language. This tool not only rewrites difficult content into simpler language based on personalized reading levels but also scans for bias and misinformation in real-time.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Architecture](#architecture)
- [Packages & Technologies Used](#packages--technologies-used)
- [Key Features](#key-features)
- [Testing](#testing)

---

## Getting Started

To get started with the project, follow these steps:

1. **Clone the repository:**

   ```bash
   git clone https://github.com/your-username/SimplyRead.git

2. **Navigate to the project directory:**

   ```bash
    cd SimplyRead

3. **Install dependencies:**

   ```bash
    npm install

4. **Load the Extension:**

    Open Chrome and navigate to chrome://extensions/  
    Enable Developer mode.  
    Click Load unpacked and select the project directory.  

5. **Run the extension:**

    The extension will load automatically. Use it on any webpage to simplify text, detect bias, and use text-to-speech features.  


## Architecture

This project follows a modular approach, separating core functionality from feature-specific logic. The project is structured as follows:

### Core:
Contains shared utilities (e.g., API communication, event handling, and UI elements).

### Features:
- **Text Simplification:** Uses NLP and AI (via the Gemini API) to simplify words and phrases based on user-selected readability levels.
- **Bias & Misinformation Detection:** Analyzes paragraphs for bias, sensationalism, and misinformation, displaying results in a floating analysis box.
- **Text-to-Speech (TTS) & Speech-to-Text (STT):** Provides a Read Aloud function for selected text.

### UI Components:
Popup UI for selecting reading difficulty and tooltips for definitions are implemented to maintain a user-friendly interface.

---

## Packages & Technologies Used

### Chrome Extension APIs:
To interact with the browser, handle user events, and create dynamic UI elements.

### Gemini API:
For AI-powered text simplification, definition fetching, and bias detection.

### Speech Synthesis API:
For the Read Aloud feature, allowing the extension to speak selected text.

### Vanilla JavaScript:
For application logic and DOM manipulation.

### HTML & CSS:
For building the extension’s user interface.

---

## Key Features

- **AI-Powered Text Simplification:**  
  Uses NLP to rewrite complex text into easier-to-understand language based on user preferences.

- **Bias & Misinformation Detection:**  
  Analyzes articles and headlines for bias or sensationalism, providing neutral rewrites when necessary.

- **Personalized Readability Settings:**  
  Users can choose from multiple reading levels (e.g., Easy, Medium, Hard) to match their accessibility needs.

- **Fact-Checking Integration:**  
  Highlights potentially misleading claims and provides verified sources for further review.

- **Text-to-Speech & Speech-to-Text Support:**  
  The extension can read selected text aloud, and may be extended to support voice commands.

---

## Testing

### Unit Tests:
Verify core logic including API interactions, text simplification, and bias analysis.

### Integration Tests:
Ensure proper interaction between UI components and backend services.

### Manual Testing:
Test across multiple webpages and scenarios (single word, sentence, or paragraph selection) to verify the Read Aloud and definition features.

Run all tests using your preferred testing framework (e.g., Jest):

```bash
npm test
