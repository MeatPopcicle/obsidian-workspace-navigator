// ═══════════════════════════════════════════════════════════════════════════════
// LOCAL HTTP API
// A loopback-only, token-authed HTTP server inside the plugin so external
// tooling (the bundled MCP server, scripts, Claude sessions) can list, switch,
// and reveal workspaces. Desktop only; disabled by default; the port and token
// live in settings. Precedent for the pattern: obsidian-local-rest-api.
// ═══════════════════════════════════════════════════════════════════════════════

import { Platform } from 'obsidian';
import { notify } from './notify';
import type WorkspaceNavigator from './main';

// Typed lazily via require so the mobile bundle never touches node:http.
type NodeHttpServer = { listen: Function; close: Function; on: Function };

export class WnApiServer {
	private plugin: WorkspaceNavigator;
	private server: NodeHttpServer | null = null;

	constructor(plugin: WorkspaceNavigator) {
		this.plugin = plugin;
	}

	get running(): boolean {
		return this.server !== null;
	}

	start(): void {
		if (this.server) return;
		if (!Platform.isDesktopApp) return;
		if (!this.plugin.settings.apiEnabled) return;

		const http = require('http');
		const port = this.plugin.settings.apiPort;

		const server = http.createServer((req: any, res: any) => {
			void this.handle(req, res);
		});
		server.on('error', (err: any) => {
			this.server = null;
			if (err?.code === 'EADDRINUSE') {
				notify(`Workspace API port ${port} is already in use (another vault instance?). API disabled for this instance.`, 'error');
			} else {
				notify(`Workspace API failed to start: ${err?.message ?? err}`, 'error');
			}
		});
		// Loopback only: never reachable off-machine.
		server.listen(port, '127.0.0.1');
		this.server = server;
	}

	stop(): void {
		if (this.server) {
			this.server.close();
			this.server = null;
		}
	}

	restart(): void {
		this.stop();
		this.start();
	}

	// ─────────────────────────────────────────────────────────────────
	// Request handling
	// ─────────────────────────────────────────────────────────────────

	private async handle(req: any, res: any): Promise<void> {
		const send = (status: number, body: unknown) => {
			const json = JSON.stringify(body);
			res.writeHead(status, { 'Content-Type': 'application/json' });
			res.end(json);
		};

		try {
			const token = this.plugin.settings.apiToken;
			const auth = String(req.headers['authorization'] ?? '');
			if (!token || auth !== `Bearer ${token}`) {
				send(401, { error: 'missing or invalid token' });
				return;
			}

			const url = new URL(req.url ?? '/', 'http://127.0.0.1');
			const route = `${req.method} ${url.pathname}`;
			const mgr = this.plugin.getWorkspaceManager();

			switch (route) {
				case 'GET /status': {
					send(200, {
						vault: this.plugin.app.vault.getName(),
						plugin: this.plugin.manifest.version,
						activeWorkspace: mgr.getActiveWorkspace(),
						workspaceCount: mgr.getWorkspaceNames().length,
					});
					return;
				}

				case 'GET /workspaces': {
					const names = mgr.getWorkspaceNames();
					send(200, {
						active: mgr.getActiveWorkspace(),
						mruOrder: mgr.sortByMostRecentlyUsed(names),
						workspaces: names.map((name) => ({
							name,
							group: mgr.getWorkspaceGroup(name),
							lastUsedAt: mgr.getWorkspace(name)?.metadata?.lastUsedAt ?? null,
						})),
						groups: mgr.getGroups(),
					});
					return;
				}

				case 'GET /workspace-for': {
					const path = url.searchParams.get('path') ?? '';
					if (!path) { send(400, { error: 'path query parameter required' }); return; }
					const resolved = this.plugin.resolveNotePath(path);
					if (!resolved) {
						send(404, { error: `no file matches ${JSON.stringify(path)} (paths are vault-root-relative; partial paths and note names are resolved when unambiguous)` });
						return;
					}
					const candidates = mgr.sortByMostRecentlyUsed(mgr.getWorkspacesWithFile(resolved.resolvedPath));
					send(200, { path, resolvedPath: resolved.resolvedPath, workspaces: candidates, active: mgr.getActiveWorkspace() });
					return;
				}

				case 'POST /switch': {
					const body = await this.readJson(req);
					const name = String(body?.workspace ?? '');
					if (!name) { send(400, { error: 'workspace required' }); return; }
					if (!mgr.hasWorkspace(name)) { send(404, { error: `no workspace named ${JSON.stringify(name)}` }); return; }
					await this.plugin.switchToWorkspace(name);
					send(200, { switched: name, active: mgr.getActiveWorkspace() });
					return;
				}

				case 'POST /reveal': {
					const body = await this.readJson(req);
					const path = String(body?.path ?? '');
					if (!path) { send(400, { error: 'path required' }); return; }
					const result = await this.plugin.revealNote(path);
					send(result.error ? 404 : 200, result);
					return;
				}

				default:
					send(404, { error: `no route ${route}` });
			}
		} catch (err: any) {
			send(500, { error: err?.message ?? String(err) });
		}
	}

	private readJson(req: any): Promise<any> {
		return new Promise((resolve, reject) => {
			let data = '';
			req.on('data', (chunk: any) => {
				data += chunk;
				if (data.length > 65536) reject(new Error('body too large'));
			});
			req.on('end', () => {
				try { resolve(data ? JSON.parse(data) : {}); }
				catch { reject(new Error('invalid JSON body')); }
			});
			req.on('error', reject);
		});
	}
}
