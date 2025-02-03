import { Navigate, Outlet } from "react-router-dom";

const ProtectedRoute = () => {
    const token = sessionStorage.getItem("token");

    if (!token) {
        console.log("No hay token, redirigiendo al login");
        return <Navigate to="/admin" replace />;
    }

    try {
        // Decodificar el token
        const tokenData = JSON.parse(atob(token.split(".")[1]));
        const exp = tokenData.exp * 1000;
        const now = Date.now();

        console.log("Verificando acceso. Token expira en:", new Date(exp).toLocaleString());

        if (now >= exp) {
        console.log("Token expirado, redirigiendo al login");
        sessionStorage.removeItem("token"); // Elimina el token expirado
        return <Navigate to="/admin" replace />;
        }

        return <Outlet />;
    } catch (error) {
        console.error("Error al decodificar el token:", error);
        sessionStorage.removeItem("token"); // Elimina si hay error en la decodificación
        return <Navigate to="/admin" replace />;
    }
};

export default ProtectedRoute;