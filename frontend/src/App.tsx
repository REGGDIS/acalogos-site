import React from 'react';

const App: React.FC = () => {
  return (
    <div>
      {/* Encabezado (Este es estático y ya está en tu index.html) */}
      <header className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto flex justify-between items-center py-4 px-6">
          <h1 className="text-2xl font-bold">Gráfica Creativa</h1>
          <nav className="space-x-4">
            <a href="#services" className="hover:text-yellow-400">Servicios</a>
            <a href="#portfolio" className="hover:text-yellow-400">Portafolio</a>
            <a href="#contact" className="hover:text-yellow-400">Contacto</a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-cover bg-center h-screen" style={{ backgroundImage: "url('https://via.placeholder.com/1920x1080')" }}>
        <div className="h-full flex flex-col justify-center items-center bg-black bg-opacity-50 text-center text-white px-6">
          <h2 className="text-4xl md:text-6xl font-bold mb-4">Diseñamos tus ideas</h2>
          <p className="text-lg md:text-2xl mb-6">Creamos diseños únicos y personalizados para destacar tu marca.</p>
          <a href="#contact" className="bg-yellow-500 hover:bg-yellow-600 text-black py-2 px-4 rounded-lg font-semibold">
            Contáctanos
          </a>
        </div>
      </section>

      {/* Sección Servicios */}
      <section id="services" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h3 className="text-3xl font-bold mb-8">Nuestros Servicios</h3>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="bg-gray-100 p-6 rounded-lg shadow hover:shadow-lg">
              <h4 className="text-xl font-semibold mb-4">Diseño Gráfico</h4>
              <p>Creación de logos, identidad visual, y material publicitario.</p>
            </div>
            <div className="bg-gray-100 p-6 rounded-lg shadow hover:shadow-lg">
              <h4 className="text-xl font-semibold mb-4">Impresión</h4>
              <p>Impresión de alta calidad en todo tipo de materiales.</p>
            </div>
            <div className="bg-gray-100 p-6 rounded-lg shadow hover:shadow-lg">
              <h4 className="text-xl font-semibold mb-4">Vinilos y Rotulación</h4>
              <p>Diseños creativos para vehículos, vitrinas y espacios comerciales.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Sección Portafolio */}
      <section id="portfolio" className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h3 className="text-3xl font-bold mb-8">Portafolio</h3>
          <div className="grid gap-6 md:grid-cols-3">
            <img src="https://via.placeholder.com/300" alt="Proyecto 1" className="rounded-lg shadow" />
            <img src="https://via.placeholder.com/300" alt="Proyecto 2" className="rounded-lg shadow" />
            <img src="https://via.placeholder.com/300" alt="Proyecto 3" className="rounded-lg shadow" />
          </div>
        </div>
      </section>

      {/* Sección Contacto */}
      <section id="contact" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h3 className="text-3xl font-bold mb-8">Contáctanos</h3>
          <form className="max-w-3xl mx-auto">
            <div className="grid gap-4 md:grid-cols-2">
              <input type="text" placeholder="Nombre" className="p-4 border rounded-lg" />
              <input type="email" placeholder="Correo Electrónico" className="p-4 border rounded-lg" />
            </div>
            <textarea placeholder="Mensaje" className="w-full p-4 border rounded-lg mt-4"></textarea>
            <button className="bg-yellow-500 hover:bg-yellow-600 text-black py-2 px-6 rounded-lg font-semibold mt-4">
              Enviar
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-4">
        <div className="max-w-7xl mx-auto text-center">
          <p>&copy; 2025 Gráfica Creativa. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
