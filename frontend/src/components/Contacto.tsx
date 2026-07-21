import { useEffect, useRef, useState } from "react";
import { apiUrl } from "../config/api";
import { getContactPrivacyNoticeVersion } from "../config/contactPrivacyRuntime";
import "../styles/contacto.css";

type ContactFormData = {
  nombre: string;
  email: string;
  mensaje: string;
  website: string;
};

type VisibleField = "nombre" | "email" | "mensaje" | "consentimiento";
type FieldErrors = Partial<Record<VisibleField, string>>;
type SubmissionStatus =
  | { kind: "idle" }
  | { kind: "success" | "error"; message: string; focus: boolean };

const INITIAL_FORM_DATA: ContactFormData = {
  nombre: "",
  email: "",
  mensaje: "",
  website: "",
};

const normalizeFormData = (formData: ContactFormData): ContactFormData => ({
  nombre: formData.nombre.normalize("NFC").trim(),
  email: formData.email.trim(),
  mensaje: formData.mensaje.replace(/\r\n?/g, "\n").normalize("NFC").trim(),
  website: formData.website,
});

const isValidEmail = (value: string): boolean => {
  const input = document.createElement("input");
  input.type = "email";
  input.value = value;
  return input.checkValidity();
};

const validateForm = (
  formData: ContactFormData,
  hasConsent: boolean,
): FieldErrors => {
  const errors: FieldErrors = {};

  if (formData.nombre.length < 2 || formData.nombre.length > 100) {
    errors.nombre = "El nombre debe tener entre 2 y 100 caracteres.";
  }
  if (formData.email.length === 0 || formData.email.length > 254 || !isValidEmail(formData.email)) {
    errors.email = "Ingresa un correo electrónico válido.";
  }
  if (formData.mensaje.length < 10 || formData.mensaje.length > 4000) {
    errors.mensaje = "El mensaje debe tener entre 10 y 4000 caracteres.";
  }
  if (!hasConsent) {
    errors.consentimiento = "Debes aceptar el uso de tus datos para enviar la consulta.";
  }

  return errors;
};

const responseErrorMessage = (status: number): string => {
  if (status === 422) return "Revisa los datos ingresados e inténtalo nuevamente.";
  if (status === 429) return "Has realizado demasiados intentos. Espera unos minutos antes de volver a intentar.";
  if (status === 503) return "No pudimos recibir tu mensaje. Inténtalo más tarde.";
  if (status === 413) return "El mensaje es demasiado extenso. Revisa el contenido e inténtalo nuevamente.";
  return "No pudimos enviar el mensaje. Inténtalo nuevamente.";
};

