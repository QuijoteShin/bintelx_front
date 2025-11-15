/* src/apps/_auth/register/index.js */
import { devlog } from '../../../bnx/utils.js';
import '../../../bnx/components/stepper/Stepper';

export default async function(container, data) {
    const stepper = container.querySelector('#register-stepper');
    const prevBtn = container.querySelector('#prev-btn');
    const nextBtn = container.querySelector('#next-btn');
    const skipBtn = container.querySelector('#skip-btn');
    const indicator = container.querySelector('#step-indicator');
    const resultEl = container.querySelector('#register-result');
    const backToLoginLink = container.querySelector('#back-to-login');

    if (!stepper) {
        console.error('Stepper element not found!');
        return;
    }

    // Wait for the component to be fully initialized
    await stepper.ready;

    // Configure the stepper with both steps
    stepper.setSteps([
        {
            id: 'step_register',
            templatePath: '_auth/register/step1.tpls',
            scriptPath: '_auth/register/step1.js',
        },
        {
            id: 'step_profile',
            templatePath: '_auth/register/step2.tpls',
            scriptPath: '_auth/register/step2.js',
        }
    ]);

    // --- Event Listeners ---
    stepper.addEventListener('stepChange', ({ detail }) => {
        devlog(`Step changed to: ${detail.id} (index ${detail.index})`);
        resultEl.textContent = '';
        resultEl.style.color = '';
        indicator.textContent = `Paso ${detail.index + 1} de ${stepper._steps.length}`;
        prevBtn.disabled = detail.index === 0;

        // Show skip button only on step 2 (profile creation)
        if (detail.index === 1) {
            skipBtn.style.display = 'inline-block';
            nextBtn.textContent = 'Completar';
        } else {
            skipBtn.style.display = 'none';
            nextBtn.textContent = 'Siguiente';
        }
    });

    stepper.addEventListener('flowComplete', async ({ detail }) => {
        devlog('Registration flow complete, data:', detail.data);

        // At this point, step 1 is already complete (user registered)
        // Step 2 is also complete (profile created)
        resultEl.textContent = '\u00a1Registro completado exitosamente! Redirigiendo...';
        resultEl.style.color = 'green';
        nextBtn.disabled = true;
        prevBtn.disabled = true;
        skipBtn.disabled = true;

        // Redirect to login or call onSuccess callback after a brief delay
        setTimeout(() => {
            if (data && typeof data.onSuccess === 'function') {
                // If provided, call success callback with the token from step 1
                data.onSuccess(detail.data.token);
            } else {
                // Otherwise, reload to show login
                window.location.reload();
            }
        }, 1500);
    });

    stepper.addEventListener('flowCancel', () => {
        devlog('Registration flow cancelled.');
        resultEl.textContent = 'El proceso de registro fue cancelado.';
        resultEl.style.color = 'orange';
    });

    // --- Button Connections ---
    prevBtn.addEventListener('click', () => {
        stepper.prev();
    });

    nextBtn.addEventListener('click', async () => {
        const stepElement = stepper._stepElements[stepper._currentStepIndex];

        // Perform validation if the step's script exposed a 'validate' function
        if (typeof stepElement?.validate === 'function' && !stepElement.validate()) {
            return; // Stop if validation fails
        }

        // For step 1, we need to submit the registration before moving forward
        if (stepper._currentStepIndex === 0 && typeof stepElement?.submitRegistration === 'function') {
            try {
                nextBtn.disabled = true;
                nextBtn.textContent = 'Registrando...';

                const currentStepId = stepper._steps[0].id;
                console.log('[DEBUG] Step data before submit:', stepper._stepData[currentStepId]);

                const registrationResult = await stepElement.submitRegistration(stepper._stepData[currentStepId] || {});

                console.log('[DEBUG] Registration result:', registrationResult);
                console.log('[DEBUG] Has accountId?', !!registrationResult?.accountId);

                if (registrationResult && registrationResult.accountId) {
                    console.log('[DEBUG] Storing accountId and token, then calling next()');
                    // Store the accountId and token at the root level for step 2 to access
                    stepper._stepData.accountId = registrationResult.accountId;
                    stepper._stepData.token = registrationResult.token;
                    stepper.next();
                } else {
                    console.error('[DEBUG] No accountId in result, not advancing to step 2');
                }

                nextBtn.disabled = false;
                nextBtn.textContent = 'Siguiente';
            } catch (error) {
                console.error('Registration failed:', error);
                nextBtn.disabled = false;
                nextBtn.textContent = 'Siguiente';
                return;
            }
        } else if (stepper._currentStepIndex === 1 && typeof stepElement?.submitProfile === 'function') {
            // For step 2, submit the profile
            try {
                console.log('[DEBUG] Step 2: Submitting profile...');
                nextBtn.disabled = true;
                nextBtn.textContent = 'Creando perfil...';

                const currentStepId = stepper._steps[1].id;
                const profileData = {
                    ...(stepper._stepData[currentStepId] || {}),
                    accountId: stepper._stepData.accountId
                };

                console.log('[DEBUG] Profile data to submit:', profileData);
                await stepElement.submitProfile(profileData);
                console.log('[DEBUG] Profile submitted successfully');

                // Profile created successfully, trigger flowComplete
                resultEl.textContent = '\u00a1Registro y perfil completados exitosamente! Redirigiendo...';
                resultEl.style.color = 'green';
                prevBtn.disabled = true;
                skipBtn.disabled = true;

                setTimeout(() => {
                    if (data && typeof data.onSuccess === 'function') {
                        data.onSuccess(stepper._stepData.token);
                    } else {
                        window.location.reload();
                    }
                }, 1500);

            } catch (error) {
                console.error('Profile creation failed:', error);
                nextBtn.disabled = false;
                nextBtn.textContent = 'Completar';
                return;
            }
        } else {
            stepper.next();
        }
    });

    // Skip button handler (only visible on step 2)
    skipBtn.addEventListener('click', () => {
        devlog('User skipped profile creation');
        resultEl.textContent = 'Registro completado sin perfil. Redirigiendo...';
        resultEl.style.color = 'green';

        setTimeout(() => {
            if (data && typeof data.onSuccess === 'function') {
                // Call success callback with the token from step 1
                data.onSuccess(stepper._stepData.token);
            } else {
                window.location.reload();
            }
        }, 1500);
    });

    // Back to login link
    backToLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (data && typeof data.onCancel === 'function') {
            data.onCancel();
        } else {
            window.location.reload();
        }
    });
}
