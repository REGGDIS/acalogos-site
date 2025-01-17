import React, { useEffect, useState } from "react";

const Portfolio: React.FC = () => {
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openModal = (imageSrc: string) => {
    setModalImage(imageSrc);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    // Usamos un pequeño retraso para permitir que la animación de cierre se complete antes de limpiar la imagen.
    setTimeout(() => {
      setModalImage(null);
    }, 500); // Retraso de 500ms para coincidir con la duración de la animación
  };

  // Manejo de teclado para cerrar el modal con "Esc"
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };

    if (modalImage) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [modalImage]);

  return (
    <section id="portfolio" className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <h3 className="text-3xl font-bold mb-8">Portafolio</h3>
        <div className="grid gap-6 md:grid-cols-3 place-items-center">
          {/* Proyecto 1 */}
          <div className="rounded-lg shadow-lg bg-white">
            <img
              src="/assets/images/thumbnails/proyecto1-thumbnail.jpg"
              alt="Miniatura de Proyecto 1"
              className="rounded-t-lg w-full h-64 object-cover cursor-pointer"
              onClick={() => openModal("/assets/images/full-size/proyecto1-fullsize.webp")}
            />
            <div className="p-4">
              <h4 className="text-xl font-semibold mb-2">Proyecto 1</h4>
              <p className="text-gray-700">
                Descripción breve del proyecto 1. Aquí se puede agregar más detalles sobre el
                proyecto, el proceso y los resultados obtenidos.
              </p>
            </div>
          </div>

          {/* Proyecto 2 */}
          <div className="rounded-lg shadow-lg bg-white">
            <img
              src="/assets/images/thumbnails/proyecto2-thumbnail.jpg"
              alt="Miniatura de Proyecto 2"
              className="rounded-t-lg w-full h-64 object-cover cursor-pointer"
              onClick={() => openModal("/assets/images/full-size/proyecto2-fullsize.webp")}
            />
            <div className="p-4">
              <h4 className="text-xl font-semibold mb-2">Proyecto 2</h4>
              <p className="text-gray-700">
                Descripción breve del proyecto 2. Aquí se puede agregar más detalles sobre el
                proyecto, el proceso y los resultados obtenidos.
              </p>
            </div>
          </div>

          {/* Proyecto 3 */}
          <div className="rounded-lg shadow-lg bg-white">
            <img
              src="/assets/images/thumbnails/proyecto3-thumbnail.jpg"
              alt="Miniatura de Proyecto 3"
              className="rounded-t-lg w-full h-64 object-cover cursor-pointer"
              onClick={() => openModal("/assets/images/full-size/proyecto3-fullsize.webp")}
            />
            <div className="p-4">
              <h4 className="text-xl font-semibold mb-2">Proyecto 3</h4>
              <p className="text-gray-700">
                Descripción breve del proyecto 3. Aquí se puede agregar más detalles sobre el
                proyecto, el proceso y los resultados obtenidos.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalImage && (
        <div
          className={`fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50 transition-opacity duration-300 ${
            isOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={closeModal} // Cerrar al hacer clic fuera de la imagen
        >
          <div
            className={`relative transition-transform duration-500 ${
              isOpen ? "scale-100 opacity-100" : "scale-90 opacity-0"
            }`}
            onClick={(e) => e.stopPropagation()} // Evitar cierre al hacer clic en la imagen
          >
            <img
              src={modalImage}
              alt="Ampliada"
              className="max-w-full max-h-screen rounded-lg"
            />
            <button
              className="absolute top-2 right-2 bg-white text-black rounded-full p-2 shadow-lg"
              onClick={closeModal}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default Portfolio;
