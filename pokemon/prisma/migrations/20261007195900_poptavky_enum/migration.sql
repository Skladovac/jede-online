-- Samostatně: novou hodnotu enumu nejde použít ve stejné transakci, kde vznikla.
ALTER TYPE "RequestStatus" ADD VALUE 'DRAFT';
