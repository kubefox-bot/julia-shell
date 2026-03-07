import { execFile, spawn } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const SERVER_TASK_NAME = 'YuliaAstroProd';
export const SERVER_PORT = 4321;
export const SERVER_URL = `http://julia.love:${SERVER_PORT}`;

const SCRIPTS_ROOT = path.join(process.cwd(), 'scripts', 'windows');
const CONTROL_SCRIPT = path.join(SCRIPTS_ROOT, 'astro-prod-control.ps1');
const REGISTER_SCRIPT = path.join(SCRIPTS_ROOT, 'astro-prod-register-task.ps1');

export type ServerAction = 'start' | 'restart' | 'stop';

export type ServerStatusPayload = {
    appStatus: 'running' | 'stopped';
    taskExists: boolean;
    taskState: string;
    portListening: boolean;
    url: string;
    message: string;
};

function assertWindows() {
    if (process.platform !== 'win32') {
        throw new Error('Windows server management is only available on Windows.');
    }
}

async function runPowerShell(args: string[], timeout = 120_000) {
    assertWindows();
    const result = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', ...args],
        {
            cwd: process.cwd(),
            windowsHide: true,
            maxBuffer: 2 * 1024 * 1024,
            timeout
        }
    );

    return {
        stdout: result.stdout?.toString().trim() ?? '',
        stderr: result.stderr?.toString().trim() ?? ''
    };
}

async function ensureTaskRegistered() {
    const status = await getServerStatus();
    if (!status.taskExists) {
        await runPowerShell(['-File', REGISTER_SCRIPT]);
    }
}

export async function getServerStatus(): Promise<ServerStatusPayload> {
    try {
        const { stdout } = await runPowerShell(['-File', CONTROL_SCRIPT, '-Action', 'status'], 30_000);
        const parsed = JSON.parse(stdout) as Partial<ServerStatusPayload>;

        return {
            appStatus: parsed.appStatus === 'running' ? 'running' : 'stopped',
            taskExists: Boolean(parsed.taskExists),
            taskState: typeof parsed.taskState === 'string' ? parsed.taskState : 'Unknown',
            portListening: Boolean(parsed.portListening),
            url: typeof parsed.url === 'string' ? parsed.url : SERVER_URL,
            message: typeof parsed.message === 'string' ? parsed.message : 'Server status loaded.'
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to read server status.';
        return {
            appStatus: 'stopped',
            taskExists: false,
            taskState: 'Unavailable',
            portListening: false,
            url: SERVER_URL,
            message
        };
    }
}

export async function controlServer(action: ServerAction) {
    await ensureTaskRegistered();

    if (action === 'start') {
        const { stdout } = await runPowerShell(['-File', CONTROL_SCRIPT, '-Action', 'start'], 30_000);
        let message = 'Production start requested.';

        try {
            const parsed = JSON.parse(stdout) as Partial<ServerStatusPayload>;
            if (typeof parsed.message === 'string' && parsed.message) {
                message = parsed.message;
            }
        } catch {
            if (stdout) {
                message = stdout;
            }
        }

        return {
            accepted: true,
            action,
            message
        };
    }

    const child = spawn(
        'cmd.exe',
        [
            '/c',
            'start',
            '""',
            'powershell.exe',
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            CONTROL_SCRIPT,
            '-Action',
            action,
            '-Detached'
        ],
        {
            cwd: process.cwd(),
            windowsHide: true,
            detached: true,
            stdio: 'ignore'
        }
    );

    child.unref();

    return {
        accepted: true,
        action,
        message: action === 'restart'
            ? 'Пересборка и перезапуск production запущены.'
            : 'Остановка production запущена.'
    };
}
