-- ====================================================================
-- DONA BENTA — SCHEMA OFICIAL TIDB (PingCAP / MySQL Compatible)
-- Compatível 100% com TiDB Serverless, TiDB Dedicated e MySQL 5.7 / 8.0
-- Contempla todas as tabelas, colunas do CodeIgniter 4 e do Frontend JS
-- ====================================================================

CREATE DATABASE IF NOT EXISTS dona_benta 
    CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci;

USE dona_benta;

-- ====================================================================
-- 1. TABELA: perfis (Usuários, Clientes, Administradores)
-- ====================================================================
CREATE TABLE IF NOT EXISTS perfis (
    id VARCHAR(255) NOT NULL,
    nome VARCHAR(255) DEFAULT NULL,
    email VARCHAR(255) DEFAULT NULL,
    senha_hash VARCHAR(255) DEFAULT NULL,
    telefone VARCHAR(50) DEFAULT NULL,
    cep VARCHAR(20) DEFAULT NULL,
    bairro VARCHAR(100) DEFAULT NULL,
    logradouro VARCHAR(255) DEFAULT NULL,
    numero VARCHAR(50) DEFAULT NULL,
    complemento VARCHAR(100) DEFAULT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'cliente',
    avatar_url TEXT DEFAULT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_perfis_email (email),
    INDEX idx_perfis_role (role),
    INDEX idx_perfis_telefone (telefone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS arquivos (
    bucket VARCHAR(40) NOT NULL,
    path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    conteudo LONGBLOB NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (bucket, path)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- 2. TABELA: produtos (Catálogo Oficial da Confeitaria)
-- ====================================================================
CREATE TABLE IF NOT EXISTS produtos (
    id VARCHAR(255) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    preco DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    estoque INT NOT NULL DEFAULT 999,
    imagem_url TEXT DEFAULT NULL,
    foto_url TEXT DEFAULT NULL,
    descricao_curta VARCHAR(500) DEFAULT NULL,
    descricao TEXT DEFAULT NULL,
    destaque TINYINT(1) NOT NULL DEFAULT 0,
    disponivel TINYINT(1) NOT NULL DEFAULT 1,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_produtos_categoria (categoria),
    INDEX idx_produtos_destaque (destaque),
    INDEX idx_produtos_disponivel (disponivel),
    INDEX idx_produtos_ativo (ativo),
    INDEX idx_produtos_criado_em (criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- 3. TABELA: pedidos (Pedidos, Encomendas e Pagamentos)
-- ====================================================================
CREATE TABLE IF NOT EXISTS pedidos (
    id VARCHAR(255) NOT NULL,
    numero_pedido VARCHAR(50) DEFAULT NULL,
    cliente_id VARCHAR(255) DEFAULT NULL,
    usuario_id VARCHAR(255) DEFAULT NULL,
    itens JSON DEFAULT NULL,
    valor_total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    tipo_entrega VARCHAR(50) NOT NULL DEFAULT 'retirada',
    endereco_entrega TEXT DEFAULT NULL,
    data_agendada DATE DEFAULT NULL,
    horario_agendado VARCHAR(50) DEFAULT NULL,
    data_entrega DATE DEFAULT NULL,
    horario_entrega VARCHAR(50) DEFAULT NULL,
    forma_pagamento VARCHAR(50) NOT NULL DEFAULT 'Pix',
    observacoes TEXT DEFAULT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'aguardando_confirmacao',
    pago TINYINT(1) NOT NULL DEFAULT 0,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_pedidos_cliente (cliente_id),
    INDEX idx_pedidos_usuario (usuario_id),
    INDEX idx_pedidos_numero (numero_pedido),
    INDEX idx_pedidos_status (status),
    INDEX idx_pedidos_pago (pago),
    INDEX idx_pedidos_data_agendada (data_agendada),
    INDEX idx_pedidos_criado_em (criado_em),
    CONSTRAINT chk_pedidos_valor_positivo CHECK (valor_total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- 4. TABELA: itens_pedido (Itens individuais do Pedido)
-- ====================================================================
CREATE TABLE IF NOT EXISTS itens_pedido (
    id BIGINT AUTO_INCREMENT NOT NULL,
    pedido_id VARCHAR(255) NOT NULL,
    produto_id VARCHAR(255) DEFAULT NULL,
    nome VARCHAR(255) DEFAULT NULL,
    nome_produto VARCHAR(255) DEFAULT NULL,
    quantidade INT NOT NULL DEFAULT 1,
    preco DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_itens_pedido (pedido_id),
    INDEX idx_itens_produto (produto_id),
    CONSTRAINT fk_itens_pedido_pedidos FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
    CONSTRAINT chk_itens_preco_positivo CHECK (preco >= 0 AND quantidade > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- 5. SEED INICIAL: PRODUTOS OFICIAIS DONA BENTA
-- ====================================================================
INSERT INTO produtos (
    id, nome, categoria, preco, estoque, 
    imagem_url, foto_url, descricao_curta, descricao, 
    destaque, disponivel, ativo
)
VALUES 
(
    'mod-1', 
    'Bolo de Chocolate com Ganache Belga', 
    'bolos', 
    89.90, 
    50, 
    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&q=80',
    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&q=80',
    'Camadas fofinhas de chocolate belga com ganache cremosa e raspas de cacau nobre.',
    'Massa fofa de cacau nobre recheada e coberta com autêntica ganache meio amargo.', 
    1, 1, 1
),
(
    'mod-2', 
    'Pão Artesanal de Fermentação Natural (Levain)', 
    'paes', 
    22.00, 
    100, 
    'https://images.unsplash.com/photo-1585478259715-876a6a81fc08?w=600&q=80',
    'https://images.unsplash.com/photo-1585478259715-876a6a81fc08?w=600&q=80',
    'Casca crocante e miolo macio, fermentado lentamente por 24 horas com levain natural.',
    'Casca dourada e crocante com miolo alveolado em fermentação lenta de 36 horas.', 
    1, 1, 1
),
(
    'mod-3', 
    'Caixa de Brigadeiros Gourmet (12 un)', 
    'doces', 
    45.00, 
    80, 
    'https://images.unsplash.com/photo-1548907040-4baa419dea28?w=600&q=80',
    'https://images.unsplash.com/photo-1548907040-4baa419dea28?w=600&q=80',
    'Doze brigadeiros artesanais em quatro sabores: tradicional belga, pistache, ninho e amêndoas.',
    'Seleção artesanal com brigadeiro tradicional belga, ninho com nutella e pistache.', 
    1, 1, 1
),
(
    'mod-4', 
    'Torta de Frango com Catupiry Artesanal', 
    'salgados', 
    68.00, 
    30, 
    'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&q=80',
    'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&q=80',
    'Massa amanteigada recheada com frango desfiado e catupiry cremoso. Serve até 6 pessoas.',
    'Massa podre tradicional que derrete na boca com recheio cremoso e peito de frango desfiado.', 
    1, 1, 1
),
(
    'mod-5', 
    'Croissants Amanteigados Tradicionais (4 un)', 
    'paes', 
    38.00, 
    40, 
    'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&q=80',
    'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&q=80',
    'Folhados com manteiga francesa, dourados por fora e macios por dentro. Vendidos em kit com 4 unidades.',
    'Folhados com manteiga pura de primeira linha, dourados por fora e macios por dentro.', 
    0, 1, 1
),
(
    'mod-6', 
    'Torta Holandesa Cremosa', 
    'tortas', 
    62.00, 
    25, 
    'https://images.unsplash.com/photo-1519340333755-56e9c1d04579?w=600&q=80',
    'https://images.unsplash.com/photo-1519340333755-56e9c1d04579?w=600&q=80',
    'Base crocante de biscoitos finos com creme suave de baunilha e generosa cobertura de ganache holandesa.',
    'Base crocante de biscoitos com creme aveludado de baunilha e cobertura de chocolate puro.', 
    1, 1, 1
),
(
    'mod-7', 
    'Empadão Rústico de Palmito', 
    'salgados', 
    58.00, 
    35, 
    'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&q=80',
    'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&q=80',
    'Recheio farto de palmito selecionado, azeitonas pretas e temperos da horta em massa que derrete na boca.',
    'Recheio cremoso de palmito selecionado, azeitonas e temperos verdes caseiros.', 
    0, 1, 1
),
(
    'mod-8', 
    'Bolo Caseiro de Cenoura com Chocolate', 
    'bolos', 
    55.00, 
    45, 
    'https://images.unsplash.com/photo-1621303837174-89787a7d4729?w=600&q=80',
    'https://images.unsplash.com/photo-1621303837174-89787a7d4729?w=600&q=80',
    'Receita tradicional de família com cenouras frescas e cobertura cravejada de chocolate meio amargo.',
    'Receita clássica de vó com calda quente e crocante de brigadeiro.', 
    1, 1, 1
)
ON DUPLICATE KEY UPDATE 
    nome = VALUES(nome),
    categoria = VALUES(categoria),
    preco = VALUES(preco),
    estoque = VALUES(estoque),
    imagem_url = VALUES(imagem_url),
    foto_url = VALUES(foto_url),
    descricao_curta = VALUES(descricao_curta),
    descricao = VALUES(descricao),
    destaque = VALUES(destaque),
    disponivel = VALUES(disponivel),
    ativo = VALUES(ativo);
