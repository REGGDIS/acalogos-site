import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// Definir la interfaz para los servicios
interface Servicio {
    id: number;
    nombre: string;
    descripcion: string;
    precio: string;
    categoria: string[];
    imagen: string;
    imagenes_adicionales: string[];
}

const AdminPanel = () => {
    const [servicios, setServicios] = useState<Servicio[]>([]);
    const [selectedService, setSelectedService] = useState<string | null>(null);
    const [newImage, setNewImage] = useState<string>("");
    const navigate = useNavigate();

    // Verificar si el usuario está autenticado
    useEffect(() => {
        const token = sessionStorage.getItem("token");

        if (!token) {
            console.log("🔴 No hay token, redirigiendo al login...");
            navigate("/admin");
            return;
        }

        try {
            // Decodificar el token y verificar expiración
            const tokenData = JSON.parse(atob(token.split(".")[1]));
            const exp = tokenData.exp * 1000; // Convertir a milisegundos
            const now = Date.now();

            if (now >= exp) {
                console.log("❌ Token expirado, cerrando sesión...");
                sessionStorage.removeItem("token");
                navigate("/admin");
                return;
            }
        } catch (error) {
            console.error("❌ Error al procesar el token:", error);
            sessionStorage.removeItem("token");
            navigate("/admin");
            return;
        }
    }, [navigate]);

    // Obtener la lista de servicios
    useEffect(() => {
        const fetchServicios = async () => {
            try {
                const response = await fetch("http://localhost:3000/servicios");
                const data = await response.json();
                if (data.status === "success") {
                    setServicios(data.data);
                } else {
                    console.error("⚠️ Error al obtener servicios:", data.message);
                }
            } catch (error) {
                console.error("⚠️ Error de conexión con el backend:", error);
            }
        };
        fetchServicios();
    }, []);

    // Función para agregar una imagen
    const handleAddImage = async () => {
        if (!selectedService || !newImage) return;

        const token = sessionStorage.getItem("token");
        if (!token) {
            alert("🔴 Sesión expirada. Inicia sesión nuevamente.");
            navigate("/admin");
            return;
        }

        const response = await fetch(`http://localhost:3000/servicios/${selectedService}/imagenes`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ imagen: newImage }),
        });

        const data = await response.json();
        if (data.status === "success") {
            alert("✅ Imagen añadida correctamente");
            setNewImage("");
        } else {
            alert("⚠️ Error al añadir la imagen: " + data.message);
        }
    };

    return (
        <div className="container mx-auto p-6">
            <h2 className="text-2xl font-bold mb-4">Panel de Administración</h2>

            <label className="block text-lg font-medium">Seleccionar servicio:</label>
            <select
                className="border p-2 rounded-md mb-4 w-full"
                onChange={(e) => setSelectedService(e.target.value)}
            >
                <option value="">Seleccione un servicio</option>
                {servicios.map((servicio) => (
                    <option key={servicio.id} value={servicio.id}>
                        {servicio.nombre}
                    </option>
                ))}
            </select>

            <label className="block text-lg font-medium">URL de la imagen:</label>
            <input
                type="text"
                className="border p-2 rounded-md mb-4 w-full"
                value={newImage}
                onChange={(e) => setNewImage(e.target.value)}
            />

            <button
                onClick={handleAddImage}
                className="bg-blue-500 text-white p-2 rounded-md w-full"
            >
                Agregar Imagen
            </button>
        </div>
    );
};

export default AdminPanel;
