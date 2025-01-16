import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Definición de la interfaz para el tipo de datos de un servicio
interface Servicio {
    id: number;
    nombre: string;
    descripcion: string;
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
        <div>
            <h2>Servicios de Impresión</h2>

            {/* Mostrar error si hay uno */}
            {error && <p>{error}</p>}

            {/* Mostrar los servicios */}
            <ul>
                {servicios.map(servicio => (
                    <li key={servicio.id}>
                        <strong>{servicio.nombre}</strong>: {servicio.descripcion}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default Servicios;