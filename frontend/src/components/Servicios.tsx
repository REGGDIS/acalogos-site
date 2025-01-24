import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from 'react-modal';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

// Configuración del Modal para que se monte en el root
Modal.setAppElement('#root');

// Definición de la interfaz para el tipo de datos de un servicio
interface Servicio {
    id: number;
    nombre: string;
    descripcion: string;
    precio: string;
    imagen: string;
    imagenesAdicionales?: string[]; // Imágenes adicionales opcionales
}

const Servicios: React.FC = () => {
    const [servicios, setServicios] = useState<Servicio[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Estado para controlar el modal
    const [modalIsOpen, setModalIsOpen] = useState(false);
    const [currentServicio, setCurrentServicio] = useState<Servicio | null>(null);

    // Función para abrir el modal
    const openModal = (servicio: Servicio) => {
        setCurrentServicio(servicio);
        setModalIsOpen(true);
    };

    // Función para cerrar el modal
    const closeModal = () => {
        setModalIsOpen(false);
        setCurrentServicio(null);
    };

    useEffect(() => {
        axios
            .get('http://localhost:3000/servicios')
            .then((response) => {
                setServicios(response.data.data);
            })
            .catch((error) => {
                setError('Hubo un problema al obtener los servicios.');
                console.error(error);
            });
    }, []);

    return (
        <section id="servicios" className="py-16 bg-gray-100">
            <div className="max-w-7xl mx-auto px-6 text-center">
                <h2 className="text-3xl font-bold mb-8">Nuestros Servicios</h2>
                {error && <p className="text-red-500">{error}</p>}
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {servicios.map((servicio) => (
                        <div
                            key={servicio.id}
                            className="bg-white shadow-md rounded-lg overflow-hidden cursor-pointer"
                            onClick={() => openModal(servicio)}
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

            {/* Modal para mostrar imágenes adicionales */}
            <Modal
                isOpen={modalIsOpen}
                onRequestClose={closeModal}
                contentLabel="Detalles del servicio"
                className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-lg relative"
                overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
            >
                {currentServicio && (
                    <div>
                        <button
                            onClick={closeModal}
                            className="absolute top-4 right-4 text-gray-500 hover:text-black text-xl"
                        >
                            ✕
                        </button>
                        <h2 className="text-2xl font-bold mb-4">{currentServicio.nombre}</h2>
                        <p className="text-gray-600 mb-6">{currentServicio.descripcion}</p>
                        <Swiper
                            navigation
                            pagination={{ clickable: true }}
                            modules={[Navigation, Pagination]}
                            className="w-full h-80"
                        >
                            {/* Agregar las imágenes adicionales */}
                            {currentServicio.imagenesAdicionales?.map((img, index) => (
                                <SwiperSlide key={index}>
                                    <img
                                        src={img}
                                        alt={`Imagen adicional ${index + 1}`}
                                        className="w-full h-full object-cover rounded-lg"
                                    />
                                </SwiperSlide>
                            ))}
                        </Swiper>
                    </div>
                )}
            </Modal>
        </section>
    );
};

export default Servicios;
