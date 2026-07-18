import pkg from 'pg';
import type { PoolConfig } from 'pg';
const { Pool } = pkg;
import { config } from './config.js';

const poolConfig: PoolConfig = config.db.mode === "url"
    ? { connectionString: config.db.connectionString }
    : {
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database,
    };

export const pool = new Pool(poolConfig);
