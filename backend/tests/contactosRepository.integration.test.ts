import assert from "node:assert/strict";
import test from "node:test";
import pkg from "pg";
import { PostgresContactRepository } from "../src/repositories/contactosRepository.js";

const { Pool } = pkg;
const connectionString = process.env.CONTACT_TEST_DATABASE_URL;

if (!connectionString) {
    throw new Error("CONTACT_TEST_DATABASE_URL es obligatoria para test:contacto:postgres.");
}

test("inserta con el rol runtime y PostgreSQL genera el UUID", async () => {
    const pool = new Pool({ connectionString });

    try {
        const repository = new PostgresContactRepository(pool);
        await repository.insert({
            nombre: "Prueba efímera",
            email: "runtime@example.test",
            mensaje: "Mensaje de integración efímero.",
            privacyNoticeVersion: "contact-v1",
        });

        const idResult = await pool.query<{ id: string }>("SELECT id FROM public.contactos");
        assert.equal(idResult.rowCount, 1);
        assert.match(idResult.rows[0].id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

        await assert.rejects(
            () => pool.query("SELECT nombre FROM public.contactos"),
            /permission denied/,
        );
    } finally {
        await pool.end();
    }
});
