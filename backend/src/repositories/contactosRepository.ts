import type { Pool } from "pg";
import type { ContactSubmission } from "../validation/contactoValidation.js";

export interface ContactRepository {
    insert(submission: ContactSubmission): Promise<void>;
}

export class PostgresContactRepository implements ContactRepository {
    constructor(private readonly pool: Pool) {}

    async insert(submission: ContactSubmission): Promise<void> {
        const result = await this.pool.query<{ id: string }>(
            `INSERT INTO public.contactos (
                nombre,
                email,
                mensaje,
                privacy_notice_version
            )
            VALUES ($1, $2, $3, $4)
            RETURNING id`,
            [
                submission.nombre,
                submission.email,
                submission.mensaje,
                submission.privacyNoticeVersion,
            ],
        );

        if (result.rowCount !== 1 || typeof result.rows[0]?.id !== "string") {
            throw new Error("La inserción del contacto no devolvió el resultado esperado.");
        }
    }
}
