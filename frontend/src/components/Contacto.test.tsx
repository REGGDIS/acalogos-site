import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Contacto from "./Contacto";

const fetchMock = vi.fn<typeof fetch>();

type ResponseBodyReaders = {
  json: ReturnType<typeof vi.fn>;
  text: ReturnType<typeof vi.fn>;
  arrayBuffer: ReturnType<typeof vi.fn>;
  blob: ReturnType<typeof vi.fn>;
  formData: ReturnType<typeof vi.fn>;
};

const responseWithStatus = (status: number): {
  response: Response;
  readers: ResponseBodyReaders;
} => {
  const readers: ResponseBodyReaders = {
    json: vi.fn(),
    text: vi.fn(),
    arrayBuffer: vi.fn(),
    blob: vi.fn(),
    formData: vi.fn(),
  };

  return {
    response: {
      status,
      ok: status >= 200 && status < 300,
      ...readers,
    } as unknown as Response,
    readers,
  };
};

const expectBodyUnread = (readers: ResponseBodyReaders) => {
  for (const reader of Object.values(readers)) {
    expect(reader).not.toHaveBeenCalled();
  }
};

const setHoneypot = (value: string) => {
  const honeypot = document.querySelector<HTMLInputElement>('input[name="website"]');
  expect(honeypot).not.toBeNull();
  fireEvent.change(honeypot!, { target: { value } });
};

const expectFormPreserved = (website: string) => {
  expect(screen.getByLabelText("Nombre")).toHaveValue("Persona de prueba");
  expect(screen.getByLabelText("Correo electrónico")).toHaveValue("persona@example.com");
  expect(screen.getByLabelText("Mensaje")).toHaveValue("Este es un mensaje de prueba.");
  expect(screen.getByRole("checkbox", { name: /Acepto que Acalogos/ })).toBeChecked();
  expect(document.querySelector('input[name="website"]')).toHaveValue(website);
};

const expectFormCleared = () => {
  expect(screen.getByLabelText("Nombre")).toHaveValue("");
  expect(screen.getByLabelText("Correo electrónico")).toHaveValue("");
  expect(screen.getByLabelText("Mensaje")).toHaveValue("");
  expect(screen.getByRole("checkbox", { name: /Acepto que Acalogos/ })).not.toBeChecked();
  expect(document.querySelector('input[name="website"]')).toHaveValue("");
};

const fillValidForm = async () => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Nombre"), "Persona de prueba");
  await user.type(screen.getByLabelText("Correo electrónico"), "persona@example.com");
  await user.type(screen.getByLabelText("Mensaje"), "Este es un mensaje de prueba.");
  await user.click(screen.getByRole("checkbox", { name: /Acepto que Acalogos/ }));
  return user;
};

