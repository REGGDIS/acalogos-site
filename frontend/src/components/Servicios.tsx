import React, { useState, useEffect } from "react";
import axios from "axios";
import Modal from "react-modal";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "../styles/modal.css";

Modal.setAppElement("#root");

interface Servicio {
  id: number;
  nombre: string;
  descripcion: string;
  precio: string;
  imagen: string;
  categoria?: string;
  imagenes_adicionales?: string[];
}

const Servicios: React.FC = () => {
  // Estado para almacenar los servicios originales
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Estados para filtros y búsqueda
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState<string>("todos");

  // Estados para el modal
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [currentServicio, setCurrentServicio] = useState<Servicio | null>(null);

  useEffect(() => {
    axios
      .get("http://localhost:3000/servicios")
      .then((response) => {
        console.log("Servicios recibidos del backend:", response.data);
        setServicios(response.data.data);
      })
      .catch((error) => {
        setError("Hubo un problema al obtener los servicios.");
        console.error(error);
      });
  }, []);

  // Función para abrir/cerrar modal
  const openModal = (servicio: Servicio) => {
    console.log("Abriendo modal para:", servicio);
    setCurrentServicio(servicio);
    setModalIsOpen(true);
  };

  const closeModal = () => {
    setCurrentServicio(null);
    setModalIsOpen(false);
  };

  // Filtrado de servicios
  const serviciosFiltrados = servicios.filter((servicio) => {
    const categoriesString = servicio.categoria
      ? servicio.categoria.toString().toLowerCase()
      : "";

    // Filtrado por texto
    const matchText =
      servicio.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      servicio.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      categoriesString.includes(searchTerm.toLowerCase());

    // Filtrado por categoría (select)
    const matchCategoria =
      selectedCategoria === "todos" ||
      (Array.isArray(servicio.categoria) &&
        servicio.categoria.includes(selectedCategoria)) ||
      (typeof servicio.categoria === "string" &&
        servicio.categoria === selectedCategoria);

    return matchText && matchCategoria;
  });

  return (
    <section id="servicios" className="py-16 bg-gray-100">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-3xl font-bold mb-8 text-center">Nuestros Servicios</h2>
        {error && <p className="text-red-500 text-center">{error}</p>}

        {/* Barra de búsqueda y filtro */}
        <div className="flex flex-col md:flex-row items-center mb-8 gap-4">
          <input
            type="text"
            placeholder="Buscar servicios..."
            className="flex-1 border border-gray-300 px-4 py-2 rounded"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            className="border border-gray-300 px-4 py-2 rounded"
            value={selectedCategoria}
            onChange={(e) => setSelectedCategoria(e.target.value)}
          >
            <option value="todos">Todas las Categorías</option>
            <option value="impresiones">Impresiones</option>
            <option value="vinilos">Vinilos</option>
            <option value="letras">Letras</option>
            <option value="pendones">Pendones</option>
            <option value="calcomanias">Calcomanías</option>
            <option value="empavonados">Empavonados</option>
          </select>
        </div>

        {/* Lista de Servicios */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {serviciosFiltrados.map((servicio) => (
            <div
              key={servicio.id}
              className="bg-white shadow-md rounded-lg overflow-hidden cursor-pointer"
              onClick={() => openModal(servicio)}
            >
              <img
                src={`http://localhost:3000${servicio.imagen}`}
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

      {/* Modal para mostrar imágenes */}
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
              className="w-full max-w-lg mx-auto"
            >
              {/* 🔹 Imagen Principal */}
              <SwiperSlide className="flex justify-center items-center">
                <img
                  src={`http://localhost:3000${currentServicio.imagen}`}
                  alt="Imagen principal"
                  className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
                />
              </SwiperSlide>

              {/* 🔹 Imágenes Adicionales */}
              {currentServicio.imagenes_adicionales?.map((img, index) => (
                <SwiperSlide key={index} className="flex justify-center items-center">
                  <img
                    src={`http://localhost:3000${img}`}
                    alt={`Imagen adicional ${index + 1}`}
                    className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
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
