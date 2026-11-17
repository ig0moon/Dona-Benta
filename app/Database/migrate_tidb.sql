-- Run once on an existing TiDB database to enable native account passwords and image storage.
ALTER TABLE perfis ADD COLUMN IF NOT EXISTS senha_hash VARCHAR(255) DEFAULT NULL;
UPDATE perfis SET email = NULL, role = 'cliente' WHERE id = 'admin-dona-benta' AND senha_hash IS NULL;

CREATE TABLE IF NOT EXISTS arquivos (
    bucket VARCHAR(40) NOT NULL,
    path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    conteudo LONGBLOB NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (bucket, path)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Número do pedido único (o servidor passou a gerar o número; o índice impede repetição).
-- 1) Antes, confira se já existem números repetidos. Se a consulta abaixo retornar linhas,
--    corrija esses pedidos (ou deixe numero_pedido = NULL neles) antes do passo 2.
--    SELECT numero_pedido, COUNT(*) FROM pedidos WHERE numero_pedido IS NOT NULL GROUP BY numero_pedido HAVING COUNT(*) > 1;
-- 2) Troque o índice comum pelo índice único:
ALTER TABLE pedidos DROP INDEX IF EXISTS idx_pedidos_numero;
ALTER TABLE pedidos ADD UNIQUE INDEX IF NOT EXISTS uq_pedidos_numero (numero_pedido);
