import * as vscode from 'vscode';
import { io, Socket } from 'socket.io-client';

let socket: Socket | undefined;
let statusBarItem: vscode.StatusBarItem;
let currentCode: string | undefined;

// Optimistic State Tracking
// We can't read actual state easily, so we track what we think it is.
// Initial assumption: Sidebar Open, Panel Closed, Aux Bar Closed.
let state = {
    sidebar: true,
    auxbar: false,
    panel: true,
    zen: false
};

export function activate(context: vscode.ExtensionContext) {
    console.log('VS Flick is active');

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'vs-flick.showMenu';
    context.subscriptions.push(statusBarItem);
    updateStatusBar('Offline');
    statusBarItem.show();

    context.subscriptions.push(
        vscode.commands.registerCommand('vs-flick.start', () => startServer()),
        vscode.commands.registerCommand('vs-flick.stop', stopServer),
        vscode.commands.registerCommand('vs-flick.showMenu', showMenu)
    );
}

function updateStatusBar(status: string) {
    statusBarItem.text = `$(broadcast) Flick: ${status}`;
}

async function showMenu() {
    const items = [];
    if (!socket) {
        items.push({ label: 'Start Server', description: 'Connect to Relay Server', command: 'vs-flick.start' });
    } else {
        items.push({ label: 'Stop Server', description: `Disconnect (Code: ${currentCode})`, command: 'vs-flick.stop' });
        items.push({ label: 'Resync State', description: 'Force update PWA state', command: 'vs-flick.resync' }); // Todo implement if needed
    }

    const selection = await vscode.window.showQuickPick(items);
    if (selection && selection.command) {
        vscode.commands.executeCommand(selection.command);
    }
}

async function startServer() {
    const config = vscode.workspace.getConfiguration('vs-flick');
    const serverUrl = config.get<string>('serverUrl') || 'http://localhost:3000';

    try {
        socket = io(serverUrl);

        socket.on('connect', () => {
            console.log('Connected to Relay Server');
            // Request session creation
            socket?.emit('create_session', (response: any) => {
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

        socket.on('command', async (data: any) => {
            const cmd = data.action;
            const vsCmd = getCommandId(cmd);
            if (vsCmd) {
                await vscode.commands.executeCommand(vsCmd);
                updateInternalState(cmd);
                broadcastState();
            }
        });

        socket.on('disconnect', () => {
            updateStatusBar('Disconnected');
        });

    } catch (e) {
        vscode.window.showErrorMessage(`Failed to connect to VS Flick Server: ${e}`);
    }
}

function stopServer() {
    socket?.disconnect();
    socket = undefined;
    currentCode = undefined;
    updateStatusBar('Offline');
}

function getCommandId(action: string): string | undefined {
    const map: { [key: string]: string } = {
        'sidebar': 'workbench.action.toggleSidebarVisibility',
        'auxbar': 'workbench.action.toggleAuxiliaryBar',
        'panel': 'workbench.action.togglePanel',
        'zen': 'workbench.action.toggleZenMode'
    };
    return map[action];
}

function updateInternalState(action: string) {
    // Toggle the tracked boolean
    if (action === 'sidebar') state.sidebar = !state.sidebar;
    if (action === 'auxbar') state.auxbar = !state.auxbar;
    if (action === 'panel') state.panel = !state.panel;
    if (action === 'zen') state.zen = !state.zen;
}

function broadcastState() {
    if (socket && currentCode) {
        socket.emit('status', { code: currentCode, state });
    }
}

export function deactivate() {
    stopServer();
}
