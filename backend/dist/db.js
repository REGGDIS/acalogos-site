import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();
export const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'Roberto',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_NAME || 'bd_acalogos',
});
