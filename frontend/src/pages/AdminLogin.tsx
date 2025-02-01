import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const AdminLogin = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(""); // Limpiar errores previos

        try {
            const response = await fetch("http://localhost:3000/admin/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();
            if (response.ok) {
                localStorage.setItem("token", data.token); // Guardar token
                navigate("/dashboard"); // Redirigir al panel de control
            } else {
                setError(data.message || "Credenciales incorrectas");
            }
        } catch (error) {
            console.error("Error en la autenticación:", error);
            setError("error de conexión con el servidor");
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
            <form onSubmit={handleLogin} className="bg-white p-6 rounded shadow-md w-96">
                <h2 className="text-2xl font-bold mb-4 text-center">Panel de Administrador</h2>
                {error && <p className="text-red-500 text-center">{error}</p>}
                <input
                    type="email"
                    placeholder="Correo electrónico"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2 border rounded mb-3"
                    required
                />
                <input
                    type="password"
                    placeholder="Contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-2 border rounded mb-3"
                    required
                />
                <button type="submit" className="w-full bg-blue-500 text-white py-2 rounded">
                    Iniciar sesión
                </button>
            </form>
        </div>
    );
};

export default AdminLogin;