// src/bnx/components/Modal.js
import './modal.css';

/**
 * Headless class to manage a native modal component (<dialog>).
 * Encapsulates the logic for opening, closing, and handling events.
 */
export class Modal {
    /**
     * @param {HTMLDialogElement} dialogElement - The <dialog> element from the DOM.
     */
    constructor(dialogElement) {
        if (!dialogElement || dialogElement.tagName !== 'DIALOG') {
            throw new Error('A valid <dialog> element is required.');
        }
        this.dialog = dialogElement;
        this.boundClose = this.close.bind(this);

        // Close when clicking on the backdrop
        this.dialog.addEventListener('click', (event) => {
            if (event.target === this.dialog) {
                this.close();
            }
        });
    }

    /**
     * Opens the modal.
     */
    open() {
        this.dialog.showModal();
        // Listen for the Escape key to close
        this.dialog.addEventListener('close', this.boundClose);
    }

    /**
     * Closes the modal.
     */
    close() {
        this.dialog.close();
        // Clean up the event listener to prevent memory leaks
        this.dialog.removeEventListener('close', this.boundClose);
    }
}
