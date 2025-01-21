import React from 'react';
import Servicios from './components/Servicios';
import Portfolio from './components/Portfolio';
import Contacto from './components/Contacto';
//import './styles/App.css';


const App: React.FC = () => {
  return (
    <div>
      {/* Encabezado */}
      <header className="bg-secondary text-accent py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-6">
          <h1 className="text-primary text-2xl font-bold">ACA Logos</h1>
          <nav className="space-x-4">
            <a href="#services" className="text-white hover:text-highlight">Servicios</a>
            <a href="#portfolio" className="text-white hover:text-highlight">Portafolio</a>
            <a href="#contact" className="text-white hover:text-highlight">Contacto</a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-cover bg-center h-screen" style={{ backgroundImage: "url('https://via.placeholder.com/1920x1080')" }}>
        <div className="h-full flex flex-col justify-center items-center bg-black bg-opacity-50 text-center text-white px-6">
          <h2 className="text-4xl md:text-6xl font-bold mb-4">Diseñamos tus ideas</h2>
          <p className="text-lg md:text-2xl mb-6">Creamos diseños únicos y personalizados para destacar tu marca.</p>
          <a href="#contact" className="bg-primary text-accent py-2 px-4 rounded-lg font-semibold hover:bg-highlight">
            Contáctanos
          </a>
        </div>
      </section>

      {/* Sección Servicios */}
      <section id="services" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h3 className="text-3xl font-bold mb-8">Nuestros Servicios</h3>
          {/* Aquí se inserta el componente Servicios */}
          <Servicios />
        </div>
      </section>

      {/* Sección Portafolio */}
      <Portfolio />

      {/* Sección Contacto */}
      <section id="contact" className="py-16 bg-white">
        <Contacto />
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
