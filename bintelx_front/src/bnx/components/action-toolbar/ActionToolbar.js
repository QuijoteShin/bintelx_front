// src/bnx/components/action-toolbar/ActionToolbar.js

import "./action-toolbar.css";

class ActionToolbar {
    /**
     * @param {HTMLElement} element The DOM element for the toolbar.
     */
    constructor(element) {
        if (!element) {
            throw new Error('A valid DOM element is required for ActionToolbar.');
        }
        this.element = element;
        this.isVisible = true;
    }

    /**
     * Shows the toolbar by removing the state class.
     */
    show() {
        this.element.classList.remove('is-hidden');
    }

    /**
     * Hides the toolbar by adding a state class.
     */
    hide() {
        this.element.classList.add('is-hidden');
    }

    /**
     * Toggles the visibility of the toolbar.
     */
    toggle() {
        this.element.classList.toggle('is-hidden');
    }

    /**
     * Checks if the toolbar is currently visible.
     * @returns {boolean}
     */
    isVisible() {
        // Visibility is determined by the absence of the 'is-hidden' class.
        return !this.element.classList.contains('is-hidden');
    }

}

export default ActionToolbar;