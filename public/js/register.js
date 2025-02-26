document
    .getElementById("registerForm")
    .addEventListener("submit", async (e) => {
        event.preventDefault()
        const username = document.getElementById("username").value
        const password = document.getElementById("password").value
        const confirmPassword = document.getElementById("confirmPassword").value

        if (password !== confirmPassword) {
            alert("Passwords do not match")
            return
        }

        try {
            // Send the data to the backend
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
                alert("Registration failed.")
            }
        } catch (error) {
            console.error("Error:", error)
            alert("There was an error with the registration process.")
        }
    })
