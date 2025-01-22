import React from 'react';
import Servicios from './components/Servicios';
import Portfolio from './components/Portfolio';
import Contacto from './components/Contacto';
import HeroSection from './components/HeroSection';


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
      <HeroSection />

      {/* Sección Servicios */}
      <section id="services" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6 text-center">
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
