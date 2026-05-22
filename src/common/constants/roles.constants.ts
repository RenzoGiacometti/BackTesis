/**
 * Roles base del sistema PluvIA.
 * Estos valores coinciden con los nombres en la tabla `rol` de la DB.
 * Al agregar un rol nuevo: 1) seedear en DB, 2) agregar aquí, 3) usar en @Roles().
 */
export const ROLES = {
    ADMIN: 'admin',
    PRODUCTOR: 'productor',
    AGUADOR: 'aguador',
} as const;

/** Tipo derivado de las constantes — equivale a 'admin' | 'productor' | 'aguador' */
export type RoleName = (typeof ROLES)[keyof typeof ROLES];
