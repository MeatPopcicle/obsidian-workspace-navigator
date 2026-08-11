// ═══════════════════════════════════════════════════════════════════════════════
// GROUP HEADER RENDERING UTILITY
// Used by the WorkspaceSwitcherModal (status-bar switcher)
// ═══════════════════════════════════════════════════════════════════════════════

import { setIcon } from 'obsidian';
import { WorkspaceManager } from './workspace-manager';

// ───────────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────────

export interface GroupHeaderConfig {
    groupName:       string;
    isCollapsed:     boolean;
    isEmpty?:        boolean;  // Group has no workspaces - render as a standalone card
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
        isEmpty,
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

    // Static styling lives in styles.css (.wn-group-header-card);
    // only genuinely dynamic values (user-chosen colors) are set inline.
    container.addClass('wn-group-header-card');
    if (isCollapsed || isEmpty) {
        // Collapsed, or expanded-but-empty: header is the whole card, so round
        // all corners and keep the bottom border (no workspace row follows it).
        container.addClass('is-standalone');
    }

    // Store group name on container for drop handling
    container.dataset.groupName = groupName;

    // Right-click triggers quick inline rename
    container.addEventListener('contextmenu', (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        const textSpan = container.querySelector('.wn-group-text') as HTMLElement;
        if (textSpan) {
            onRenameClick(container, textSpan, groupName);
        }
    });

    // ─────────────────────────────────────────────────────────────────
    // Drag handle (for group reordering)
    // ─────────────────────────────────────────────────────────────────

    if (useManualOrder && hasGroups) {
        const dragHandle = document.createElement('span');
        dragHandle.className = 'wn-group-drag-handle';
        setIcon(dragHandle, 'grip-vertical');

        if (!isNoGroup && onDragStart) {
            dragHandle.setAttribute('aria-label', 'Drag to reorder group');
            dragHandle.addEventListener('mousedown', (evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                onDragStart(evt, groupName, container);
            });
        }

        container.appendChild(dragHandle);

        // Also allow dragging from entire header (since handle is hidden via CSS)
        // Both named groups and "No Group" can be reordered
        if (onDragStart) {
            container.addEventListener('mousedown', (evt) => {
                // Only start drag on left click, not on buttons/icons
                if (evt.button !== 0) return;
                const target = evt.target as HTMLElement;
                if (target.closest('.wn-group-chevron') ||
                    target.closest('.wn-group-edit-btn')) return;

                evt.preventDefault();
                onDragStart(evt, groupName, container);
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // Collapse/expand chevron
    // ─────────────────────────────────────────────────────────────────

    const chevron = document.createElement('span');
    chevron.className = 'wn-group-chevron';
    setIcon(chevron, isCollapsed ? 'chevron-right' : 'chevron-down');
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
    iconSpan.className = 'wn-group-icon';

    if (groupIcon) {
        setIcon(iconSpan, groupIcon);
        const iconColor = isNoGroup
            ? workspaceManager.getGroupIconColor(NO_GROUP_KEY)
            : workspaceManager.getGroupIconColor(groupName);
        if (iconColor) {
            iconSpan.style.color = iconColor;  // user-chosen color: genuinely dynamic
        }
    } else {
        // Default icon for groups without a custom icon
        setIcon(iconSpan, 'folder');
        iconSpan.addClass('is-default');
    }
    container.appendChild(iconSpan);

    // ─────────────────────────────────────────────────────────────────
    // Group name text
    // ─────────────────────────────────────────────────────────────────

    const textSpan = document.createElement('span');
    textSpan.className   = 'wn-group-text';
    textSpan.textContent = displayName;
    textSpan.dataset.groupName = groupName;

    // Apply group text styling (user-chosen: genuinely dynamic)
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
        countSpan.className   = 'wn-group-count';
        countSpan.textContent = `(${count})`;
        container.appendChild(countSpan);
    }

    // ─────────────────────────────────────────────────────────────────
    // Edit button (pencil - opens full editor modal)
    // ─────────────────────────────────────────────────────────────────

    const editBtn = document.createElement('span');
    editBtn.className = 'wn-group-edit-btn wn-group-rename-btn';
    setIcon(editBtn, 'pencil');
    editBtn.setAttribute('aria-label', isNoGroup ? 'Edit ungrouped settings' : 'Edit group');
    editBtn.addEventListener('click', (evt) => {
        evt.stopPropagation();
        onEditClick(groupName);
    });
    container.appendChild(editBtn);

    // ─────────────────────────────────────────────────────────────────
    // Delete button (trash)
    // ─────────────────────────────────────────────────────────────────

    const deleteBtn = document.createElement('span');
    deleteBtn.className = 'wn-group-edit-btn wn-group-delete-btn';
    setIcon(deleteBtn, 'trash-2');

    if (isNoGroup) {
        // Grayed-out placeholder for alignment
        deleteBtn.addClass('wn-group-edit-btn-disabled');
    } else {
        deleteBtn.setAttribute('aria-label', 'Delete group (ungroup workspaces)');
        deleteBtn.addEventListener('click', (evt) => {
            evt.stopPropagation();
            onDeleteClick(groupName);
        });
    }
    container.appendChild(deleteBtn);
}

// ───────────────────────────────────────────────────────────────────────────────
// Helpers for drag state (class-driven; rules live in styles.css)
// ───────────────────────────────────────────────────────────────────────────────

export function setGroupDropTarget(container: HTMLElement, position: 'above' | 'below' | 'none'): void {
    container.removeClass('drop-target-above', 'drop-target-below');
    if (position === 'above') {
        container.addClass('drop-target-above');
    } else if (position === 'below') {
        container.addClass('drop-target-below');
    }
}

export function setGroupDragging(container: HTMLElement, isDragging: boolean): void {
    container.toggleClass('is-dragging', isDragging);
}
