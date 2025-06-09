import { startRegistration,startAuthentication} from 'https://cdn.skypack.dev/@simplewebauthn/browser';
document.addEventListener('DOMContentLoaded', function () {
    const container = document.querySelector('.container');
    const LoginLink = document.querySelector('.SignInLink');
    const RegisterLink = document.querySelector('.SignUpLink');
    const signUpBtn = document.getElementById('signUpBtn');
    const signInBtn = document.getElementById('signInBtn');

    // Switch to Register form when "Sign Up" link is clicked
    if (RegisterLink) {
        RegisterLink.addEventListener("click", (e) => {
            e.preventDefault();
            console.log('Register link clicked');
            container.classList.add('active');
        });
    }

    // Switch to Login form when "Sign In" link is clicked
    if (LoginLink) {
        LoginLink.addEventListener("click", (e) => {
            e.preventDefault();
            console.log('Login link clicked');
            container.classList.remove('active');
        });
    }
    // Get-started button at login page functionality
    if (signUpBtn) {
        signUpBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            console.log('Sign Up button clicked');
            
            const res = await fetch('/get-started', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'get-started'
                })
            });
            const data = await res.json();
            if (data.verified) {
                showFlashMessage('success', data.message, '/get-started');
                return;
            } else {
                showFlashMessage('error', data.message, '/');
                return;
            }
        });
    }

    // Switch to Login form when "Get Started" button is clicked from Register page
    if (signInBtn) {
        signInBtn.addEventListener("click", (e) => {
            e.preventDefault();
            console.log('Sign In button clicked');
            container.classList.remove('active');
        });
    }

    // Form submission handlers
    const loginForm = document.querySelector('.login-form');
    const registerForm = document.querySelector('.register-form');

    // Flash message function
    function showFlashMessage(type, message, redirectUrl = null, delay = 2000) {
        // Reset all flash messages first
        const allMessages = document.querySelectorAll('.flash-msg');
        allMessages.forEach(msg => {
            msg.classList.remove('act');
            msg.innerHTML = "";
        });

        // Show the specific message
        const messageElement = document.querySelector(`.flash-msg.${type}`);
        if (messageElement) {
            messageElement.classList.add('act');
            messageElement.innerHTML = message;
            
            setTimeout(() => {
                messageElement.classList.remove('act');
                messageElement.innerHTML = "";
                if (redirectUrl) {
                    window.location.href = redirectUrl;
                }
            }, delay);
        }
    }
    // Register form submission handler
    // This function will be called when the user submits the registration form
    // It will validate the input, send a request to the server to create a challenge, and then handle the response
    // If the response is successful, it will show a success message and redirect the user
    // If the response is unsuccessful, it will show an error message
    if (registerForm) { 
        registerForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            console.log('Register form submitted');

            const name = document.getElementById('name-r').value;
            const username = document.getElementById('username-r').value;
            const email = document.getElementById('email-r').value;
            const password = document.getElementById('password-r').value;
            const regex_pass = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%#?&^-])[A-Za-z\d@$!%#?&^-]{5,}$/;
            const regex_user = /^(?=.*[A-Za-z])(?:[A-Za-z\d]{5,})$/;

            if (!regex_pass.test(password) && regex_user.test(username)) {
                showFlashMessage('warning', 'Password must be at least 5 characters long and contain at least one letter, number, and special character.', '/');
                return;
            }
            else if (!regex_user.test(username) && regex_pass.test(password)) {
                showFlashMessage('warning', 'Username must be at least 5 characters long and contain only letters and numbers.', '/');
                return;
            }
            else if (!regex_pass.test(password) && !regex_user.test(username)) {
                showFlashMessage('warning', 'Username must be at least 5 characters long and contain only letters and numbers. Password must be at least 5 characters long and contain at least one letter, number, and special character.', '/');
                return;
            }
            const response = await fetch('/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    username: username,
                    email: email,
                    password: password
                })
            });
            const options = await response.json();
            if (!options.verified) {
                showFlashMessage('error', options.message, '/');
                return;
            }
            const challengePayload = options.option // From the server created challenge
            const authenticationResult = await startRegistration(challengePayload);// This is the credential that the user will create in the browser
            
            const r = await fetch('/register/credential', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    credential: authenticationResult,
                    userId: options.id // User ID from the server
                })
            });

            const result = await r.json();
            if (result.verified) {
                showFlashMessage('success', result.message, '/');
                return;
            } else {
                showFlashMessage('error', result.message, '/');
                return;
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            console.log('Login form submitted');
            const login_email = document.getElementById('email-l').value;
            const login_pass = document.getElementById('password-l').value;

            const r = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: login_email,
                    password: login_pass
                })
            });
            const options_auth = await r.json();
            if(!options_auth.verified)
            {
                showFlashMessage('error', options_auth.message, '/');
                return;
            }
            const challengePayload = options_auth.option; // From the server created challenge
            const credential_auth = await startAuthentication(challengePayload); // This is the credential that the user will create in the browser
            
            const r_auth = await fetch('/login/credential', {
                method : 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    credential: credential_auth,
                    userId: options_auth.id 
                })
            });
            const result_auth = await r_auth.json();
            if(result_auth.verified)
            {
                showFlashMessage('success', result_auth.message, '/get-started');
                return;
            }
            else
            {
                showFlashMessage('error', result_auth.message, '/');
                return;
            }
        });
    }
});
