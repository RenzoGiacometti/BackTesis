import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTipoMapaDto, CreateSeveridadDto } from './dto/create-catalogo.dto';
import { UpdateTipoMapaDto, UpdateSeveridadDto } from './dto/update-catalogo.dto';

@Injectable()
export class CatalogosService {
    constructor(private readonly prisma: PrismaService) {}

    // ═══════════════════════════════════════════════════════════════════════
    //  TIPO MAPA
    // ═══════════════════════════════════════════════════════════════════════

    async createTipoMapa(dto: CreateTipoMapaDto) {
        const existe = await this.prisma.catalogoTipoMapa.findUnique({ where: { nombre: dto.nombre } });
        if (existe) throw new ConflictException(`Ya existe un tipo de mapa "${dto.nombre}"`);

        return this.prisma.catalogoTipoMapa.create({ data: dto });
    }

    async findAllTiposMapa() {
        return this.prisma.catalogoTipoMapa.findMany({
            where: { estado: 'activo' },
            orderBy: { nombre: 'asc' },
        });
    }

    async findOneTipoMapa(id: string) {
        const tipo = await this.prisma.catalogoTipoMapa.findUnique({ where: { id } });
        if (!tipo) throw new NotFoundException('Tipo de mapa no encontrado');
        return tipo;
    }

    async updateTipoMapa(id: string, dto: UpdateTipoMapaDto) {
        await this.findOneTipoMapa(id);
        return this.prisma.catalogoTipoMapa.update({ where: { id }, data: dto });
    }

    async deactivateTipoMapa(id: string) {
        await this.findOneTipoMapa(id);
        return this.prisma.catalogoTipoMapa.update({
            where: { id },
            data: { estado: 'inactivo' },
            select: { id: true, nombre: true, estado: true },
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  SEVERIDAD
    // ═══════════════════════════════════════════════════════════════════════

    async createSeveridad(dto: CreateSeveridadDto) {
        const existe = await this.prisma.catalogoSeveridad.findUnique({ where: { nombre: dto.nombre } });
        if (existe) throw new ConflictException(`Ya existe una severidad "${dto.nombre}"`);

        return this.prisma.catalogoSeveridad.create({ data: dto });
    }

    async findAllSeveridades() {
        return this.prisma.catalogoSeveridad.findMany({
            where: { estado: 'activo' },
            orderBy: { nivel: 'asc' },
        });
    }

    async findOneSeveridad(id: string) {
        const sev = await this.prisma.catalogoSeveridad.findUnique({ where: { id } });
        if (!sev) throw new NotFoundException('Severidad no encontrada');
        return sev;
    }

    async updateSeveridad(id: string, dto: UpdateSeveridadDto) {
        await this.findOneSeveridad(id);
        return this.prisma.catalogoSeveridad.update({ where: { id }, data: dto });
    }

    async deactivateSeveridad(id: string) {
        await this.findOneSeveridad(id);
        return this.prisma.catalogoSeveridad.update({
            where: { id },
            data: { estado: 'inactivo' },
            select: { id: true, nombre: true, estado: true },
        });
    }
}
