// /bintelx_front/src/bnx/components/collapsible-item/CollapsibleItem.js

export class CollapsibleItem {
    /**
     * @param {HTMLDetailsElement} detailsElement - The <details> element from the DOM.
     */
    constructor(detailsElement) {
        if (!detailsElement || detailsElement.tagName !== 'DETAILS') {
            throw new Error('A valid <details> element is required.');
        }
        this.details = detailsElement;

        // Bind event listener method for easy add/remove
        this.handleToggle = this.handleToggle.bind(this);

        // Add event listener for the native 'toggle' event
        this.details.addEventListener('toggle', this.handleToggle);
    }

    /**
     * Opens the collapsible item.
     */
    open() {
        this.details.open = true;
    }

    /**
     * Closes the collapsible item.
     */
    close() {
        this.details.open = false;
    }

    /**
     * Toggles the collapsible item's state.
     */
    toggle() {
        this.details.open = !this.details.open;
    }

    /**
     * Handles the 'toggle' event on the <details> element.
     */
    handleToggle() {
        // For future enhancements, custom events can be dispatched here.
        // e.g., this.details.dispatchEvent(new CustomEvent('custom-open', { bubbles: true }));
        // For now, we can log the state or do nothing.
        console.log(`CollapsibleItem with id '${this.details.id || "unknown"}' toggled. New state: ${this.details.open ? 'open' : 'closed'}`);
    }

    /**
     * Removes event listeners to prevent memory leaks if the component is destroyed.
     */
    destroy() {
        this.details.removeEventListener('toggle', this.handleToggle);
    }
}
