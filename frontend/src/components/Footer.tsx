import React from "react";

const Footer: React.FC = () => {
    return (
        <footer className="bg-gray-900 text-white py-10">
            <div className="max-w-7xl mx-auto px-6">
                {/* Secciones principales */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Quienes somos */}
                    <div>
                        <h3 className="text-lg text-white font-bold mb-4">Quiénes somos</h3>
                        <p className="text-gray-400 text-sm">
                            Somos ACA LOGOS, una empresa líder en impresiones de alta calidad, empavonado de vidrios y autoadhesivos. Ofreciendo soluciones creativas y personalizadas para destacar tu marca en el mercado.
                        </p>
                    </div>
                    {/* Enlaces rápidos */}
                    <div>
                        <h3 className="text-lg text-white font-bold mb-4">Enlaces rápidos</h3>
                        <ul className="space-y-2">
                            <li>
                                <a href="#services" className="hover:text-highlight text-gray-400 text-sm">
                                    Servicios
                                </a>
                            </li>
                            <li>
                                <a href="#portfolio" className="hover:text-highlight text-gray-400 text-sm">
                                    Portafolio
                                </a>
                            </li>
                            <li>
                                <a href="#contact" className="hover:text-highlight text-gray-400 text-sm">
                                    Contáctanos
                                </a>
                            </li>
                        </ul>
                    </div>
                    {/* Mapa interactivo */}
                    <div>
                        <h3 className="text-lg font-bold mb-4">Nuestra ubicación</h3>
                        <div className="relative h-40 md:h-56">
                            <iframe
                                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3153.8354345096166!2d-122.41941568468107!3d37.77492967975983!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x808581515c5f4e13%3A0xf519b9e1209b1190!2sSan%20Francisco%2C%20CA%2C%20EE.%20UU.!5e0!3m2!1ses!2smx!4v1689241463093!5m2!1ses!2smx"
                                title="Mapa de ubicación"
                                className="absolute inset-0 w-full h-full border-none"
                                allowFullScreen
                                loading="lazy"
                            ></iframe>
                        </div>
                    </div>
                </div>

                {/* Derechos reservados */}
                <div className="mt-8 border-t border-gray-700 pt-4 text-center">
                    <p className="text-gray-400 text-sm">
                        &copy; 2025 Roberto Emilio González Guzmán. Todos los derechos reservados.
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;