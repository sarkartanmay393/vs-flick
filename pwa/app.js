const defaultUrl = "https://vs-flick.onrender.com";
let serverUrl = localStorage.getItem('vs-flick-server') || defaultUrl;

// Initialize socket with current URL
let socket = io(serverUrl, { autoConnect: false });

const screens = {
    connection: document.getElementById('connection-screen'),
    control: document.getElementById('control-screen')
};

const ui = {
    codeInput: document.getElementById('code-input'),
    connectBtn: document.getElementById('connect-btn'),
    statusMsg: document.getElementById('status-msg'),
    disconnectBtn: document.getElementById('disconnect-btn'),
    buttons: document.querySelectorAll('.control-btn'),
    settingsToggle: document.getElementById('settings-toggle'),
    settingsPanel: document.getElementById('settings-panel'),
    serverInput: document.getElementById('server-url-input'),
    saveSettingsBtn: document.getElementById('save-settings-btn')
};

ui.serverInput.value = serverUrl;

let currentCode = '';

// Event Listeners
ui.connectBtn.addEventListener('click', connect);
ui.disconnectBtn.addEventListener('click', disconnect);

ui.settingsToggle.addEventListener('click', () => {
    ui.settingsPanel.classList.toggle('hidden');
});

ui.saveSettingsBtn.addEventListener('click', () => {
    const newUrl = ui.serverInput.value.trim();
    if (newUrl) {
        localStorage.setItem('vs-flick-server', newUrl);
        serverUrl = newUrl;
        ui.settingsPanel.classList.add('hidden');
        ui.statusMsg.textContent = 'Server URL updated. Reconnecting...';

        // Re-init socket
        if (socket) socket.disconnect();
        socket = io(serverUrl, { autoConnect: false });
        setupSocketEvents();
    }
});

ui.buttons.forEach(btn => {
    btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        sendAction(action);
        if (navigator.vibrate) navigator.vibrate(50);
    });
});

setupSocketEvents();

function setupSocketEvents() {
    socket.on('connect', () => {
        ui.statusMsg.textContent = 'Connected! Joining room...';
        socket.emit('join_session', { code: currentCode }, (response) => {
            if (response.error) {
                ui.statusMsg.textContent = response.error;
                socket.disconnect();
            } else {
                showScreen('control');
            }
        });
    });

    socket.on('disconnect', () => {
        showScreen('connection');
        ui.statusMsg.textContent = 'Disconnected';
    });

    socket.on('status', (state) => {
        console.log('Received state:', state);
        if (!state) return; // ignore empty state

        // state = { sidebar: boolean, zen: boolean, ... }
        updateButtonState('sidebar', state.sidebar);
        updateButtonState('auxbar', state.auxbar);
        updateButtonState('panel', state.panel);
        updateButtonState('zen', state.zen);
    });

    socket.on('session_closed', () => {
        alert('VS Code disconnected the session');
        disconnect();
    });

    function connect() {
        const code = ui.codeInput.value;
        if (code.length !== 4) {
            ui.statusMsg.textContent = 'Enter 4-digit code';
            return;
        }
        currentCode = code;
        socket.connect();
    }

    function disconnect() {
        socket.disconnect();
        showScreen('connection');
        resetButtons();
    }

    function sendAction(action) {
        if (socket.connected) {
            socket.emit('command', { code: currentCode, action });
        }
    }

    function updateButtonState(action, isActive) {
        const btn = document.querySelector(`.control-btn[data-action="${action}"]`);
        if (btn) {
            if (isActive) {
                btn.classList.add('active-state');
            } else {
                btn.classList.remove('active-state');
            }
        }
    }

    function resetButtons() {
        document.querySelectorAll('.control-btn').forEach(b => b.classList.remove('active-state'));
    }

    function showScreen(name) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[name].classList.add('active');
    }
