import React from 'react';
import Servicios from './components/Servicios';
import Portfolio from './components/Portfolio';
import Contacto from './components/Contacto';
import HeroSection from './components/HeroSection';
import Footer from './components/Footer';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AdminLogin from './pages/AdminLogin';
import AdminPanel from './pages/AdminPanel';
import ProtectedRoute from "./components/ProtectedRoute";

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <div>
              {/* Encabezado */}
              <header className="bg-secondary text-accent py-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center px-5">
                  {/* Logo y nombre */}
                  <div className="flex items-center space-x-3">
                    <img
                      src="/assets/images/header/logo-header.png"
                      alt="Logo ACA Logos"
                      className="h-8.5 w-10"
                    />
                    <h1 className="text-primary text-2xl font-bold">ACA Logos</h1>
                  </div>
                  {/* Menú de navegación */}
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
              <Footer />
            </div>
          }
        />
        <Route path="/admin" element={<AdminLogin />} />

        {/* Rutas protegidas */}
        <Route element={<ProtectedRoute />}>
          <Route path="/admin/panel" element={<AdminPanel />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
