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
                    <div className="flex flex-col items-center">
                        <h3 className="text-lg font-bold mb-4">Nuestra ubicación</h3>
                        <div className="relative w-full max-w-md h-48 md:h-64 flex justify-center mt-[-10px] md:mt-[-15px] top-[-5px] md:top-[-15px]">
                            <iframe
                                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3167.1484623281362!2d-72.35132879022821!3d-37.45721646455567!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x966bdd69e6d4dbcd%3A0x7c9fb9db650f6c98!2sChorrillos%20280%2C%20Los%20Angeles%2C%20Los%20%C3%81ngeles%2C%20B%C3%ADo%20B%C3%ADo!5e0!3m2!1ses-419!2scl!4v1737638649857!5m2!1ses-419!2scl"
                                title="Mapa de ubicación"
                                className="w-full h-full border-none rounded-lg"
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