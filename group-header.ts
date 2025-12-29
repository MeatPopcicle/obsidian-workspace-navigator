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
    onEditClick:      (groupName: string) => void;  // Opens full editor modal
    onRenameClick:    (container: HTMLElement, textSpan: HTMLElement, groupName: string) => void;  // Quick inline rename
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
        onEditClick,
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
    container.style.padding         = '8px 75px 8px 16px';  // Right padding for 2 buttons (edit + delete)
    container.style.marginTop       = '8px';
    container.style.fontWeight      = 'normal';
    container.style.color           = 'var(--text-muted)';
    // Font size and letter-spacing inherit from parent (matches workspace items)
    container.style.backgroundColor = 'var(--background-primary-alt)';
    container.style.border          = '1px solid var(--background-modifier-border)';

    if (isCollapsed) {
        // Collapsed: full card with rounded corners all around
        container.style.borderRadius = '6px';
    } else {
        // Expanded: card top only, workspaces continue below
        container.style.borderRadius    = '6px 6px 0 0';
        container.style.borderBottom    = 'none';
    }

    // Store group name on container for drop handling
    container.dataset.groupName = groupName;

    // Right-click triggers quick inline rename
    container.addEventListener('contextmenu', (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        const textSpan = container.querySelector('.workspace-group-text') as HTMLElement;
        if (textSpan) {
            onRenameClick(container, textSpan, groupName);
        }
    });

    // ─────────────────────────────────────────────────────────────────
    // Drag handle (for group reordering)
    // ─────────────────────────────────────────────────────────────────

    if (useManualOrder && hasGroups) {
        const dragHandle = document.createElement('span');
        dragHandle.className = 'workspace-group-drag-handle';
        // Absolutely position handle - aligned with workspace handles
        dragHandle.style.position       = 'absolute';
        dragHandle.style.left           = '5px';
        dragHandle.style.top            = '50%';
        dragHandle.style.transform      = 'translateY(-50%)';
        dragHandle.style.display        = 'flex';
        dragHandle.style.alignItems     = 'center';
        dragHandle.style.justifyContent = 'center';
        dragHandle.style.width          = '20px';
        dragHandle.style.height         = '20px';
        setIcon(dragHandle, 'grip-vertical');

        if (isNoGroup) {
            // Greyed out placeholder for visual balance - not functional
            dragHandle.style.opacity = '0.15';
            dragHandle.style.cursor  = 'default';
        } else if (onDragStart) {
            // Functional handle for named groups
            dragHandle.style.opacity = '0.3';
            dragHandle.setAttribute('aria-label', 'Drag to reorder group');

            dragHandle.addEventListener('mousedown', (evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                onDragStart(evt, groupName, container);
            });

            dragHandle.addEventListener('mouseenter', () => { dragHandle.style.opacity = '0.8'; });
            dragHandle.addEventListener('mouseleave', () => { dragHandle.style.opacity = '0.3'; });
        }

        container.appendChild(dragHandle);

        // Also allow dragging from entire header (since handle is hidden via CSS)
        // Both named groups and "No Group" can be reordered
        if (onDragStart) {
            container.addEventListener('mousedown', (evt) => {
                // Only start drag on left click, not on buttons/icons
                if (evt.button !== 0) return;
                const target = evt.target as HTMLElement;
                if (target.closest('.workspace-group-chevron') ||
                    target.closest('.workspace-group-edit-btn')) return;

                evt.preventDefault();
                onDragStart(evt, groupName, container);
            });
        }
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
    chevron.setAttribute('aria-label', isCollapsed ? 'Expand group' : 'Collapse group');
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
    iconSpan.className            = 'workspace-group-icon';
    iconSpan.style.display        = 'inline-flex';
    iconSpan.style.alignItems     = 'center';
    iconSpan.style.justifyContent = 'center';
    iconSpan.style.width          = '24px';
    // No marginRight - flex gap handles spacing

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

    // Theme-proof icon SVG size
    const svg = iconSpan.querySelector('svg');
    if (svg) {
        (svg as SVGElement).style.width  = '16px';
        (svg as SVGElement).style.height = '16px';
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

    // Apply group text styling
    const styleKey   = isNoGroup ? NO_GROUP_KEY : groupName;
    const groupColor = workspaceManager.getGroupColor(styleKey);
    const groupBold  = workspaceManager.getGroupBold(styleKey);
    const groupItalic = workspaceManager.getGroupItalic(styleKey);

    if (groupColor) {
        textSpan.style.color = groupColor;
    }
    if (groupBold) {
        textSpan.style.fontWeight = 'bold';
    }
    if (groupItalic) {
        textSpan.style.fontStyle = 'italic';
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
        countSpan.style.color      = 'var(--text-faint)';
        countSpan.style.marginLeft = '5px';
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
    // Edit button (pencil - opens full editor modal)
    // ─────────────────────────────────────────────────────────────────

    const editBtn = document.createElement('span');
    editBtn.className = 'workspace-group-edit-btn workspace-group-rename-btn';
    Object.assign(editBtn.style, buttonBaseStyle);
    editBtn.style.right = '32px';
    editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M12.9 6.858l4.242 4.243L7.242 21H3v-4.243l9.9-9.9zm1.414-1.414l2.121-2.122a1 1 0 0 1 1.414 0l2.829 2.829a1 1 0 0 1 0 1.414l-2.122 2.121-4.242-4.242z"/></svg>`;
    editBtn.setAttribute('aria-label', isNoGroup ? 'Edit ungrouped settings' : 'Edit group');
    editBtn.addEventListener('click', (evt) => {
        evt.stopPropagation();
        onEditClick(groupName);
    });
    editBtn.addEventListener('mouseenter', () => { editBtn.style.fill = 'var(--text-accent-hover)'; });
    editBtn.addEventListener('mouseleave', () => { editBtn.style.fill = 'var(--text-muted)'; });
    container.appendChild(editBtn);

    // ─────────────────────────────────────────────────────────────────
    // Delete button (trash)
    // ─────────────────────────────────────────────────────────────────

    const deleteBtn = document.createElement('span');
    deleteBtn.className = 'workspace-group-edit-btn workspace-group-delete-btn';
    Object.assign(deleteBtn.style, buttonBaseStyle);
    deleteBtn.style.right = '11px';
    deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M7 4V2h10v2h5v2h-2v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6H2V4h5zM6 6v14h12V6H6zm3 3h2v8H9V9zm4 0h2v8h-2V9z"/></svg>`;

    if (isNoGroup) {
        // Grayed-out placeholder for alignment
        deleteBtn.style.opacity = '0.25';
        deleteBtn.style.cursor  = 'default';
    } else {
        deleteBtn.setAttribute('aria-label', 'Delete group (ungroup workspaces)');
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
