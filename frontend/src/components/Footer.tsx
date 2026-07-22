import React from "react";

const Footer: React.FC = () => {
    const currentYear = new Date().getFullYear();
    const linkStyles = "inline-flex items-center rounded-sm text-gray-400 text-sm hover:text-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900";

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
                        <div className="mt-6">
                            <h4 className="text-base text-white font-bold mb-3">Contacto</h4>
                            <address className="not-italic space-y-2 text-gray-400 text-sm">
                                <p>Dirección: Chorrillos N° 280, Los Ángeles, Chile</p>
                                <p>
                                    <a href="tel:+56998256902" className={linkStyles}>
                                        Teléfono: 998256902
                                    </a>
                                </p>
                                <p>
                                    <a
                                        href="https://wa.me/56998256902"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`${linkStyles} gap-2`}
                                    >
                                        <svg
                                            aria-hidden="true"
                                            viewBox="0 0 24 24"
                                            className="h-4 w-4 shrink-0 fill-current"
                                        >
                                            <path d="M16.75 13.96c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.24-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.84-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.68.31-.23.25-.89.87-.89 2.12s.91 2.46 1.04 2.63c.12.17 1.79 2.73 4.34 3.83.61.26 1.08.42 1.45.54.61.19 1.16.17 1.6.1.49-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.11-.23-.17-.48-.29M12.04 21.5h-.01a9.48 9.48 0 0 1-4.84-1.33l-.35-.21-3.6.94.96-3.51-.23-.36a9.46 9.46 0 0 1-1.45-5.04A9.49 9.49 0 0 1 12.02 2.5a9.49 9.49 0 0 1 .02 19m8.08-17.58A11.36 11.36 0 0 0 12.03.56C5.72.56.58 5.7.58 12c0 2.02.53 3.99 1.53 5.72L.48 23.69l6.11-1.6a11.45 11.45 0 0 0 5.44 1.38h.01c6.31 0 11.44-5.14 11.44-11.45a11.37 11.37 0 0 0-3.36-8.1" />
                                        </svg>
                                        <span>WhatsApp: +56 9 9825 6902</span>
                                    </a>
                                </p>
                            </address>
                        </div>
                    </div>
                    {/* Enlaces rápidos */}
                    <div>
                        <h3 className="text-lg text-white font-bold mb-4">Enlaces rápidos</h3>
                        <ul className="space-y-2">
                            <li>
                                <a href="#services" className={linkStyles}>
                                    Servicios
                                </a>
                            </li>
                            <li>
                                <a href="#portfolio" className={linkStyles}>
                                    Portafolio
                                </a>
                            </li>
                            <li>
                                <a href="#contact" className={linkStyles}>
                                    Contáctanos
                                </a>
                            </li>
                        </ul>
                    </div>
                    {/* Mapa interactivo */}
                    <div className="flex flex-col items-center">
                        <h3 className="text-lg text-white font-bold mb-4">Nuestra ubicación</h3>
                        <div className="relative w-full max-w-md h-48 md:h-64 flex justify-center mt-2">
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
                        &copy; {currentYear} ACALogos. Todos los derechos reservados.
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
