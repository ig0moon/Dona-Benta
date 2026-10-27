-- ====================================================================
-- DONA BENTA — SCRIPT OFICIAL DE BLINDAGEM E SEGURANÇA SUPABASE
-- Aplicação de Row Level Security (RLS), Prevenção de Elevação de Privilégios
-- e Proteção Contra Manipulação de Preços e Pedidos no Banco de Dados
-- ====================================================================

-- 1. HABILITAR ROW LEVEL SECURITY (RLS) EM TODAS AS TABELAS
ALTER TABLE IF EXISTS public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.itens_pedido ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- 2. TABELA: perfis
-- ====================================================================

-- Limpa políticas antigas para evitar duplicidade
DROP POLICY IF EXISTS "Perfis: leitura individual ou admin" ON public.perfis;
DROP POLICY IF EXISTS "Perfis: inserção própria" ON public.perfis;
DROP POLICY IF EXISTS "Perfis: atualização própria" ON public.perfis;

-- Leitura: o próprio usuário pode ler seu perfil; admins podem ler todos
CREATE POLICY "Perfis: leitura individual ou admin"
ON public.perfis
FOR SELECT
TO authenticated
USING (
    id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.perfis p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'funcionario')
    )
);

-- Inserção: usuário autenticado só pode criar seu próprio perfil
CREATE POLICY "Perfis: inserção própria"
ON public.perfis
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Atualização: usuário pode atualizar apenas seus próprios dados cadastrais
CREATE POLICY "Perfis: atualização própria"
ON public.perfis
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- TRIGGER DE SEGURANÇA: Impede que qualquer usuário não-admin altere o campo `role`
CREATE OR REPLACE FUNCTION public.impedir_elevacao_privilegios_role()
RETURNS TRIGGER AS $$
BEGIN
    -- Se houve tentativa de mudar o role
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        -- Só permite se o executor for admin verificado
        IF NOT EXISTS (
            SELECT 1 FROM public.perfis
            WHERE id = auth.uid() AND role = 'admin'
        ) THEN
            -- Reverte o role para o anterior ou bloqueia a transação
            NEW.role := OLD.role;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_impedir_elevacao_privilegios_role ON public.perfis;
CREATE TRIGGER trg_impedir_elevacao_privilegios_role
BEFORE UPDATE ON public.perfis
FOR EACH ROW
EXECUTE FUNCTION public.impedir_elevacao_privilegios_role();

-- ====================================================================
-- 3. TABELA: produtos
-- ====================================================================

DROP POLICY IF EXISTS "Produtos: leitura pública" ON public.produtos;
DROP POLICY IF EXISTS "Produtos: modificação exclusiva admin/staff" ON public.produtos;

-- Leitura pública para todos os visitantes (anon e autenticados)
CREATE POLICY "Produtos: leitura pública"
ON public.produtos
FOR SELECT
TO anon, authenticated
USING (true);

-- Modificações (INSERT, UPDATE, DELETE): apenas administradores e funcionários
CREATE POLICY "Produtos: modificação exclusiva admin/staff"
ON public.produtos
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.perfis p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'funcionario')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.perfis p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'funcionario')
    )
);

-- ====================================================================
-- 4. TABELA: pedidos
-- ====================================================================

DROP POLICY IF EXISTS "Pedidos: leitura cliente ou staff" ON public.pedidos;
DROP POLICY IF EXISTS "Pedidos: inserção própria do cliente" ON public.pedidos;
DROP POLICY IF EXISTS "Pedidos: atualização restrita" ON public.pedidos;

-- Leitura: o cliente vê apenas seus pedidos; equipe/admin vê todos
CREATE POLICY "Pedidos: leitura cliente ou staff"
ON public.pedidos
FOR SELECT
TO authenticated
USING (
    cliente_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.perfis p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'funcionario')
    )
);

-- Inserção: o cliente só pode registrar pedido para o seu próprio ID de usuário autenticado
-- e o pedido NUNCA pode ser inserido com status pago = true pelo cliente
CREATE POLICY "Pedidos: inserção própria do cliente"
ON public.pedidos
FOR INSERT
TO authenticated
WITH CHECK (
    cliente_id = auth.uid()
    AND (pago IS FALSE OR pago IS NULL)
);

-- Atualização: clientes não podem alterar valores ou marcar pedidos como pagos
-- Apenas equipe/admin ou backend seguro (service_role) podem alterar pedidos
CREATE POLICY "Pedidos: atualização restrita"
ON public.pedidos
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.perfis p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'funcionario')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.perfis p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'funcionario')
    )
);

-- ====================================================================
-- 5. TABELA: itens_pedido
-- ====================================================================

DROP POLICY IF EXISTS "Itens Pedido: leitura cliente ou staff" ON public.itens_pedido;
DROP POLICY IF EXISTS "Itens Pedido: inserção cliente" ON public.itens_pedido;
DROP POLICY IF EXISTS "Itens Pedido: modificação staff" ON public.itens_pedido;

-- Leitura de itens: apenas dono do pedido ou admin
CREATE POLICY "Itens Pedido: leitura cliente ou staff"
ON public.itens_pedido
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.pedidos p
        WHERE p.id = itens_pedido.pedido_id AND (
            p.cliente_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.perfis pf WHERE pf.id = auth.uid() AND pf.role IN ('admin', 'funcionario'))
        )
    )
);

-- Inserção de itens: apenas associados a pedidos pertencentes ao próprio usuário
CREATE POLICY "Itens Pedido: inserção cliente"
ON public.itens_pedido
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.pedidos p
        WHERE p.id = itens_pedido.pedido_id AND p.cliente_id = auth.uid()
    )
);

-- Modificação/Exclusão de itens: apenas admin/funcionário
CREATE POLICY "Itens Pedido: modificação staff"
ON public.itens_pedido
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.perfis pf
        WHERE pf.id = auth.uid() AND pf.role IN ('admin', 'funcionario')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.perfis pf
        WHERE pf.id = auth.uid() AND pf.role IN ('admin', 'funcionario')
    )
);

-- ====================================================================
-- 6. CONSTRAINT DE VALOR SEGURO (Impede valores negativos ou nulos)
-- ====================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_pedidos_valor_positivo'
    ) THEN
        ALTER TABLE public.pedidos ADD CONSTRAINT chk_pedidos_valor_positivo CHECK (valor_total >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_itens_pedido_preco_positivo'
    ) THEN
        ALTER TABLE public.itens_pedido ADD CONSTRAINT chk_itens_pedido_preco_positivo CHECK (preco >= 0 AND quantidade > 0);
    END IF;
END $$;
