import { Request } from "express";
import jwt from "jsonwebtoken";

export interface ContactoBody {
    nombre: string;
    email: string;
    mensaje: string;
}

export interface ImagenBody {
    imagen: string;
}

export interface AuthRequest extends Request {
    user?: string | jwt.JwtPayload;
}