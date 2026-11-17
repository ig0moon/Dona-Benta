<?php

namespace App\Services;

use Throwable;

class TiDBStoreService
{
    public function isValidPedidoId(?string $id): bool
    {
        return is_string($id) && (bool) preg_match('/^[a-zA-Z0-9-]{8,45}$/', trim($id));
    }

    public function consultarPedido(string $pedidoId, ?string $userAuthHeader = null): ?array
    {
        if (!$this->isValidPedidoId($pedidoId)) {
            return null;
        }

        try {
            return db_connect()->table('pedidos')
                ->select('id, cliente_id, usuario_id, valor_total, status, pago')
                ->where('id', $pedidoId)
                ->get()
                ->getRowArray() ?: null;
        } catch (Throwable $exception) {
            log_message('error', 'Falha ao consultar pedido no TiDB ({exception}).', ['exception' => $exception::class]);
            return null;
        }
    }

    public function calcularValorRealPedido(string $pedidoId, ?string $userAuthHeader = null): ?float
    {
        if (!$this->isValidPedidoId($pedidoId)) {
            return null;
        }

        try {
            $items = db_connect()->table('itens_pedido i')
                ->select('i.quantidade, p.preco')
                ->join('produtos p', 'p.id = i.produto_id')
                ->where('i.pedido_id', $pedidoId)
                ->where('p.ativo', 1)
                ->where('p.disponivel', 1)
                ->get()
                ->getResultArray();
            if ($items === []) {
                return null;
            }

            $total = 0.0;
            foreach ($items as $item) {
                $quantity = (int) $item['quantidade'];
                if ($quantity < 1) {
                    return null;
                }
                $total += $quantity * (float) $item['preco'];
            }
            return round($total, 2);
        } catch (Throwable $exception) {
            log_message('error', 'Falha ao recalcular pedido no TiDB ({exception}).', ['exception' => $exception::class]);
            return null;
        }
    }

    public function obterPerfilUsuario(string $userId, ?string $userAuthHeader = null): ?array
    {
        try {
            return db_connect()->table('perfis')
                ->select('id, nome, role')
                ->where('id', $userId)
                ->get()
                ->getRowArray() ?: null;
        } catch (Throwable $exception) {
            log_message('error', 'Falha ao consultar perfil no TiDB ({exception}).', ['exception' => $exception::class]);
            return null;
        }
    }

    /**
     * Marca o pedido como "aguardando pagamento" sem nunca desfazer um pagamento já confirmado.
     * A condição pago = 0 fica no próprio UPDATE, então uma resposta "pendente" que chega depois
     * da aprovação (outra tentativa ou o webhook) não consegue voltar o pedido para não pago.
     *
     * @return string 'atualizado' | 'ja_pago' | 'erro'
     */
    public function registrarPagamentoPendente(string $pedidoId, string $formaPagamento): string
    {
        if (!$this->isValidPedidoId($pedidoId)) {
            return 'erro';
        }

        try {
            $db = db_connect();
            $ok = $db->table('pedidos')
                ->where('id', $pedidoId)
                ->where('pago', 0)
                ->update([
                    'forma_pagamento' => $formaPagamento,
                    'status'          => 'aguardando_confirmacao',
                    'pago'            => 0,
                ]);
            if (!$ok) {
                return 'erro';
            }
            if ($db->affectedRows() > 0) {
                return 'atualizado';
            }
            // Nenhuma linha mudou: ou o pedido já está pago, ou já estava exatamente assim.
            $pedido = $this->consultarPedido($pedidoId);
            if ($pedido === null) {
                return 'erro';
            }
            return !empty($pedido['pago']) ? 'ja_pago' : 'atualizado';
        } catch (Throwable $exception) {
            log_message('error', 'Falha ao registrar pagamento pendente no TiDB ({exception}).', ['exception' => $exception::class]);
            return 'erro';
        }
    }

    public function atualizarPedido(string $pedidoId, array $dados, ?string $userAuthHeader = null): bool
    {
        $allowed = ['valor_total', 'forma_pagamento', 'status', 'pago'];
        $updates = array_intersect_key($dados, array_flip($allowed));
        if (!$this->isValidPedidoId($pedidoId) || $updates === []) {
            return false;
        }

        try {
            return db_connect()->table('pedidos')->where('id', $pedidoId)->update($updates);
        } catch (Throwable $exception) {
            log_message('error', 'Falha ao atualizar pedido no TiDB ({exception}).', ['exception' => $exception::class]);
            return false;
        }
    }
}
