document
    .getElementById("registerForm")
    .addEventListener("submit", async (e) => {
        e.preventDefault()
        const status = document.getElementById("form-status")
        const username = document.getElementById("username").value
        const password = document.getElementById("password").value
        const confirmPassword = document.getElementById("confirmPassword").value

        if (password !== confirmPassword) {
            status.textContent = "Passwords do not match. Please enter the same password twice."
            return
        }

        try {
            status.textContent = "Creating your account..."
            const response = await fetch("/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username, password }),
            })

            const result = await response.json()

            if (result.success) {
                window.location.href = "/login.html"
            } else {
                console.error(`[AUTH] Registration rejected for ${username}: ${result.message}`)
                status.textContent = result.message || "We could not create your account."
            }
        } catch (error) {
            console.error(`[AUTH] Registration request failed: ${error.message}`)
            status.textContent = "The server is unavailable. Please try again in a moment."
        }
    })
