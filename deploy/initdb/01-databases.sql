-- Spustí se JEN při prvním vytvoření volume pgdata.
-- Oddělené databáze: landing a CVMS se nesmí míchat.
CREATE DATABASE jede_landing;
CREATE DATABASE cvms;
