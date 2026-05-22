import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');

    // ─── 1. Roles base (idempotente por nombre único) ─────────────────────────
    const rolAdmin = await prisma.rol.upsert({
        where: { nombre: 'admin' },
        update: {},
        create: { nombre: 'admin', descripcion: 'Administrador de la organización' },
    });

    const rolProductor = await prisma.rol.upsert({
        where: { nombre: 'productor' },
        update: {},
        create: { nombre: 'productor', descripcion: 'Productor dueño de chacras' },
    });

    const rolAguador = await prisma.rol.upsert({
        where: { nombre: 'aguador' },
        update: {},
        create: { nombre: 'aguador', descripcion: 'Personal de campo asignado a chacras' },
    });

    console.log('Roles creados:', rolAdmin.nombre, rolProductor.nombre, rolAguador.nombre);

    // ─── 2. Organización de prueba ─────────────────────────────────────────────
    const org = await prisma.organizacion.upsert({
        where: { id: '00000000-0000-0000-0000-000000000001' },
        update: {},
        create: {
            id: '00000000-0000-0000-0000-000000000001',
            nombre: 'Organización de Prueba PluvIA',
        },
    });

    console.log('Organización creada:', org.nombre);

    // ─── 3. Usuarios de prueba ─────────────────────────────────────────────────
    const adminPassword = await bcrypt.hash('Admin1234!', 10);
    const admin = await prisma.usuario.upsert({
        where: { email: 'admin@pluvia.com' },
        update: {},
        create: {
            email: 'admin@pluvia.com',
            nombre: 'Administrador',
            apellido: 'PluvIA',
            passwordHash: adminPassword,
        },
    });

    const productorPassword = await bcrypt.hash('Productor1234!', 10);
    const productor = await prisma.usuario.upsert({
        where: { email: 'productor@pluvia.com' },
        update: {},
        create: {
            email: 'productor@pluvia.com',
            nombre: 'Juan',
            apellido: 'Productor',
            passwordHash: productorPassword,
        },
    });

    const aguadorPassword = await bcrypt.hash('Aguador1234!', 10);
    const aguador = await prisma.usuario.upsert({
        where: { email: 'aguador@pluvia.com' },
        update: {},
        create: {
            email: 'aguador@pluvia.com',
            nombre: 'Pedro',
            apellido: 'Aguador',
            passwordHash: aguadorPassword,
        },
    });

    // Service account for processing backend B2B communication
    const systemPassword = await bcrypt.hash('PluvIA_System_2026!', 10);
    const systemUser = await prisma.usuario.upsert({
        where: { email: 'system@pluvia.internal' },
        update: {},
        create: {
            email: 'system@pluvia.internal',
            nombre: 'Processing',
            apellido: 'Backend',
            passwordHash: systemPassword,
        },
    });

    console.log('Usuarios creados:', admin.email, productor.email, aguador.email, systemUser.email);

    // ─── 4. Membresías en la organización ─────────────────────────────────────
    await prisma.usuarioOrganizacion.upsert({
        where: { idUsuario_idOrganizacion: { idUsuario: admin.id, idOrganizacion: org.id } },
        update: {},
        create: { idUsuario: admin.id, idOrganizacion: org.id, idRol: rolAdmin.id },
    });

    await prisma.usuarioOrganizacion.upsert({
        where: { idUsuario_idOrganizacion: { idUsuario: productor.id, idOrganizacion: org.id } },
        update: {},
        create: { idUsuario: productor.id, idOrganizacion: org.id, idRol: rolProductor.id },
    });

    await prisma.usuarioOrganizacion.upsert({
        where: { idUsuario_idOrganizacion: { idUsuario: aguador.id, idOrganizacion: org.id } },
        update: {},
        create: { idUsuario: aguador.id, idOrganizacion: org.id, idRol: rolAguador.id },
    });

    await prisma.usuarioOrganizacion.upsert({
        where: { idUsuario_idOrganizacion: { idUsuario: systemUser.id, idOrganizacion: org.id } },
        update: {},
        create: { idUsuario: systemUser.id, idOrganizacion: org.id, idRol: rolAdmin.id },
    });

    console.log('Membresías creadas.');

    // ─── 5. Catálogo: Tipos de mapa ──────────────────────────────────────────
    const tiposMapa = [
        { nombre: 'NDVI', descripcion: 'Índice de vegetación de diferencia normalizada' },
        { nombre: 'RGB', descripcion: 'Imagen en color real (rojo, verde, azul)' },
        { nombre: 'NDRE', descripcion: 'Índice de borde rojo de diferencia normalizada' },
        { nombre: 'Thermal', descripcion: 'Imagen térmica infrarroja' },
        { nombre: 'Depth', descripcion: 'Mapa de profundidad de lámina de riego (cm)' },
        { nombre: 'NDWI', descripcion: 'Índice de agua de diferencia normalizada' },
    ];

    for (const tipo of tiposMapa) {
        await prisma.catalogoTipoMapa.upsert({
            where: { nombre: tipo.nombre },
            update: {},
            create: tipo,
        });
    }

    console.log('Tipos de mapa creados:', tiposMapa.map((t) => t.nombre).join(', '));

    // ─── 6. Catálogo: Severidades ────────────────────────────────────────────
    const severidades = [
        { nombre: 'baja', nivel: 1, descripcion: 'Problema menor, monitorear' },
        { nombre: 'media', nivel: 2, descripcion: 'Requiere atención próxima' },
        { nombre: 'alta', nivel: 3, descripcion: 'Requiere atención pronta' },
        { nombre: 'crítica', nivel: 4, descripcion: 'Requiere atención inmediata' },
    ];

    for (const sev of severidades) {
        await prisma.catalogoSeveridad.upsert({
            where: { nombre: sev.nombre },
            update: {},
            create: sev,
        });
    }

    console.log('Severidades creadas:', severidades.map((s) => s.nombre).join(', '));

    // Obtener IDs de catálogos para uso en mock data
    const tipoNDVI = await prisma.catalogoTipoMapa.findUnique({ where: { nombre: 'NDVI' } });
    const tipoRGB = await prisma.catalogoTipoMapa.findUnique({ where: { nombre: 'RGB' } });
    const sevBaja = await prisma.catalogoSeveridad.findUnique({ where: { nombre: 'baja' } });
    const sevMedia = await prisma.catalogoSeveridad.findUnique({ where: { nombre: 'media' } });
    const sevAlta = await prisma.catalogoSeveridad.findUnique({ where: { nombre: 'alta' } });
    const sevCritica = await prisma.catalogoSeveridad.findUnique({ where: { nombre: 'crítica' } });

    // ─── 7. Chacras de prueba (zona arrocera Treinta y Tres, Uruguay) ────────
    const chacra1 = await prisma.chacra.upsert({
        where: { id: '00000000-0000-0000-0000-000000000010' },
        update: { centroLat: -33.2200, centroLng: -54.3750, ubicacionTextual: 'Ruta 18 km 312, Treinta y Tres' },
        create: {
            id: '00000000-0000-0000-0000-000000000010',
            nombre: 'Parcela Norte',
            descripcion: 'Parcela principal de arroz, sector norte',
            ubicacionTextual: 'Ruta 18 km 312, Treinta y Tres',
            superficie: 120,
            centroLat: -33.2200,
            centroLng: -54.3750,
            idOrganizacion: org.id,
        },
    });

    const chacra2 = await prisma.chacra.upsert({
        where: { id: '00000000-0000-0000-0000-000000000011' },
        update: { centroLat: -33.2450, centroLng: -54.3850, ubicacionTextual: 'Ruta 18 km 315, Treinta y Tres' },
        create: {
            id: '00000000-0000-0000-0000-000000000011',
            nombre: 'Parcela Sur',
            descripcion: 'Parcela secundaria, zona baja',
            ubicacionTextual: 'Ruta 18 km 315, Treinta y Tres',
            superficie: 85,
            centroLat: -33.2450,
            centroLng: -54.3850,
            idOrganizacion: org.id,
        },
    });

    const chacra3 = await prisma.chacra.upsert({
        where: { id: '00000000-0000-0000-0000-000000000012' },
        update: { centroLat: -33.2250, centroLng: -54.3500, ubicacionTextual: 'Camino Rural s/n, Treinta y Tres' },
        create: {
            id: '00000000-0000-0000-0000-000000000012',
            nombre: 'Parcela Este',
            descripcion: 'Parcela de expansion',
            ubicacionTextual: 'Camino Rural s/n, Treinta y Tres',
            superficie: 200,
            centroLat: -33.2250,
            centroLng: -54.3500,
            idOrganizacion: org.id,
        },
    });

    console.log('Chacras creadas:', chacra1.nombre, chacra2.nombre, chacra3.nombre);

    // ─── 8. Asignaciones de aguador a chacras ────────────────────────────────
    const uoAguador = await prisma.usuarioOrganizacion.findFirst({
        where: { idUsuario: aguador.id, idOrganizacion: org.id },
    });

    if (uoAguador) {
        for (const chacraId of [chacra1.id, chacra2.id]) {
            await prisma.usuarioChacra.upsert({
                where: { idChacra_idUsuarioOrganizacion: { idChacra: chacraId, idUsuarioOrganizacion: uoAguador.id } },
                update: {},
                create: { idChacra: chacraId, idUsuarioOrganizacion: uoAguador.id },
            });
        }
        console.log('Aguador asignado a:', chacra1.nombre, chacra2.nombre);
    }

    // ─── 9. Mapas publicados (con bounds para Leaflet ImageOverlay) ──────────
    // Bounds: [[swLat, swLng], [neLat, neLng]] — Leaflet LatLngBounds format
    const mapaData1 = {
        previewUrl: '/public/mock/ndvi-norte.png',
        metadataLiviana: {
            bounds: [[-33.2260, -54.3820], [-33.2140, -54.3680]],
        },
    };
    const mapa1 = await prisma.mapaPublicado.upsert({
        where: { id: '00000000-0000-0000-0000-000000000020' },
        update: mapaData1,
        create: {
            id: '00000000-0000-0000-0000-000000000020',
            idChacra: chacra1.id,
            idTipoMapa: tipoNDVI!.id,
            fechaMapa: new Date('2026-01-28'),
            fechaGeneracion: new Date('2026-01-28'),
            fechaPublicacion: new Date('2026-01-28'),
            estado: 'publicado',
            ...mapaData1,
        },
    });

    const mapaData2 = {
        previewUrl: '/public/mock/rgb-norte.png',
        metadataLiviana: {
            bounds: [[-33.2260, -54.3820], [-33.2140, -54.3680]],
        },
    };
    const mapa2 = await prisma.mapaPublicado.upsert({
        where: { id: '00000000-0000-0000-0000-000000000021' },
        update: mapaData2,
        create: {
            id: '00000000-0000-0000-0000-000000000021',
            idChacra: chacra1.id,
            idTipoMapa: tipoRGB!.id,
            fechaMapa: new Date('2026-01-28'),
            fechaGeneracion: new Date('2026-01-28'),
            fechaPublicacion: new Date('2026-01-28'),
            estado: 'publicado',
            ...mapaData2,
        },
    });

    const mapaData3 = {
        previewUrl: '/public/mock/ndvi-sur.png',
        metadataLiviana: {
            bounds: [[-33.2500, -54.3910], [-33.2400, -54.3790]],
        },
    };
    const mapa3 = await prisma.mapaPublicado.upsert({
        where: { id: '00000000-0000-0000-0000-000000000022' },
        update: mapaData3,
        create: {
            id: '00000000-0000-0000-0000-000000000022',
            idChacra: chacra2.id,
            idTipoMapa: tipoNDVI!.id,
            fechaMapa: new Date('2026-01-30'),
            fechaGeneracion: new Date('2026-01-30'),
            fechaPublicacion: new Date('2026-01-30'),
            estado: 'publicado',
            ...mapaData3,
        },
    });

    const mapaData4 = {
        previewUrl: '/public/mock/ndvi-este.png',
        metadataLiviana: {
            bounds: [[-33.2330, -54.3600], [-33.2170, -54.3400]],
        },
    };
    const mapa4 = await prisma.mapaPublicado.upsert({
        where: { id: '00000000-0000-0000-0000-000000000023' },
        update: mapaData4,
        create: {
            id: '00000000-0000-0000-0000-000000000023',
            idChacra: chacra3.id,
            idTipoMapa: tipoNDVI!.id,
            fechaMapa: new Date('2026-02-01'),
            fechaGeneracion: new Date('2026-02-01'),
            estado: 'borrador',
            ...mapaData4,
        },
    });

    console.log('Mapas creados:', [mapa1, mapa2, mapa3, mapa4].length);

    // ─── 10. Puntos de problema (coordenadas dentro de bounds de cada mapa) ──
    // coordenadaX = longitud, coordenadaY = latitud
    // Mapa1 NDVI Norte bounds: SW(-33.2260, -54.3820) NE(-33.2140, -54.3680)
    const punto1 = await prisma.puntoProblema.upsert({
        where: { id: '00000000-0000-0000-0000-000000000030' },
        update: { coordenadaX: -54.3720, coordenadaY: -33.2180 },
        create: {
            id: '00000000-0000-0000-0000-000000000030',
            idMapa: mapa1.id,
            coordenadaX: -54.3720,
            coordenadaY: -33.2180,
            idSeveridad: sevAlta!.id,
            descripcion: 'Anomalia espectral consistente con dano por insectos en sector noreste.',
            estado: 'pendiente',
        },
    });

    const punto2 = await prisma.puntoProblema.upsert({
        where: { id: '00000000-0000-0000-0000-000000000031' },
        update: { coordenadaX: -54.3780, coordenadaY: -33.2220 },
        create: {
            id: '00000000-0000-0000-0000-000000000031',
            idMapa: mapa1.id,
            coordenadaX: -54.3780,
            coordenadaY: -33.2220,
            idSeveridad: sevMedia!.id,
            descripcion: 'Zona con indice NDVI bajo, posible deficiencia de riego.',
            estado: 'en_revision',
        },
    });

    // Mapa3 NDVI Sur bounds: SW(-33.2500, -54.3910) NE(-33.2400, -54.3790)
    const punto3 = await prisma.puntoProblema.upsert({
        where: { id: '00000000-0000-0000-0000-000000000032' },
        update: { coordenadaX: -54.3850, coordenadaY: -33.2450 },
        create: {
            id: '00000000-0000-0000-0000-000000000032',
            idMapa: mapa3.id,
            coordenadaX: -54.3850,
            coordenadaY: -33.2450,
            idSeveridad: sevCritica!.id,
            descripcion: 'Area extensa con coloracion anomala. Posible falta de nitrogeno.',
            estado: 'pendiente',
        },
    });

    const punto4 = await prisma.puntoProblema.upsert({
        where: { id: '00000000-0000-0000-0000-000000000033' },
        update: { coordenadaX: -54.3830, coordenadaY: -33.2430 },
        create: {
            id: '00000000-0000-0000-0000-000000000033',
            idMapa: mapa3.id,
            coordenadaX: -54.3830,
            coordenadaY: -33.2430,
            idSeveridad: sevMedia!.id,
            descripcion: 'Crecimiento de maleza en zona sur de la parcela.',
            estado: 'descartado',
        },
    });

    const punto5 = await prisma.puntoProblema.upsert({
        where: { id: '00000000-0000-0000-0000-000000000034' },
        update: { coordenadaX: -54.3870, coordenadaY: -33.2470 },
        create: {
            id: '00000000-0000-0000-0000-000000000034',
            idMapa: mapa3.id,
            coordenadaX: -54.3870,
            coordenadaY: -33.2470,
            idSeveridad: sevAlta!.id,
            descripcion: 'Patron circular en analisis multiespectral, compatible con piricularia.',
            estado: 'pendiente',
        },
    });

    // Mapa1 NDVI Norte — punto resuelto
    const punto6 = await prisma.puntoProblema.upsert({
        where: { id: '00000000-0000-0000-0000-000000000035' },
        update: { coordenadaX: -54.3700, coordenadaY: -33.2200 },
        create: {
            id: '00000000-0000-0000-0000-000000000035',
            idMapa: mapa1.id,
            coordenadaX: -54.3700,
            coordenadaY: -33.2200,
            idSeveridad: sevBaja!.id,
            descripcion: 'Pequena zona con NDVI ligeramente bajo.',
            estado: 'resuelto',
        },
    });

    console.log('Puntos de problema creados:', 6);

    // ─── 11. Comentarios en puntos ───────────────────────────────────────────
    await prisma.comentarioPunto.upsert({
        where: { id: '00000000-0000-0000-0000-000000000040' },
        update: {},
        create: {
            id: '00000000-0000-0000-0000-000000000040',
            idPuntoProblema: punto1.id,
            idUsuario: admin.id,
            texto: 'Análisis confirma patrón de chinche. Recomendamos inspección urgente.',
        },
    });

    await prisma.comentarioPunto.upsert({
        where: { id: '00000000-0000-0000-0000-000000000041' },
        update: {},
        create: {
            id: '00000000-0000-0000-0000-000000000041',
            idPuntoProblema: punto2.id,
            idUsuario: aguador.id,
            texto: 'Revisé la zona, el canal de riego estaba parcialmente obstruido. Ya lo limpié.',
        },
    });

    await prisma.comentarioPunto.upsert({
        where: { id: '00000000-0000-0000-0000-000000000042' },
        update: {},
        create: {
            id: '00000000-0000-0000-0000-000000000042',
            idPuntoProblema: punto4.id,
            idUsuario: aguador.id,
            texto: 'Es vegetación nativa del borde, no afecta el cultivo. Marcado como no relevante.',
        },
    });

    await prisma.comentarioPunto.upsert({
        where: { id: '00000000-0000-0000-0000-000000000043' },
        update: {},
        create: {
            id: '00000000-0000-0000-0000-000000000043',
            idPuntoProblema: punto6.id,
            idUsuario: aguador.id,
            texto: 'Ajustado el aspersor. Problema resuelto.',
        },
    });

    console.log('Comentarios creados:', 4);

    // ─── 12. Historial de cambio de estado ───────────────────────────────────
    await prisma.historialPuntoProblema.upsert({
        where: { id: '00000000-0000-0000-0000-000000000050' },
        update: {},
        create: {
            id: '00000000-0000-0000-0000-000000000050',
            idPuntoProblema: punto2.id,
            idUsuario: aguador.id,
            estadoAnterior: 'pendiente',
            estadoNuevo: 'en_revision',
            observacion: 'Voy a ir a revisar la zona mañana.',
        },
    });

    await prisma.historialPuntoProblema.upsert({
        where: { id: '00000000-0000-0000-0000-000000000051' },
        update: {},
        create: {
            id: '00000000-0000-0000-0000-000000000051',
            idPuntoProblema: punto4.id,
            idUsuario: aguador.id,
            estadoAnterior: 'pendiente',
            estadoNuevo: 'descartado',
            observacion: 'No es un problema real, es vegetación nativa.',
        },
    });

    await prisma.historialPuntoProblema.upsert({
        where: { id: '00000000-0000-0000-0000-000000000052' },
        update: {},
        create: {
            id: '00000000-0000-0000-0000-000000000052',
            idPuntoProblema: punto6.id,
            idUsuario: aguador.id,
            estadoAnterior: 'pendiente',
            estadoNuevo: 'resuelto',
            observacion: 'Aspersor ajustado, problema solucionado.',
        },
    });

    console.log('Historial de estados creado:', 3);

    // ─── 13. Reportes mock ─────────────────────────────────────────────────
    await prisma.reporte.upsert({
        where: { id: '00000000-0000-0000-0000-000000000060' },
        update: { archivoUrl: '/public/mock/reportes/reporte-ndvi-norte-2026-01.pdf' },
        create: {
            id: '00000000-0000-0000-0000-000000000060',
            idChacra: chacra1.id,
            idMapa: mapa1.id,
            tipoReporte: 'NDVI',
            titulo: 'Analisis NDVI Parcela Norte - Enero 2026',
            resumen: 'Estado general saludable (NDVI prom. 0.72). 3 anomalias detectadas: dano por insectos (alta), deficiencia de riego (media), aspersor desalineado (baja, resuelto).',
            archivoUrl: '/public/mock/reportes/reporte-ndvi-norte-2026-01.pdf',
            estado: 'generado',
        },
    });

    await prisma.reporte.upsert({
        where: { id: '00000000-0000-0000-0000-000000000061' },
        update: { archivoUrl: '/public/mock/reportes/resumen-mensual-enero-2026.pdf' },
        create: {
            id: '00000000-0000-0000-0000-000000000061',
            idChacra: chacra1.id,
            tipoReporte: 'Resumen Mensual',
            titulo: 'Resumen Mensual de Monitoreo - Enero 2026',
            resumen: 'Cobertura de 405 ha en 3 parcelas. 4 mapas generados, 6 puntos de problema identificados. 1 resuelto, 1 descartado.',
            archivoUrl: '/public/mock/reportes/resumen-mensual-enero-2026.pdf',
            estado: 'generado',
        },
    });

    await prisma.reporte.upsert({
        where: { id: '00000000-0000-0000-0000-000000000062' },
        update: { archivoUrl: '/public/mock/reportes/reporte-sanidad-sur-2026-01.pdf' },
        create: {
            id: '00000000-0000-0000-0000-000000000062',
            idChacra: chacra2.id,
            idMapa: mapa3.id,
            tipoReporte: 'Sanidad',
            titulo: 'Reporte de Sanidad Vegetal Parcela Sur - Enero 2026',
            resumen: 'Estado fitosanitario requiere atencion. Deficiencia de nitrogeno critica en 4.2 ha, sospecha de piricularia en 1.5 ha.',
            archivoUrl: '/public/mock/reportes/reporte-sanidad-sur-2026-01.pdf',
            estado: 'generado',
        },
    });

    console.log('Reportes creados:', 3);

    console.log('\nSeed completado!');
    console.log('─────────────────────────────────────────');
    console.log('  admin@pluvia.com            / Admin1234!');
    console.log('  productor@pluvia.com        / Productor1234!');
    console.log('  aguador@pluvia.com          / Aguador1234!');
    console.log('  system@pluvia.internal      / PluvIA_System_2026!');
    console.log('─────────────────────────────────────────');
    console.log('\nDatos mock:');
    console.log('  3 chacras, 4 mapas, 6 puntos, 4 comentarios, 3 historial, 3 reportes');
    console.log('  Aguador asignado a Parcela Norte y Parcela Sur');
    console.log('  Service account (system) con rol admin para sync B2B');
    console.log('─────────────────────────────────────────');
}

main()
    .catch((e) => {
        console.error('Error en seed:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
