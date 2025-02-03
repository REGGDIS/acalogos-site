import { Navigate, Outlet } from "react-router-dom";

const ProtectedRoute = () => {
    const token = sessionStorage.getItem("token");

    if (!token) {
        console.log("🔴 No hay token, redirigiendo al login...");
        return <Navigate to="/admin" replace />;
    }

    try {
        // Decodificar el token sin necesidad de una librería externa
        const tokenData = JSON.parse(atob(token.split(".")[1]));
        const exp = tokenData.exp * 1000; // Convertir a milisegundos
        const now = Date.now();

        console.log(`🔍 Verificando acceso. Token expira en: ${new Date(exp).toLocaleString()}`);

        if (now >= exp) {
            console.log("❌ Token expirado, cerrando sesión...");
            sessionStorage.removeItem("token"); // Eliminar el token
            return <Navigate to="/admin" replace />;
        }
    } catch (error) {
        console.error("❌ Error al procesar el token:", error);
        sessionStorage.removeItem("token");
        return <Navigate to="/admin" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
