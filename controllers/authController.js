const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Registrar usuario
async function register(req, res) {
    try {
        const { nombre, email, password } = req.body;

        // Validaciones
        if (!nombre || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Todos los campos son requeridos'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'La contraseña debe tener al menos 6 caracteres'
            });
        }

        // Verificar si el email ya existe
        const [existingUsers] = await db.query(
            'SELECT id FROM usuarios WHERE email = ?',
            [email]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'El email ya está registrado'
            });
        }

        // Hashear contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insertar usuario
        const [result] = await db.query(
            'INSERT INTO usuarios (nombre, email, password) VALUES (?, ?, ?)',
            [nombre, email, hashedPassword]
        );

        const userId = result.insertId;

        // Crear configuración por defecto (probabilidad mínima 30%)
        await db.query(
            'INSERT INTO configuracion_usuario (usuario_id, probabilidad_minima, ratio_riesgo_beneficio_minimo) VALUES (?, ?, ?)',
            [userId, 30, 2.0]
        );

        // Crear balance virtual por defecto
        await db.query(
            'INSERT INTO balance_virtual (usuario_id) VALUES (?)',
            [userId]
        );

        res.status(201).json({
            success: true,
            message: 'Usuario registrado exitosamente',
            userId: userId
        });

    } catch (error) {
        console.error('Error en register:', error);
        res.status(500).json({
            success: false,
            message: 'Error al registrar usuario'
        });
    }
}

// Iniciar sesión
async function login(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email y contraseña son requeridos'
            });
        }

        // Buscar usuario
        const [users] = await db.query(
            'SELECT * FROM usuarios WHERE email = ? AND activo = TRUE',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales incorrectas'
            });
        }

        const user = users[0];

        // Verificar contraseña
        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales incorrectas'
            });
        }

        // Generar token JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, nombre: user.nombre },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        res.json({
            success: true,
            message: 'Inicio de sesión exitoso',
            token,
            usuario: {
                id: user.id,
                nombre: user.nombre,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({
            success: false,
            message: 'Error al iniciar sesión'
        });
    }
}

// Obtener perfil del usuario
async function getProfile(req, res) {
    try {
        const userId = req.usuarioId;

        const [users] = await db.query(
            `SELECT u.id, u.nombre, u.email, u.fecha_registro,
              b.balance_actual, b.trades_totales, b.tasa_aciertos
       FROM usuarios u
       LEFT JOIN balance_virtual b ON u.id = b.usuario_id
       WHERE u.id = ?`,
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        res.json({
            success: true,
            data: users[0]
        });

    } catch (error) {
        console.error('Error en getProfile:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener perfil'
        });
    }
}

module.exports = {
    register,
    login,
    getProfile
};
