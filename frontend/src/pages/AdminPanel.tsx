import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

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
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const navigate = useNavigate();

    // Verificar si el usuario está autenticado
    useEffect(() => {
        const token = sessionStorage.getItem("token");
        if (!token) {
            navigate("/admin"); // Redirigir al login si no hay token
        }
    }, [navigate]);

    // Obtener la lista de servicios
    useEffect(() => {
        const fetchServicios = async () => {
            const response = await fetch("http://localhost:3000/servicios");
            const data = await response.json();
            if (data.status === "success") {
                setServicios(data.data);
            }
        };
        fetchServicios();
    }, []);

    // Función para manejar la selección de archivos
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            setSelectedFile(event.target.files[0]);
        }
    };

    // Función para subir la imagen al servidor
    const handleUpload = async () => {
        if (!selectedService || !selectedFile) return;

        const token = sessionStorage.getItem("token");
        const formData = new FormData();
        formData.append("imagen", selectedFile);

        try {
            const response = await axios.put(
                `http://localhost:3000/servicios/${selectedService}/imagenes`,
                formData,
                {
                    headers: {
                        "Content-Type": "multipart/form-data",
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (response.data.status === "success") {
                alert("Imagen subida correctamente");
                setSelectedFile(null);
            } else {
                alert("Error al subir la imagen");
            }
        } catch (error) {
            console.error("Error al subir la imagen:", error);
            alert("Ocurrió un error al subir la imagen");
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

            <label className="block text-lg font-medium">Subir imagen:</label>
            <input
                type="file"
                accept="image/*"
                className="border p-2 rounded-md mb-4 w-full"
                onChange={handleFileChange}
            />

            <button
                onClick={handleUpload}
                className="bg-blue-500 text-white p-2 rounded-md w-full"
            >
                Subir Imagen
            </button>
        </div>
    );
};

export default AdminPanel;
