
// Modified Chat Widget Script
(function() {
    // --- Default Configuration (User config overrides this) ---
    const defaultConfig = {
        webhook: { url: '', route: '' },
        branding: {
            logo: '', name: 'Chat', welcomeText: 'Hi there! How can I help?', responseTimeText: '',
            // poweredBy section is effectively removed by not using it in the HTML below
        },
        style: {
            primaryColor: '#854fff', secondaryColor: '#6b3fd4', position: 'right',
            backgroundColor: '#ffffff', fontColor: '#333333'
        }
    };

    // --- Merge User Config ---
    const config = window.ChatWidgetConfig ?
        {
            webhook: { ...defaultConfig.webhook, ...window.ChatWidgetConfig.webhook },
            branding: { ...defaultConfig.branding, ...window.ChatWidgetConfig.branding },
            style: { ...defaultConfig.style, ...window.ChatWidgetConfig.style }
        } : defaultConfig;

    // --- Prevent Multiple Initializations ---
    if (window.N8NChatWidgetInitialized) return;
    window.N8NChatWidgetInitialized = true;

    // --- State Variable ---
    let currentSessionId = '';
    let isChatStarted = false; // Track if the initial conversation fetch has happened

    // --- Inject Styles ---
    const styles = `
        /* Font import */
        @import url('https://cdn.jsdelivr.net/npm/geist@1.0.0/dist/fonts/geist-sans/style.css');

        .n8n-chat-widget {
            --chat--color-primary: var(--n8n-chat-primary-color, ${config.style.primaryColor});
            --chat--color-secondary: var(--n8n-chat-secondary-color, ${config.style.secondaryColor});
            --chat--color-background: var(--n8n-chat-background-color, ${config.style.backgroundColor});
            --chat--color-font: var(--n8n-chat-font-color, ${config.style.fontColor});
            font-family: 'Geist Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            position: relative; /* Needed for absolute positioning context of bubble */
        }

        .n8n-chat-widget .chat-container {
            position: fixed;
            bottom: 90px; /* Adjusted bottom to make space for toggle */
            right: ${config.style.position === 'left' ? 'auto' : '20px'};
            left: ${config.style.position === 'left' ? '20px' : 'auto'};
            z-index: 1000;
            display: none; /* Initially hidden */
            width: 380px;
            height: calc(100% - 110px); /* Adjust height */
            max-height: 600px;
            background: var(--chat--color-background);
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
            border: 1px solid rgba(0, 0, 0, 0.1);
            overflow: hidden;
            font-family: inherit;
            flex-direction: column; /* Always column now */
            transition: opacity 0.3s ease, transform 0.3s ease;
            opacity: 0;
            transform: translateY(10px);
        }

        .n8n-chat-widget .chat-container.open {
            display: flex;
            opacity: 1;
            transform: translateY(0);
        }

        .n8n-chat-widget .brand-header {
            padding: 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            border-bottom: 1px solid rgba(0, 0, 0, 0.08);
            position: relative; /* For close button positioning */
            background-color: var(--chat--color-background); /* Ensure bg */
        }

        .n8n-chat-widget .close-button {
            position: absolute;
            right: 12px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            color: var(--chat--color-font);
            cursor: pointer;
            padding: 4px;
            display: flex; /* Use flex for centering icon */
            align-items: center;
            justify-content: center;
            font-size: 24px; /* Larger X */
            line-height: 1;
            opacity: 0.6;
            transition: opacity 0.2s;
        }
        .n8n-chat-widget .close-button:hover { opacity: 1; }
        .n8n-chat-widget .brand-header img { width: 36px; height: 36px; border-radius: 50%; }
        .n8n-chat-widget .brand-header span { font-size: 16px; font-weight: 500; color: var(--chat--color-font); }

        /* REMOVED: .new-conversation styles */

        .n8n-chat-widget .chat-interface { /* This is now the main container content */
            display: flex;
            flex-direction: column;
            height: 100%;
            flex-grow: 1; /* Take available space */
        }

        .n8n-chat-widget .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 15px;
            background: var(--chat--color-background);
            display: flex;
            flex-direction: column;
        }
        /* Add scrollbar styling */
        .n8n-chat-widget .chat-messages::-webkit-scrollbar { width: 6px; }
        .n8n-chat-widget .chat-messages::-webkit-scrollbar-track { background: rgba(0,0,0,0.05); border-radius: 3px; }
        .n8n-chat-widget .chat-messages::-webkit-scrollbar-thumb { background-color: rgba(0,0,0,0.2); border-radius: 3px; }
        .n8n-chat-widget .chat-messages::-webkit-scrollbar-thumb:hover { background-color: rgba(0,0,0,0.3); }


        .n8n-chat-widget .chat-message {
            padding: 10px 14px;
            margin: 6px 0;
            border-radius: 16px; /* Slightly more rounded */
            max-width: 85%;
            word-wrap: break-word;
            font-size: 14px;
            line-height: 1.5;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .n8n-chat-widget .chat-message.user {
            background: linear-gradient(135deg, var(--chat--color-primary) 0%, var(--chat--color-secondary) 100%);
            color: ${getContrastColor(config.style.primaryColor)}; /* Dynamic contrast */
            align-self: flex-end;
            border-bottom-right-radius: 4px; /* Style */
        }

        .n8n-chat-widget .chat-message.bot {
            background: #f0f0f0; /* Lighter grey for bot */
            border: 1px solid #e0e0e0;
            color: var(--chat--color-font);
            align-self: flex-start;
            border-bottom-left-radius: 4px; /* Style */
        }
         /* Typing indicator */
        .n8n-chat-widget .typing-indicator {
            display: flex;
            align-items: center;
            padding: 10px 14px;
            margin: 6px 0;
            background: #f0f0f0;
            border: 1px solid #e0e0e0;
            border-radius: 16px;
            border-bottom-left-radius: 4px;
            align-self: flex-start;
        }
        .n8n-chat-widget .typing-indicator span {
            height: 8px;
            width: 8px;
            margin: 0 2px;
            background-color: #999;
            border-radius: 50%;
            display: inline-block;
            animation: typing 1s infinite ease-in-out;
        }
        .n8n-chat-widget .typing-indicator span:nth-child(1) { animation-delay: 0s; }
        .n8n-chat-widget .typing-indicator span:nth-child(2) { animation-delay: 0.1s; }
        .n8n-chat-widget .typing-indicator span:nth-child(3) { animation-delay: 0.2s; }
        @keyframes typing {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1.0); }
        }


        .n8n-chat-widget .chat-input {
            padding: 12px 15px;
            background: var(--chat--color-background);
            border-top: 1px solid rgba(0, 0, 0, 0.08);
            display: flex;
            gap: 10px;
            align-items: flex-end; /* Align items to bottom */
        }

        .n8n-chat-widget .chat-input textarea {
            flex: 1;
            padding: 10px 12px;
            border: 1px solid #ccc;
            border-radius: 8px;
            background: var(--chat--color-background);
            color: var(--chat--color-font);
            resize: none;
            font-family: inherit;
            font-size: 14px;
            min-height: 20px; /* Base height */
            max-height: 100px; /* Limit growth */
            line-height: 1.4;
            overflow-y: auto; /* Scroll if needed */
        }
        .n8n-chat-widget .chat-input textarea:focus { border-color: var(--chat--color-primary); outline: none; box-shadow: 0 0 0 2px rgba(from var(--chat--color-primary) r g b / 0.2); }
        .n8n-chat-widget .chat-input textarea::placeholder { color: #999; }

        .n8n-chat-widget .chat-input button {
            background: linear-gradient(135deg, var(--chat--color-primary) 0%, var(--chat--color-secondary) 100%);
            color: ${getContrastColor(config.style.primaryColor)}; /* Dynamic contrast */
            border: none;
            border-radius: 8px;
            width: 40px; /* Square-ish button */
            height: 40px;
            padding: 0; /* Remove padding */
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            font-family: inherit;
            font-weight: 500;
            display: flex; /* Center icon */
            align-items: center;
            justify-content: center;
            flex-shrink: 0; /* Prevent shrinking */
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .n8n-chat-widget .chat-input button:hover { transform: scale(1.05); box-shadow: 0 4px 8px rgba(0,0,0,0.15); }
        .n8n-chat-widget .chat-input button:disabled { background: #ccc; cursor: not-allowed; transform: none; box-shadow: none;}
        /* Send Icon SVG */
        .n8n-chat-widget .chat-input button svg { width: 20px; height: 20px; fill: currentColor; }

        /* REMOVED: .chat-footer styles */

        /* --- Toggle Button --- */
        .n8n-chat-widget .chat-toggle {
            position: fixed;
            bottom: 20px;
            right: ${config.style.position === 'left' ? 'auto' : '20px'};
            left: ${config.style.position === 'left' ? '20px' : 'auto'};
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--chat--color-primary) 0%, var(--chat--color-secondary) 100%);
            color: ${getContrastColor(config.style.primaryColor)}; /* Dynamic contrast */
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            z-index: 999;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .n8n-chat-widget .chat-toggle:hover { transform: scale(1.08); box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25); }
        .n8n-chat-widget .chat-toggle svg { width: 28px; height: 28px; fill: currentColor; transition: transform 0.3s ease; }
        /* Change icon when open */
         .n8n-chat-widget .chat-container.open ~ .chat-toggle svg.chat-icon { transform: rotate(90deg) scale(0); }
         .n8n-chat-widget .chat-container.open ~ .chat-toggle svg.close-icon { transform: rotate(0) scale(1); }
         .n8n-chat-widget .chat-toggle svg.close-icon { position: absolute; transform: scale(0); }


        /* --- Text Bubble --- */
        .n8n-chat-widget .chat-bubble {
            position: fixed;
            bottom: 95px; /* toggle bottom (20) + toggle height (60) + spacing (15) */
            right: ${config.style.position === 'left' ? 'auto' : '25px'};
            left: ${config.style.position === 'left' ? '25px' : 'auto'};
            background: var(--chat--color-background);
            color: var(--chat--color-font);
            padding: 12px 16px;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
            border: 1px solid rgba(0, 0, 0, 0.1);
            font-size: 14px;
            max-width: 250px;
            z-index: 998; /* Below toggle */
            opacity: 1;
            transition: opacity 0.3s ease, transform 0.3s ease;
            transform: translateY(0);
        }
        /* Bubble Arrow */
        .n8n-chat-widget .chat-bubble::after {
            content: '';
            position: absolute;
            bottom: -8px; /* Position arrow below bubble */
            ${config.style.position === 'left' ? 'left: 25px;' : 'right: 25px;'} /* Align arrow with button center */
            width: 0;
            height: 0;
            border-left: 8px solid transparent;
            border-right: 8px solid transparent;
            border-top: 8px solid var(--chat--color-background); /* Arrow color matches bubble */
             /* Add border for arrow outline */
            filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.1));
        }

        /* Hide bubble when chat is open */
        .n8n-chat-widget .chat-container.open ~ .chat-bubble {
            opacity: 0;
            transform: translateY(5px);
            pointer-events: none; /* Prevent interaction when hidden */
        }
    `;
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    // --- Helper Function: Calculate Contrast Color ---
    function getContrastColor(hexcolor) {
        if (!hexcolor) return '#ffffff'; // Default to white if color not set
        hexcolor = hexcolor.replace("#", "");
        if (hexcolor.length === 3) {
            hexcolor = hexcolor.split('').map(hex => hex + hex).join('');
        }
        const r = parseInt(hexcolor.substring(0, 2), 16);
        const g = parseInt(hexcolor.substring(2, 4), 16);
        const b = parseInt(hexcolor.substring(4, 6), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#000000' : '#ffffff';
    }


    // --- Create Widget Elements ---
    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'n8n-chat-widget';

    // Chat Window
    const chatContainer = document.createElement('div');
    chatContainer.className = `chat-container`; // Position class removed, handled by style tag

    // Chat Interface (Always present now)
    const chatInterfaceHTML = `
        <div class="chat-interface">
            <div class="brand-header">
                ${config.branding.logo ? `<img src="<span class="math-inline">\{config\.branding\.logo\}" alt\="</span>{config.branding.name}">` : ''}
                <span>${config.branding.name}</span>
                <button class="close-button" aria-label="Close Chat">×</button>
            </div>
            <div class="chat-messages">
                 </div>
            <div class="chat-input">
                <textarea placeholder="Type your message..." rows="1" aria-label="Chat message input"></textarea>
                <button type="submit" aria-label="Send Message" disabled>
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                </button>
            </div>
            </div>
    `;
    chatContainer.innerHTML = chatInterfaceHTML; // Directly set interface HTML

    // Toggle Button
    const toggleButton = document.createElement('button');
    toggleButton.className = `chat-toggle`; // Position class removed
    toggleButton.setAttribute('aria-label', 'Toggle Chat');
    toggleButton.innerHTML = `
        <svg class="chat-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
             <path d="M12 2C6.477 2 2 6.477 2 12c0 1.821.487 3.53 1.338 5L2.5 21.5l4.5-.838A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18c-1.476 0-2.886-.313-4.156-.878l-3.156.586.586-3.156A7.962 7.962 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z"/>
        </svg>
        <svg class="close-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>`;

    // Text Bubble
    const chatBubble = document.createElement('div');
    chatBubble.className = 'chat-bubble';
    chatBubble.textContent = config.branding.welcomeText; // Use welcome text for bubble

    // Append elements to container and body
    widgetContainer.appendChild(chatContainer);
    widgetContainer.appendChild(chatBubble); // Bubble added
    widgetContainer.appendChild(toggleButton);
    document.body.appendChild(widgetContainer);

    // --- Get References to Dynamic Elements ---
    const chatInterface = chatContainer.querySelector('.chat-interface');
    const messagesContainer = chatContainer.querySelector('.chat-messages');
    const textarea = chatContainer.querySelector('textarea');
    const sendButton = chatContainer.querySelector('button[type="submit"]');
    const closeButton = chatContainer.querySelector('.close-button'); // Get close button ref

     // Typing indicator element (kept hidden initially)
    let typingIndicator = null;
    function showTypingIndicator() {
        if (!typingIndicator) {
            typingIndicator = document.createElement('div');
            typingIndicator.className = 'chat-message bot typing-indicator';
            typingIndicator.innerHTML = '<span></span><span></span><span></span>';
        }
        if (!messagesContainer.contains(typingIndicator)) {
            messagesContainer.appendChild(typingIndicator);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
    function hideTypingIndicator() {
        if (typingIndicator && messagesContainer.contains(typingIndicator)) {
            messagesContainer.removeChild(typingIndicator);
        }
    }

    // --- Core Functions ---
    function generateUUID() {
        return crypto.randomUUID();
    }

    // Function to add a message to the chat display
    function addMessageToDisplay(text, type = 'bot') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type}`;
        // Basic Markdown Links: [text](url)
        messageDiv.innerHTML = text.replace(/\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight; // Auto-scroll
    }


    async function startOrResumeConversation() {
        if (isChatStarted) return; // Don't re-fetch if already started

        isChatStarted = true; // Mark as started
        if (!currentSessionId) {
            currentSessionId = generateUUID();
        }

        showTypingIndicator(); // Show typing before fetch

        const payload = {
            action: "loadPreviousSession", // Or use a dedicated 'start' action if your backend has one
            sessionId: currentSessionId,
            route: config.webhook.route,
            metadata: { userId: "" } // Add any relevant initial metadata
        };

        try {
            const response = await fetch(config.webhook.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([payload]) // Send as array if backend expects array
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const responseData = await response.json();
            hideTypingIndicator();

            // Handle potential array response
             const outputData = Array.isArray(responseData) ? responseData[0] : responseData;

            if (outputData && outputData.output) {
                 // Check if messages already exist to avoid duplication on mere 'resume'
                if (messagesContainer.children.length === 0 || (messagesContainer.children.length === 1 && messagesContainer.contains(typingIndicator))) {
                     addMessageToDisplay(outputData.output, 'bot');
                }
            } else if (outputData && outputData.messages) {
                 // If backend returns previous messages
                 messagesContainer.innerHTML = ''; // Clear existing messages before loading history
                 outputData.messages.forEach(msg => addMessageToDisplay(msg.text, msg.type));
            } else {
                 // Fallback if no specific output or messages field
                 console.warn("No initial message received from webhook.");
                 // Optionally add a default client-side welcome if needed
                 if (messagesContainer.children.length === 0) {
                     addMessageToDisplay(config.branding.welcomeText, 'bot');
                 }
            }

        } catch (error) {
            console.error('Error starting conversation:', error);
            hideTypingIndicator();
            addMessageToDisplay('Sorry, I couldn\'t connect right now. Please try again later.', 'bot');
        } finally {
            textarea.focus(); // Focus input after loading
        }
    }

    async function sendMessage(message) {
        if (!message || !currentSessionId) return;

        addMessageToDisplay(message, 'user');
        textarea.value = ''; // Clear input immediately
        textarea.style.height = 'auto'; // Reset height
        sendButton.disabled = true; // Disable send button after sending
        showTypingIndicator(); // Show typing indicator

        const payload = {
            action: "sendMessage",
            sessionId: currentSessionId,
            route: config.webhook.route,
            chatInput: message,
            metadata: { userId: "" }
        };

        try {
            const response = await fetch(config.webhook.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload) // Send single object if backend expects that for send
            });

             if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const responseData = await response.json();
            hideTypingIndicator();

            // Handle potential array response (though less common for send replies)
            const outputData = Array.isArray(responseData) ? responseData[0] : responseData;

            if (outputData && outputData.output) {
                addMessageToDisplay(outputData.output, 'bot');
            } else {
                 console.warn("Received empty response from webhook after sending message.");
                 // Optionally add a default "I received your message" or error
            }

        } catch (error) {
            console.error('Error sending message:', error);
            hideTypingIndicator();
            addMessageToDisplay('Sorry, there was an error sending your message.', 'bot');
        }
    }

     // --- Event Listeners ---

     // Auto-resize textarea
    textarea.addEventListener('input', () => {
        textarea.style.height = 'auto'; // Reset height
        textarea.style.height = `${Math.min(textarea.scrollHeight, 100)}px`; // Set new height, max 100px
        sendButton.disabled = textarea.value.trim().length === 0; // Enable/disable send button
    });

    // Send Button Click
    sendButton.addEventListener('click', () => {
        const message = textarea.value.trim();
        if (message) {
            sendMessage(message);
        }
    });

    // Textarea Enter Keypress (Send on Enter, Newline on Shift+Enter)
    textarea.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent newline
            const message = textarea.value.trim();
            if (message) {
                sendMessage(message);
            }
        }
    });

    // Toggle Button Click (Open/Close Chat)
    toggleButton.addEventListener('click', () => {
        const isOpen = chatContainer.classList.toggle('open');
        if (isOpen && !isChatStarted) {
            startOrResumeConversation(); // Start conversation only on first open
        } else if (isOpen) {
            textarea.focus(); // Focus input when reopening
        }
    });

    // Close Button Click (Inside Chat Header)
    closeButton.addEventListener('click', () => {
        chatContainer.classList.remove('open');
    });

})(); // End IIFE
