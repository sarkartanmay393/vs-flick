"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const socket_io_client_1 = require("socket.io-client");
let socket;
let statusBarItem;
let currentCode;
// Optimistic State Tracking
// We can't read actual state easily, so we track what we think it is.
// Initial assumption: Sidebar Open, Panel Closed, Aux Bar Closed.
let state = {
    sidebar: true,
    auxbar: false,
    panel: true,
    zen: false
};
function activate(context) {
    console.log('VS Flick is active');
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'vs-flick.showMenu';
    context.subscriptions.push(statusBarItem);
    updateStatusBar('Offline');
    statusBarItem.show();
    context.subscriptions.push(vscode.commands.registerCommand('vs-flick.start', () => startServer()), vscode.commands.registerCommand('vs-flick.stop', stopServer), vscode.commands.registerCommand('vs-flick.showMenu', showMenu));
}
function updateStatusBar(status) {
    statusBarItem.text = `$(broadcast) Flick: ${status}`;
}
function showMenu() {
    return __awaiter(this, void 0, void 0, function* () {
        const items = [];
        if (!socket) {
            items.push({ label: 'Start Server', description: 'Connect to Relay Server', command: 'vs-flick.start' });
        }
        else {
            items.push({ label: 'Stop Server', description: `Disconnect (Code: ${currentCode})`, command: 'vs-flick.stop' });
            items.push({ label: 'Resync State', description: 'Force update PWA state', command: 'vs-flick.resync' }); // Todo implement if needed
        }
        const selection = yield vscode.window.showQuickPick(items);
        if (selection && selection.command) {
            vscode.commands.executeCommand(selection.command);
        }
    });
}
function startServer() {
    return __awaiter(this, void 0, void 0, function* () {
        const serverUrl = 'http://localhost:3000';
        try {
            socket = (0, socket_io_client_1.io)(serverUrl);
            socket.on('connect', () => {
                console.log('Connected to Relay Server');
                // Request session creation
                socket === null || socket === void 0 ? void 0 : socket.emit('create_session', (response) => {
                    if (response && response.code) {
                        currentCode = response.code;
                        updateStatusBar(`${currentCode}`);
                        vscode.window.showInformationMessage(`VS Flick Paired! Code: ${currentCode}`);
                        broadcastState(); // Send initial state
                    }
                });
            });
            socket.on('pwa_connected', () => {
                vscode.window.showInformationMessage('Phone Connected!');
                broadcastState(); // Sync state on join
            });
            socket.on('command', (data) => __awaiter(this, void 0, void 0, function* () {
                const cmd = data.action;
                const vsCmd = getCommandId(cmd);
                if (vsCmd) {
                    yield vscode.commands.executeCommand(vsCmd);
                    updateInternalState(cmd);
                    broadcastState();
                }
            }));
            socket.on('disconnect', () => {
                updateStatusBar('Disconnected');
            });
        }
        catch (e) {
            vscode.window.showErrorMessage(`Failed to connect to VS Flick Server: ${e}`);
        }
    });
}
function stopServer() {
    socket === null || socket === void 0 ? void 0 : socket.disconnect();
    socket = undefined;
    currentCode = undefined;
    updateStatusBar('Offline');
}
function getCommandId(action) {
    const map = {
        'sidebar': 'workbench.action.toggleSidebarVisibility',
        'auxbar': 'workbench.action.toggleAuxiliaryBar',
        'panel': 'workbench.action.togglePanel',
        'zen': 'workbench.action.toggleZenMode'
    };
    return map[action];
}
function updateInternalState(action) {
    // Toggle the tracked boolean
    if (action === 'sidebar')
        state.sidebar = !state.sidebar;
    if (action === 'auxbar')
        state.auxbar = !state.auxbar;
    if (action === 'panel')
        state.panel = !state.panel;
    if (action === 'zen')
        state.zen = !state.zen;
}
function broadcastState() {
    if (socket && currentCode) {
        socket.emit('status', { code: currentCode, state });
    }
}
function deactivate() {
    stopServer();
}
//# sourceMappingURL=extension.js.map