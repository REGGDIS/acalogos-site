import jwt from "jsonwebtoken";
export const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        return res.status(403).json({ message: "Aceso denegado" });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Almacena la info en la solicitud
        next();
    }
    catch (error) {
        return res.status(401).json({ message: "Token inválido o expirado " });
    }
};
