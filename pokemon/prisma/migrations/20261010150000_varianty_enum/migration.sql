-- Nové hodnoty enumu musí být v samostatné migraci (ALTER TYPE ... ADD VALUE nejde použít ve stejné transakci).
ALTER TYPE "Variant" ADD VALUE 'POKEBALL';
ALTER TYPE "Variant" ADD VALUE 'MASTERBALL';
