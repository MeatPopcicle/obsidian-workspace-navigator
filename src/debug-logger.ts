// ═══════════════════════════════════════════════════════════════════════════════
// DEBUG LOGGER UTILITY
// ═══════════════════════════════════════════════════════════════════════════════

import { App } from 'obsidian';

// ───────────────────────────────────────────────────────────────────────────────
// Logger Class
// ───────────────────────────────────────────────────────────────────────────────

export class DebugLogger {
    private app:        App;
    private enabled:    boolean;
    private logPath:    string;
    private buffer:     string[] = [];
    private flushTimer: NodeJS.Timeout | null = null;

    constructor(app: App, enabled: boolean = false, logPath: string = 'workspace-navigator-debug.log') {
        this.app     = app;
        this.enabled = enabled;
        this.logPath = logPath;
    }

    // ─────────────────────────────────────────────────────────────────
    // Configuration
    // ─────────────────────────────────────────────────────────────────

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    setLogPath(path: string): void {
        this.logPath = path;
    }

    // ─────────────────────────────────────────────────────────────────
    // Logging Methods
    // ─────────────────────────────────────────────────────────────────

    log(category: string, message: string, data?: Record<string, unknown>): void {
        if (!this.enabled) return;

        const timestamp = new Date().toISOString();
        let logLine     = `[${timestamp}] [${category}] ${message}`;

        if (data) {
            const dataStr = Object.entries(data)
                .map(([key, value]) => `  ${key}: ${this.formatValue(value)}`)
                .join('\n');
            logLine += '\n' + dataStr;
        }

        this.buffer.push(logLine);
        this.scheduleFlush();

        // Also log to console for immediate visibility
        console.log(`[WorkspaceNav] ${category}: ${message}`, data || '');
    }

    info(category: string, message: string, data?: Record<string, unknown>): void {
        this.log(category, `INFO: ${message}`, data);
    }

    warn(category: string, message: string, data?: Record<string, unknown>): void {
        this.log(category, `WARN: ${message}`, data);
    }

    error(category: string, message: string, data?: Record<string, unknown>): void {
        this.log(category, `ERROR: ${message}`, data);
    }

    // ─────────────────────────────────────────────────────────────────
    // CSS Debug Helper
    // ─────────────────────────────────────────────────────────────────

    logComputedStyles(category: string, element: HTMLElement, properties: string[]): void {
        if (!this.enabled) return;

        const computedStyle = window.getComputedStyle(element);
        const data: Record<string, unknown> = {
            classes:  element.className,
            inDOM:    document.body.contains(element),
            parent:   element.parentElement?.className || 'none',
        };

        for (const prop of properties) {
            data[prop] = computedStyle.getPropertyValue(prop) || computedStyle[prop as keyof CSSStyleDeclaration];
        }

        this.log(category, `Computed styles for <${element.tagName.toLowerCase()}>`, data);
    }

    // ─────────────────────────────────────────────────────────────────
    // Private Helpers
    // ─────────────────────────────────────────────────────────────────

    private formatValue(value: unknown): string {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (typeof value === 'string') return value;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        if (Array.isArray(value)) return JSON.stringify(value);
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
    }

    private scheduleFlush(): void {
        if (this.flushTimer) return;

        this.flushTimer = setTimeout(() => {
            this.flush();
            this.flushTimer = null;
        }, 500);
    }

    async flush(): Promise<void> {
        if (this.buffer.length === 0) return;

        const content  = this.buffer.join('\n') + '\n';
        this.buffer    = [];
        const adapter  = this.app.vault.adapter;

        try {
            const existing = await adapter.read(this.logPath).catch(() => '');
            await adapter.write(this.logPath, existing + content);
        } catch (e) {
            console.error('[WorkspaceNav] Failed to write debug log:', e);
        }
    }

    async clear(): Promise<void> {
        this.buffer = [];
        try {
            await this.app.vault.adapter.write(this.logPath, '');
        } catch (e) {
            // File may not exist yet
        }
    }
}
