// ═══════════════════════════════════════════════════════════════════════════════
// GROUP HEADER RENDERING UTILITY
// Shared between WorkspaceSwitcherModal and WorkspaceEditorModal
// ═══════════════════════════════════════════════════════════════════════════════

import { setIcon } from 'obsidian';
import { WorkspaceManager } from './workspace-manager';

// ───────────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────────

export interface GroupHeaderConfig {
    groupName:       string;
    isCollapsed:     boolean;
    useManualOrder:  boolean;
    workspaceManager: WorkspaceManager;
    onToggleCollapse: (groupName: string) => void;
    onStyleClick:     (groupName: string) => void;
    onRenameClick:    (container: HTMLElement, textSpan: HTMLElement, groupName: string) => void;
    onDeleteClick:    (groupName: string) => void;
    onDragStart?:     (evt: MouseEvent, groupName: string, container: HTMLElement) => void;
}

// ───────────────────────────────────────────────────────────────────────────────
// Constants
// ───────────────────────────────────────────────────────────────────────────────

const NO_GROUP_KEY = '\x00nogroup';

// ───────────────────────────────────────────────────────────────────────────────
// Group Header Rendering
// ───────────────────────────────────────────────────────────────────────────────

export function renderGroupHeader(container: HTMLElement, config: GroupHeaderConfig): void {
    const {
        groupName,
        isCollapsed,
        useManualOrder,
        workspaceManager,
        onToggleCollapse,
        onStyleClick,
        onRenameClick,
        onDeleteClick,
        onDragStart,
    } = config;

    const isNoGroup    = groupName === NO_GROUP_KEY;
    const displayName  = isNoGroup ? 'No Group' : groupName;
    const hasGroups    = workspaceManager.getGroups().length > 0;

    // ─────────────────────────────────────────────────────────────────
    // Apply inline styles (CSS classes don't work reliably in modals)
    // ─────────────────────────────────────────────────────────────────

    container.style.position        = 'relative';
    container.style.display         = 'flex';
    container.style.alignItems      = 'center';
    container.style.gap             = '6px';
    container.style.padding         = '8px 6rem 8px 16px';
    container.style.marginTop       = '8px';
    container.style.fontSize        = '0.75em';
    container.style.fontWeight      = '600';
    container.style.color           = 'var(--text-muted)';
    container.style.letterSpacing   = '0.05em';
    container.style.backgroundColor = 'var(--background-secondary)';
    container.style.borderRadius    = '6px 6px 0 0';  // Card top: rounded top corners only
    container.style.border          = '1px solid var(--background-modifier-border)';
    container.style.borderBottom    = 'none';  // No bottom border - continues into card body

    // Store group name on container for drop handling
    container.dataset.groupName = groupName;

    // ─────────────────────────────────────────────────────────────────
    // Drag handle (for group reordering)
    // ─────────────────────────────────────────────────────────────────

    if (useManualOrder && hasGroups) {
        const dragHandle = document.createElement('span');
        dragHandle.className = 'workspace-group-drag-handle';
        // Absolutely position handle - aligned with workspace handles
        dragHandle.style.position       = 'absolute';
        dragHandle.style.left           = '0.3em';
        dragHandle.style.top            = '50%';
        dragHandle.style.transform      = 'translateY(-50%)';
        dragHandle.style.display        = 'flex';
        dragHandle.style.alignItems     = 'center';
        dragHandle.style.justifyContent = 'center';
        dragHandle.style.width          = '1.2em';
        dragHandle.style.height         = '1.2em';
        setIcon(dragHandle, 'grip-vertical');

        if (isNoGroup) {
            // Greyed out placeholder for visual balance - not functional
            dragHandle.style.opacity = '0.15';
            dragHandle.style.cursor  = 'default';
        } else if (onDragStart) {
            // Functional handle for named groups
            dragHandle.style.opacity = '0.3';
            dragHandle.style.cursor  = 'grab';
            dragHandle.setAttribute('title', 'Drag to reorder group');

            dragHandle.addEventListener('mousedown', (evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                onDragStart(evt, groupName, container);
            });

            dragHandle.addEventListener('mouseenter', () => { dragHandle.style.opacity = '0.8'; });
            dragHandle.addEventListener('mouseleave', () => { dragHandle.style.opacity = '0.3'; });
        }

        container.appendChild(dragHandle);
    }

    // ─────────────────────────────────────────────────────────────────
    // Collapse/expand chevron
    // ─────────────────────────────────────────────────────────────────

    const chevron = document.createElement('span');
    chevron.className     = 'workspace-group-chevron';
    chevron.style.display = 'inline-flex';
    chevron.style.alignItems = 'center';
    chevron.style.fill    = 'var(--text-muted)';
    chevron.style.cursor  = 'pointer';
    chevron.innerHTML = isCollapsed
        ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M13.172 12l-4.95-4.95 1.414-1.414L16 12l-6.364 6.364-1.414-1.414z"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M12 13.172l4.95-4.95 1.414 1.414L12 16 5.636 9.636 7.05 8.222z"/></svg>`;
    chevron.setAttribute('title', isCollapsed ? 'Expand group' : 'Collapse group');
    chevron.addEventListener('click', (evt) => {
        evt.stopPropagation();
        onToggleCollapse(groupName);
    });
    container.appendChild(chevron);

    // ─────────────────────────────────────────────────────────────────
    // Group icon (always show - default if not set)
    // ─────────────────────────────────────────────────────────────────

    const groupIcon = isNoGroup
        ? workspaceManager.getGroupIcon(NO_GROUP_KEY)
        : workspaceManager.getGroupIcon(groupName);

    const iconSpan = document.createElement('span');
    iconSpan.className     = 'workspace-group-icon';
    iconSpan.style.display = 'inline-flex';
    iconSpan.style.alignItems = 'center';

    if (groupIcon) {
        setIcon(iconSpan, groupIcon);
        const iconColor = isNoGroup
            ? workspaceManager.getGroupIconColor(NO_GROUP_KEY)
            : workspaceManager.getGroupIconColor(groupName);
        if (iconColor) {
            iconSpan.style.color = iconColor;
        }
    } else {
        // Default icon for groups without a custom icon
        setIcon(iconSpan, 'folder');
        iconSpan.style.opacity = '0.4';
    }
    container.appendChild(iconSpan);

    // ─────────────────────────────────────────────────────────────────
    // Group name text
    // ─────────────────────────────────────────────────────────────────

    const textSpan = document.createElement('span');
    textSpan.className   = 'workspace-group-text';
    textSpan.style.flex  = '1';
    textSpan.textContent = displayName;
    textSpan.dataset.groupName = groupName;
    const groupColor = isNoGroup
        ? workspaceManager.getGroupColor(NO_GROUP_KEY)
        : workspaceManager.getGroupColor(groupName);
    if (groupColor) {
        textSpan.style.color = groupColor;
    }
    container.appendChild(textSpan);

    // ─────────────────────────────────────────────────────────────────
    // Workspace count (for collapsed groups)
    // ─────────────────────────────────────────────────────────────────

    if (isCollapsed) {
        const count = isNoGroup
            ? workspaceManager.getWorkspacesByGroup(null).length
            : workspaceManager.getWorkspacesByGroup(groupName).length;
        const countSpan = document.createElement('span');
        countSpan.className      = 'workspace-group-count';
        countSpan.style.color    = 'var(--text-faint)';
        countSpan.style.fontSize = '0.9em';
        countSpan.style.marginLeft = '0.3em';
        countSpan.textContent = `(${count})`;
        container.appendChild(countSpan);
    }

    // ─────────────────────────────────────────────────────────────────
    // Action buttons container styles
    // ─────────────────────────────────────────────────────────────────

    const buttonBaseStyle = {
        position:  'absolute' as const,
        top:       '50%',
        transform: 'translateY(-50%)',
        display:   'inline-flex',
        alignItems: 'center',
        fill:      'var(--text-muted)',
        cursor:    'pointer',
        padding:   '2px',
    };

    // ─────────────────────────────────────────────────────────────────
    // Style button (palette)
    // ─────────────────────────────────────────────────────────────────

    const styleBtn = document.createElement('span');
    styleBtn.className = 'workspace-group-edit-btn workspace-group-style-btn';
    Object.assign(styleBtn.style, buttonBaseStyle);
    styleBtn.style.right = '3.3em';
    styleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M12 2c5.522 0 10 3.978 10 8.889a5.558 5.558 0 0 1-5.556 5.555h-1.966c-.922 0-1.667.745-1.667 1.667 0 .422.167.811.422 1.1.267.3.434.689.434 1.122C13.667 21.256 12.9 22 12 22 6.478 22 2 17.522 2 12S6.478 2 12 2zM7.5 12a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm9 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM12 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>`;
    styleBtn.setAttribute('title', 'Edit group style');
    styleBtn.addEventListener('click', (evt) => {
        evt.stopPropagation();
        onStyleClick(groupName);
    });
    styleBtn.addEventListener('mouseenter', () => { styleBtn.style.fill = 'var(--text-accent-hover)'; });
    styleBtn.addEventListener('mouseleave', () => { styleBtn.style.fill = 'var(--text-muted)'; });
    container.appendChild(styleBtn);

    // ─────────────────────────────────────────────────────────────────
    // Rename button (pencil)
    // ─────────────────────────────────────────────────────────────────

    const renameBtn = document.createElement('span');
    renameBtn.className = 'workspace-group-edit-btn workspace-group-rename-btn';
    Object.assign(renameBtn.style, buttonBaseStyle);
    renameBtn.style.right = '2em';
    renameBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M12.9 6.858l4.242 4.243L7.242 21H3v-4.243l9.9-9.9zm1.414-1.414l2.121-2.122a1 1 0 0 1 1.414 0l2.829 2.829a1 1 0 0 1 0 1.414l-2.122 2.121-4.242-4.242z"/></svg>`;
    renameBtn.setAttribute('title', isNoGroup ? 'Name this group' : 'Rename group');
    renameBtn.addEventListener('click', (evt) => {
        evt.stopPropagation();
        onRenameClick(container, textSpan, groupName);
    });
    renameBtn.addEventListener('mouseenter', () => { renameBtn.style.fill = 'var(--text-accent-hover)'; });
    renameBtn.addEventListener('mouseleave', () => { renameBtn.style.fill = 'var(--text-muted)'; });
    container.appendChild(renameBtn);

    // ─────────────────────────────────────────────────────────────────
    // Delete button (trash)
    // ─────────────────────────────────────────────────────────────────

    const deleteBtn = document.createElement('span');
    deleteBtn.className = 'workspace-group-edit-btn workspace-group-delete-btn';
    Object.assign(deleteBtn.style, buttonBaseStyle);
    deleteBtn.style.right = '0.7em';
    deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M7 4V2h10v2h5v2h-2v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6H2V4h5zM6 6v14h12V6H6zm3 3h2v8H9V9zm4 0h2v8h-2V9z"/></svg>`;

    if (isNoGroup) {
        // Grayed-out placeholder for alignment
        deleteBtn.style.opacity = '0.25';
        deleteBtn.style.cursor  = 'default';
    } else {
        deleteBtn.setAttribute('title', 'Delete group (ungroup workspaces)');
        deleteBtn.addEventListener('click', (evt) => {
            evt.stopPropagation();
            onDeleteClick(groupName);
        });
        deleteBtn.addEventListener('mouseenter', () => { deleteBtn.style.fill = 'var(--text-error)'; });
        deleteBtn.addEventListener('mouseleave', () => { deleteBtn.style.fill = 'var(--text-muted)'; });
    }
    container.appendChild(deleteBtn);
}

// ───────────────────────────────────────────────────────────────────────────────
// Helper to add drop target styling
// ───────────────────────────────────────────────────────────────────────────────

export function setGroupDropTarget(container: HTMLElement, position: 'above' | 'below' | 'none'): void {
    container.style.boxShadow = '';

    if (position === 'above') {
        container.style.boxShadow = 'inset 0 2px 0 0 var(--interactive-accent)';
    } else if (position === 'below') {
        container.style.boxShadow = 'inset 0 -2px 0 0 var(--interactive-accent)';
    }
}

export function setGroupDragging(container: HTMLElement, isDragging: boolean): void {
    container.style.opacity = isDragging ? '0.3' : '';
}
