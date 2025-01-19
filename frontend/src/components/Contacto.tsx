import React, { useState } from "react";

const Contacto: React.FC = () => {
    const [formData, setFormData] = useState({
        nombre: "",
        email: "",
        mensaje: "",
    });

    const [status, setStatus] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus(null);
        setIsSubmitting(true); // Activar el indicador de carga

        try {
            const response = await fetch("http://localhost:3000/contacto", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                setStatus("¡Mensaje enviado con éxito!");
                setFormData({ nombre: "", email: "", mensaje: "" });
            } else {
                setStatus("Hubo un problema al enviar el mensaje. Inténtalo nuevamente.");
            }
        } catch (error) {
            console.error("Error:", error);
            setStatus("Ocurrió un error inesperado. Por favor, inténtalo de nuevo.");
        } finally {
            setIsSubmitting(false); // Desactivar el indicador de carga
        }
    };

    return (
        <section id="contact" className="py-16 bg-white">
            <div className="max-w-7xl mx-auto px-6 text-center">
                <h3 className="text-3xl font-bold mb-8">Contáctanos</h3>
                <form className="max-w-3xl mx-auto" onSubmit={handleSubmit}>
                    <div className="grid gap-4 md:grid-cols-2">
                        <input
                            type="text"
                            name="nombre"
                            placeholder="Nombre"
                            value={formData.nombre}
                            onChange={handleChange}
                            className="p-4 border rounded-lg"
                            required
                        />
                        <input
                            type="email"
                            name="email"
                            placeholder="Correo electrónico"
                            value={formData.email}
                            onChange={handleChange}
                            className="p-4 border rounded-lg"
                            required
                        />
                    </div>
                    <textarea
                        name="mensaje"
                        placeholder="Mensaje"
                        value={formData.mensaje}
                        onChange={handleChange}
                        className="w-full p-4 border rounded-lg mt-4"
                        required
                    ></textarea>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`bg-yellow-500 hover:bg-yellow-600 text-black py-2 px-6 rounded-lg font-semibold mt-4 ${
                            isSubmitting ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                    >
                        {isSubmitting ? "Enviando..." : "Enviar"}
                    </button>
                </form>
                {status && (
                    <p className={`mt-4 ${status.includes("éxito") ? "text-green-600" : "text-red-600"}`}>
                        {status}
                    </p>
                )}
            </div>
        </section>
    );
};

export default Contacto;