beforeEach(() => {
  vi.stubEnv("VITE_CONTACT_PRIVACY_NOTICE_VERSION", "contact-v1");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Contacto", () => {
  it("envía el payload exacto normalizado y no lee el body de respuesta", async () => {
    const { response, readers } = responseWithStatus(201);
    fetchMock.mockResolvedValue(response);
    render(<Contacto />);

    const user = userEvent.setup();
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "  Jose\u0301 Pérez  " } });
    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: " persona@example.com " } });
    fireEvent.change(screen.getByLabelText("Mensaje"), { target: { value: "  Primera línea\r\nSegunda línea  " } });
    await user.click(screen.getByRole("checkbox", { name: /Acepto que Acalogos/ }));
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    const confirmation = await screen.findByRole("status");
    expect(confirmation).toHaveTextContent("Mensaje recibido.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("http://localhost:3000/contacto");
    expect(options?.method).toBe("POST");
    expect(options?.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(String(options?.body))).toEqual({
      nombre: "José Pérez",
      email: "persona@example.com",
      mensaje: "Primera línea\nSegunda línea",
      privacyNoticeVersion: "contact-v1",
      website: "",
    });
    expectBodyUnread(readers);
  });

  it.each([
    [201, "https://limpiar-201.example"],
    [202, "https://limpiar-202.example"],
  ])("trata %s como éxito, limpia todos los campos y enfoca la confirmación", async (status, website) => {
    const { response, readers } = responseWithStatus(status);
    fetchMock.mockResolvedValue(response);
    render(<Contacto />);
    const user = await fillValidForm();
    setHoneypot(website);

    await user.click(screen.getByRole("button", { name: "Enviar" }));

    const confirmation = await screen.findByRole("status");
    expect(confirmation).toHaveTextContent("Mensaje recibido.");
    expect(confirmation).toHaveFocus();
    expect(confirmation).not.toHaveAttribute("aria-live");
    expectFormCleared();
    expectBodyUnread(readers);
  });

  it("exige consentimiento y enfoca el primer campo inválido", async () => {
    render(<Contacto />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Nombre")).toHaveFocus();
    expect(screen.getByText("Debes aceptar el uso de tus datos para enviar la consulta.")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveAttribute("aria-invalid", "true");
  });

  it("aplica los límites visibles antes del fetch", async () => {
    render(<Contacto />);
    const user = userEvent.setup();
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "a" } });
    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "correo-invalido" } });
    fireEvent.change(screen.getByLabelText("Mensaje"), { target: { value: "corto" } });
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("El nombre debe tener entre 2 y 100 caracteres.")).toBeInTheDocument();
    expect(screen.getByText("Ingresa un correo electrónico válido.")).toBeInTheDocument();
    expect(screen.getByText("El mensaje debe tener entre 10 y 4000 caracteres.")).toBeInTheDocument();
  });

  it("deshabilita el envío si falta la versión pública", () => {
    vi.stubEnv("VITE_CONTACT_PRIVACY_NOTICE_VERSION", "");
    render(<Contacto />);

    expect(screen.getByRole("alert")).toHaveTextContent("El formulario no está disponible temporalmente.");
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mantiene el honeypot fuera del flujo y lo incluye sin campos adicionales", async () => {
    const { response } = responseWithStatus(202);
    fetchMock.mockResolvedValue(response);
    const { container } = render(<Contacto />);
    const honeypot = container.querySelector<HTMLInputElement>('input[name="website"]');
    expect(honeypot).not.toBeNull();
    expect(honeypot).toHaveAttribute("autocomplete", "off");
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot).toHaveAttribute("aria-hidden", "true");
    expect(honeypot).toHaveAttribute("maxlength", "200");
    const honeypotContainer = honeypot?.closest(".contact-honeypot");
    expect(honeypotContainer).not.toBeNull();
    expect(honeypotContainer).toHaveClass("contact-honeypot");

    fireEvent.change(honeypot!, { target: { value: "https://spam.example" } });
    const user = await fillValidForm();
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      website: "https://spam.example",
    });
  });

  it.each([
    [200, "No pudimos enviar el mensaje"],
    [400, "No pudimos enviar el mensaje"],
    [404, "No pudimos enviar el mensaje"],
    [413, "El mensaje es demasiado extenso"],
    [415, "No pudimos enviar el mensaje"],
    [422, "Revisa los datos ingresados"],
    [429, "Has realizado demasiados intentos"],
    [500, "No pudimos enviar el mensaje"],
    [503, "No pudimos recibir tu mensaje"],
  ])("rechaza HTTP %s, conserva todos los datos y no lee el body", async (status, message) => {
    const { response, readers } = responseWithStatus(status);
    fetchMock.mockResolvedValue(response);
    render(<Contacto />);
    const user = await fillValidForm();
    const website = "https://preservar.example";
    setHoneypot(website);
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(message);
    expect(alert).toHaveFocus();
    expect(alert).not.toHaveAttribute("aria-live");
    expectFormPreserved(website);
    expect(screen.getByRole("button", { name: "Enviar" })).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expectBodyUnread(readers);
  });

  it("conserva todos los datos, rehabilita el botón y no registra PII ante error de red", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fetchMock.mockRejectedValue(new Error("network failed"));
    render(<Contacto />);
    const user = await fillValidForm();
    const website = "https://preservar.example";
    setHoneypot(website);
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No pudimos conectar con el servicio");
    expectFormPreserved(website);
    expect(screen.getByRole("button", { name: "Enviar" })).toBeEnabled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("bloquea envíos dobles mientras la primera solicitud está pendiente", async () => {
    let resolveFetch!: (response: Response) => void;
    fetchMock.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));
    render(<Contacto />);
    await fillValidForm();
    const form = screen.getByRole("button", { name: "Enviar" }).closest("form");
    expect(form).not.toBeNull();

    fireEvent.submit(form!);
    fireEvent.submit(form!);
    expect(screen.getByRole("button", { name: "Enviando..." })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(responseWithStatus(201).response);
    await screen.findByRole("status");
  });

  it("aborta la petición pendiente únicamente al desmontar", async () => {
    fetchMock.mockImplementation((_input, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    const { unmount } = render(<Contacto />);
    const user = await fillValidForm();
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    const signal = fetchMock.mock.calls[0][1]?.signal;

    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
