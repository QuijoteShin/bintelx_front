/* src/bnx/components/stepper/Stepper.js */
import './stepper.css';
import template from './stepper.tpls';
import {loadContentIntoElement} from "../../loader"; // Synchronous import via Webpack's raw-loader

class Stepper extends HTMLElement {
    constructor() {
        super();
        this._shadowRoot = this.attachShadow({ mode: 'open' });
        this._shadowRoot.innerHTML = template;

        // Initialize internal state
        this._currentStepIndex = -1;
        this._isTransitioning = false;
        this._steps = [];
        this._stepData = {};
        this._stepElements = []; 
        this._componentPrefix = '';

        // A promise that resolves when connectedCallback has finished setup.
        this.ready = new Promise(resolve => (this._resolveReady = resolve));
    }

    connectedCallback() {
        // Now it's safe to get references to internal elements.
        this.stepContainer = this._shadowRoot.getElementById('step-container');
        
        // Assign a unique ID and prefix for this instance.
        this.id = this.id || `bnx-stepper-${Math.random().toString(36).substr(2, 9)}`;
        this._componentPrefix = this.getAttribute('prefix') || this.id;


        // Add the component-specific styles to the shadow DOM.
        const styleSheet = document.createElement('link');
        styleSheet.setAttribute('rel', 'stylesheet');
        // NOTE: The path must be absolute from the project root for Webpack Dev Server.
        // styleSheet.setAttribute('href', './src/bnx/components/stepper/stepper.css');
        this._shadowRoot.appendChild(styleSheet);

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
            newStepElement.id = `${this._componentPrefix}-step-${stepId}`;
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