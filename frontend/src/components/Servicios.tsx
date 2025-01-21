import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Definición de la interfaz para el tipo de datos de un servicio
interface Servicio {
    id: number;
    nombre: string;
    descripcion: string;
    precio: string;
    imagen: string;
}

const Servicios: React.FC = () => {
    // Estado para almacenar los servicios, tipado con un arreglo de `Servicio`
    const [servicios, setServicios] = useState<Servicio[]>([]);
    // Estado para manejar errores, tipado como una cadena o nulo
    const [error, setError] = useState<string | null>(null);

    // useEffect para hacer la solicitud al backend cuando el componente se monta
    useEffect(() => {
        // Hacer la solicitud al backend para obtener los servicios
        axios
            .get('http://localhost:3000/servicios')
            .then(response => {
                // Guardar los datos de la respuesta en el estado
                setServicios(response.data.data);
            })
            .catch(error => {
                // Manejo de errores en caso de que falle la solicitud
                setError('Hubo un problema al obtener los servicios.');
                console.error(error);
            });
    }, []); // El array vacío asegura que solo se ejecute una vez cuando el componente se monta

    return (
        <section id="servicios" className="py-16 bg-gray-100">
            <div className="max-w-7xl mx-auto px-6 text-center">
                <h2 className="text-3xl font-bold mb-8">Nuestros Servicios</h2>
                {error && <p className="text-red-500">{error}</p>}
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {servicios.map((servicio) => (
                        <div
                            key={servicio.id}
                            className="bg-white shadow-md rounded-lg overflow-hidden"
                        >
                            <img
                                src={servicio.imagen}
                                alt={servicio.nombre}
                                className="w-full h-48 object-cover"
                            />
                            <div className="p-6">
                                <h3 className="text-xl font-semibold mb-2">{servicio.nombre}</h3>
                                <p className="text-gray-600 mb-4">{servicio.descripcion}</p>
                                <p className="font-bold text-yellow-500">{servicio.precio}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Servicios;