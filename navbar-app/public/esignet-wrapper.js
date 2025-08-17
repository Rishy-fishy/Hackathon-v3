// e-Signet Custom Element Wrapper
// This script loads the e-Signet plugin and registers it as a custom element

class SignInWithEsignetElement extends HTMLElement {
    constructor() {
        super();
        this.initialized = false;
    }

    connectedCallback() {
        if (this.initialized) return;
        this.initialized = true;

        // Wait for the SignInWithEsignetButton to be available
        this.waitForEsignetPlugin().then(() => {
            this.renderButton();
        }).catch((error) => {
            console.error('Failed to initialize e-Signet button:', error);
            this.innerHTML = '<p style="color: red;">Failed to load e-Signet button</p>';
        });
    }

    async waitForEsignetPlugin() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 40; // 20 seconds total
            
            const checkPlugin = () => {
                attempts++;
                
                if (window.SignInWithEsignetButton && window.SignInWithEsignetButton.init) {
                    console.log('✅ SignInWithEsignetButton found!');
                    resolve();
                } else if (attempts >= maxAttempts) {
                    console.error('❌ SignInWithEsignetButton not found after 20 seconds');
                    reject(new Error('SignInWithEsignetButton plugin not available'));
                } else {
                    console.log(`⏳ Waiting for SignInWithEsignetButton... attempt ${attempts}/${maxAttempts}`);
                    setTimeout(checkPlugin, 500);
                }
            };
            
            checkPlugin();
        });
    }

    async renderButton() {
        try {
            // Parse configuration from attributes
            const oidcConfig = this.getAttribute('oidc-config') 
                ? JSON.parse(this.getAttribute('oidc-config')) 
                : {};
            
            const buttonConfig = this.getAttribute('button-config') 
                ? JSON.parse(this.getAttribute('button-config')) 
                : {};

            console.log('Rendering e-Signet button with config:', { oidcConfig, buttonConfig });

            // Create container div
            const container = document.createElement('div');
            this.innerHTML = '';
            this.appendChild(container);

            // Initialize the e-Signet button using the plugin's init function
            await window.SignInWithEsignetButton.init({
                oidcConfig: oidcConfig,
                buttonConfig: buttonConfig,
                signInElement: container
            });

            console.log('✅ e-Signet button rendered successfully');
        } catch (error) {
            console.error('Error rendering e-Signet button:', error);
            this.innerHTML = '<p style="color: red;">Error rendering e-Signet button: ' + error.message + '</p>';
        }
    }

    // Handle attribute changes
    attributeChangedCallback(name, oldValue, newValue) {
        if (this.initialized && oldValue !== newValue) {
            this.renderButton();
        }
    }

    static get observedAttributes() {
        return ['oidc-config', 'button-config'];
    }
}

// Register the custom element
if (!customElements.get('sign-in-with-esignet')) {
    customElements.define('sign-in-with-esignet', SignInWithEsignetElement);
    console.log('✅ sign-in-with-esignet custom element registered');
} else {
    console.log('ℹ️ sign-in-with-esignet already registered');
}
