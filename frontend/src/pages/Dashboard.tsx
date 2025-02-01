import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
    const navigate = useNavigate();
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/admin"); // Redirigir si no hay sesión
        } else {
            setIsAuthenticated(true);
        }
    }, [navigate]);

    return isAuthenticated ? (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold">Panel de Control</h1>
            <p>Aquí podrás gestionar imágenes y servicios.</p>
        </div>
    ) : null;
};

export default Dashboard;