const Contacto = () => {
  const [formData, setFormData] = useState<ContactFormData>(INITIAL_FORM_DATA);
  const [hasConsent, setHasConsent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<SubmissionStatus>({ kind: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const privacyNoticeVersion = getContactPrivacyNoticeVersion();
  const submittingRef = useRef(false);
  const activeControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const nombreRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const mensajeRef = useRef<HTMLTextAreaElement>(null);
  const consentimientoRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (status.kind !== "idle" && status.focus) {
      statusRef.current?.focus();
    }
  }, [status]);

  const clearFieldError = (field: VisibleField) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    if (!(name in INITIAL_FORM_DATA)) return;

    setFormData((current) => ({ ...current, [name]: value }));
    if (name !== "website") clearFieldError(name as VisibleField);
    if (status.kind === "error") setStatus({ kind: "idle" });
  };

  const focusFirstInvalidField = (errors: FieldErrors) => {
    if (errors.nombre) nombreRef.current?.focus();
    else if (errors.email) emailRef.current?.focus();
    else if (errors.mensaje) mensajeRef.current?.focus();
    else if (errors.consentimiento) consentimientoRef.current?.focus();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;

    setStatus({ kind: "idle" });

    if (!privacyNoticeVersion) {
      setStatus({
        kind: "error",
        message: "El formulario no está disponible temporalmente. Inténtalo más tarde.",
        focus: true,
      });
      return;
    }

    const normalizedData = normalizeFormData(formData);
    const errors = validateForm(normalizedData, hasConsent);
    if (normalizedData.website.length > 200) {
      setStatus({
        kind: "error",
        message: "No pudimos validar el formulario. Inténtalo nuevamente.",
        focus: true,
      });
      return;
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setStatus({
        kind: "error",
        message: "Revisa los campos indicados antes de enviar.",
        focus: false,
      });
      focusFirstInvalidField(errors);
      return;
    }

    setFieldErrors({});
    submittingRef.current = true;
    setIsSubmitting(true);
    const controller = new AbortController();
    activeControllerRef.current = controller;

    try {
      const response = await fetch(apiUrl("/contacto"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: normalizedData.nombre,
          email: normalizedData.email,
          mensaje: normalizedData.mensaje,
          privacyNoticeVersion,
          website: normalizedData.website,
        }),
        signal: controller.signal,
      });

      if (!mountedRef.current) return;

      if (response.status === 201 || response.status === 202) {
        setFormData(INITIAL_FORM_DATA);
        setHasConsent(false);
        setStatus({ kind: "success", message: "Mensaje recibido.", focus: true });
      } else {
        setStatus({ kind: "error", message: responseErrorMessage(response.status), focus: true });
      }
    } catch {
      if (mountedRef.current) {
        setStatus({
          kind: "error",
          message: "No pudimos conectar con el servicio. Revisa tu conexión e inténtalo nuevamente.",
          focus: true,
        });
      }
    } finally {
      if (activeControllerRef.current === controller) activeControllerRef.current = null;
      submittingRef.current = false;
      if (mountedRef.current) setIsSubmitting(false);
    }
  };

  const configurationUnavailable = !privacyNoticeVersion;

  return (
    <section id="contact" className="bg-white py-16" aria-labelledby="contact-title">
      <div className="mx-auto max-w-7xl px-6 text-center">
        <h2 id="contact-title" className="mb-8 text-3xl font-bold">Contáctanos</h2>

        {configurationUnavailable && (
          <p className="mx-auto mb-4 max-w-3xl text-red-700" role="alert">
            El formulario no está disponible temporalmente. Inténtalo más tarde.
          </p>
        )}

        <form className="relative mx-auto max-w-3xl text-left" onSubmit={handleSubmit} noValidate>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="contact-nombre" className="mb-1 block font-medium">Nombre</label>
              <input
                ref={nombreRef}
                id="contact-nombre"
                type="text"
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
                className="w-full rounded-lg border p-4"
                minLength={2}
                maxLength={100}
                required
                autoComplete="name"
                aria-invalid={Boolean(fieldErrors.nombre)}
                aria-describedby={fieldErrors.nombre ? "contact-nombre-error" : undefined}
              />
              {fieldErrors.nombre && <p id="contact-nombre-error" className="mt-1 text-sm text-red-700">{fieldErrors.nombre}</p>}
            </div>

            <div>
              <label htmlFor="contact-email" className="mb-1 block font-medium">Correo electrónico</label>
              <input
                ref={emailRef}
                id="contact-email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full rounded-lg border p-4"
                maxLength={254}
                required
                autoComplete="email"
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? "contact-email-error" : undefined}
              />
              {fieldErrors.email && <p id="contact-email-error" className="mt-1 text-sm text-red-700">{fieldErrors.email}</p>}
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="contact-mensaje" className="mb-1 block font-medium">Mensaje</label>
            <textarea
              ref={mensajeRef}
              id="contact-mensaje"
              name="mensaje"
              value={formData.mensaje}
              onChange={handleChange}
              className="w-full rounded-lg border p-4"
              minLength={10}
              maxLength={4000}
              rows={6}
              required
              aria-invalid={Boolean(fieldErrors.mensaje)}
              aria-describedby={fieldErrors.mensaje ? "contact-mensaje-error" : undefined}
            />
            {fieldErrors.mensaje && <p id="contact-mensaje-error" className="mt-1 text-sm text-red-700">{fieldErrors.mensaje}</p>}
          </div>

          <div className="contact-honeypot" aria-hidden="true">
            <label htmlFor="contact-website">Sitio web</label>
            <input
              id="contact-website"
              type="text"
              name="website"
              value={formData.website}
              onChange={handleChange}
              autoComplete="off"
              maxLength={200}
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>

          <div className="mt-4">
            <div className="flex items-start gap-3">
              <input
                ref={consentimientoRef}
                id="contact-consentimiento"
                type="checkbox"
                checked={hasConsent}
                onChange={(event) => {
                  setHasConsent(event.target.checked);
                  clearFieldError("consentimiento");
                  if (status.kind === "error") setStatus({ kind: "idle" });
                }}
                className="mt-1 h-4 w-4 shrink-0"
                required
                aria-invalid={Boolean(fieldErrors.consentimiento)}
                aria-describedby={fieldErrors.consentimiento ? "contact-consentimiento-error" : undefined}
              />
              <label htmlFor="contact-consentimiento" className="text-sm leading-6">
                Acepto que Acalogos utilice mis datos para responder esta consulta, procese la notificación mediante su proveedor de correo y conserve la información por un máximo de 90 días.
              </label>
            </div>
            {fieldErrors.consentimiento && (
              <p id="contact-consentimiento-error" className="mt-1 text-sm text-red-700">{fieldErrors.consentimiento}</p>
            )}
          </div>

          <div className="text-center">
            <button
              type="submit"
              disabled={isSubmitting || configurationUnavailable}
              className={`mt-4 rounded-lg bg-yellow-500 px-6 py-2 font-semibold text-black hover:bg-yellow-600 disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {isSubmitting ? "Enviando..." : "Enviar"}
            </button>
          </div>
        </form>

        {status.kind !== "idle" && (
          <p
            ref={statusRef}
            tabIndex={-1}
            role={status.kind === "error" ? "alert" : "status"}
            aria-atomic="true"
            className={`mx-auto mt-4 max-w-3xl ${status.kind === "success" ? "text-green-700" : "text-red-700"}`}
          >
            {status.message}
          </p>
        )}
      </div>
    </section>
  );
};

export default Contacto;
