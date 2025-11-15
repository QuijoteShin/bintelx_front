/* src/bnx/components/stepper/Stepper.js */
import './stepper.css';
import template from './stepper.tpls';
import {loadContentIntoElement} from "../../loader"; // Synchronous import via Webpack's raw-loader
import { createComponentStyles } from '../../styles/globalStyles.js';

// Component-specific styles
const stepperStyles = `
.stepper-step {
    opacity: 1;
    transform: translateX(0);
    transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease-in-out;
    visibility: hidden;
}

.stepper-step.visible {
    visibility: visible;
}

.stepper-step.slide-from-right {
    transform: translateX(100%);
}
.stepper-step.slide-from-left {
    transform: translateX(-100%);
}

.stepper-step.slide-to-left {
    transform: translateX(-100%);
    opacity: 0;
}
.stepper-step.slide-to-right {
    transform: translateX(100%);
    opacity: 0;
}
`;

class Stepper extends HTMLElement {
    constructor() {
        super();
        this._useShadow = this.hasAttribute('use-shadow');
        if (this._useShadow) {
            this._renderRoot = this.attachShadow({ mode: 'open' });
            // Adopt global styles + component-specific styles
            this._renderRoot.adoptedStyleSheets = createComponentStyles(stepperStyles);
        } else {
            this._renderRoot = this; // Usar el propio elemento (Light DOM)
        }
        // Initialize internal state
        this._currentStepIndex = -1;
        this._isTransitioning = false;
        this._steps = [];
        this._stepData = {};
        this._stepElements = []; 
        this._prefix = '';
        //  resolves when connectedCallback has finished setup.
        this.ready = new Promise(resolve => (this._resolveReady = resolve));
    }

    connectedCallback() {
        this.stepContainer = this._renderRoot;
        // Assign a unique ID and prefix for this instance.
        this.id = this.id || `bnx-stepper-${Math.random().toString(36).substr(2, 9)}`;
        this._prefix = this.getAttribute('prefix') || this.id;

        console.log(`Stepper "${this.id}" connected and ready.`);
        this._resolveReady(); // Signal that the component is fully initialized.
    }

    async setSteps(stepsConfig = []) {
        await this.ready; // Wait for the component to be fully ready.
        this.stepContainer.innerHTML = ''; // Clear previous state
        this._steps = stepsConfig;
        this._stepElements = new Array(this._steps.length).fill(null);
        this._stepData = {};
        
        if (this._steps.length > 0) {
            this._currentStepIndex = 0;
            await this.loadStep(0, 'initial');
        }
    }

    unloadStep(stepIndex) {
        if (stepIndex < 0 || stepIndex >= this._steps.length) {
            console.error(`[Stepper] Cannot unload invalid step index: ${stepIndex}`);
            return;
        }
        const stepElement = this._stepElements[stepIndex];
        if (stepElement) {
            stepElement.remove();
            this._stepElements[stepIndex] = null;
        }
        const stepId = this._steps[stepIndex]?.id;
        if (stepId && this._stepData[stepId]) {
            delete this._stepData[stepId];
        }
    }

    async loadStep(index, direction) {
        if (this._isTransitioning && direction !== 'initial') return;
        if (index < 0 || index >= this._steps.length) return;

        this._isTransitioning = true;

        const oldStepIndex = this._currentStepIndex;
        const oldStepElement = this._stepElements[oldStepIndex];
        
        this._currentStepIndex = index;
        const stepConfig = this._steps[index];
        const stepId = stepConfig.id;

        // Create or retrieve step element from cache
        let newStepElement = this._stepElements[index];
        if (!newStepElement) {
            newStepElement = document.createElement('div');
            newStepElement.className = 'stepper-step';
            newStepElement.id = `${this._prefix}-step-${stepId}`;
            this._stepElements[index] = newStepElement;

            try {
                await loadContentIntoElement(
                    {
                        templatePath: `${stepConfig.templatePath}`,
                        scriptPath: `${stepConfig.scriptPath}`
                    },
                    newStepElement, // The target HTMLElement for content injection (the div for this step)
                    {
                        stepData: this._stepData[stepId] || {}, // Pass current step's data
                        updateStepDataCallback: (updatedData) => { // Callback for step to update its data in Stepper
                            this._stepData[stepId] = { ...this._stepData[stepId], ...updatedData };
                        }
                    }
                );
            } catch (e) {
                console.error(`[Stepper] Error loading step content via loadContentIntoElement for step ${stepId}:`, e);
                newStepElement.innerHTML = `<p style="color:red;">Failed to load step content.</p>`;
            }
            this.stepContainer.appendChild(newStepElement);
        }

        // --- Handle Transitions ---
        const transitionPromise = new Promise(resolve => {
            const onInTransitionEnd = (event) => {
                if (event.target === newStepElement) {
                    newStepElement.removeEventListener('transitionend', onInTransitionEnd);
                    resolve();
                }
            };
            newStepElement.addEventListener('transitionend', onInTransitionEnd);
            
            if (direction === 'initial') {
                newStepElement.classList.add('visible');
                return resolve();
            }

            // Prepare incoming step
            newStepElement.classList.add('visible');
            newStepElement.classList.add(direction === 'forward' ? 'slide-from-right' : 'slide-from-left');

            // Animate outgoing step
            if (oldStepElement && oldStepElement !== newStepElement) {
                oldStepElement.classList.add(direction === 'forward' ? 'slide-to-left' : 'slide-to-right');
                oldStepElement.classList.remove('visible');
            }
            
            // Trigger animation
            requestAnimationFrame(() => {
                newStepElement.classList.remove('slide-from-left', 'slide-from-right');
            });
            
            // Fallback timeout in case transitionend event doesn't fire
            setTimeout(resolve, 400); 
        });

        await transitionPromise;
        
        if(oldStepElement) {
            oldStepElement.classList.remove('slide-to-left', 'slide-to-right');
        }

        this._isTransitioning = false;
        this.dispatchEvent(new CustomEvent('stepChange', { detail: { index: this._currentStepIndex, id: stepId } }));
    }

    async next() {
        if (this._currentStepIndex >= this._steps.length - 1) {
            this.dispatchEvent(new CustomEvent('flowComplete', { detail: { data: this.getData() } }));
            return;
        }
        await this.loadStep(this._currentStepIndex + 1, 'forward');
    }

    async prev() {
        if (this._currentStepIndex <= 0) {
            this.dispatchEvent(new CustomEvent('flowCancel'));
            return;
        }
        await this.loadStep(this._currentStepIndex - 1, 'backward');
    }
    
    async goTo(index) {
        if(index === this._currentStepIndex) return;
        const direction = index > this._currentStepIndex ? 'forward' : 'backward';
        await this.loadStep(index, direction);
    }

    getData() {
        return { ...this._stepData };
    }
}

customElements.define('bnx-stepper', Stepper);