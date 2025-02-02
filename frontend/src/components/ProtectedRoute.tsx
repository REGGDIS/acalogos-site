import { Navigate, Outlet } from "react-router-dom";

const ProtectedRoute = () => {
    const token = sessionStorage.getItem("token");

    console.log("Verificando acceso a ruta protegida. Token:", token);

    // Si no hay token, redirigir al login
    return token ? <Outlet /> : <Navigate to="/admin" replace />
};

export default ProtectedRoute;