// Handles Button click in the Front Page
document.getElementById('start-btn').addEventListener('click', function() {
    // Directly navigate to the GitHub Releases download link
    const extensionUrl = "https://github.com/phebesfev/simplyread/releases/download/v1.0/simplyread.zip"; 

    // Open the download link
    window.location.href = extensionUrl;

    // Show installation instructions
    alert("Your extension is downloading! \n\nAfter extraction: \n1️⃣ Open chrome://extensions/ \n2️⃣ Enable Developer Mode \n3️⃣ Click 'Load Unpacked' and select the extracted folder.");
});
