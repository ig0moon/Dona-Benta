<?php

namespace App\Services;

class SupabaseService
{
    protected string $url;
    protected string $anonKey;
    protected string $serviceRoleKey;

    public function __construct()
    {
        $this->url            = rtrim(env('SUPABASE_URL', 'https://nxigfuivadxjotlqrwux.supabase.co'), '/');
        $this->anonKey        = env('SUPABASE_ANON_KEY', '');
        $this->serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY', '');
    }

    /**
     * Valida formato do UUID do pedido
     */
    public function isValidPedidoId(?string $id): bool
    {
        if (empty($id)) {
            return false;
        }
        return (bool) preg_match('/^[0-9a-fA-F-]{8,45}$/', trim($id));
    }

    /**
     * Consulta pedido no Supabase para verificação segura de valor (anti price-tampering)
     */
    public function consultarPedido(string $pedidoId, ?string $userAuthHeader = null): ?array
    {
        if (!$this->isValidPedidoId($pedidoId)) {
            return null;
        }

        try {
            $apiKey = !empty($this->serviceRoleKey) ? $this->serviceRoleKey : $this->anonKey;
            $authBearer = !empty($this->serviceRoleKey) 
                ? "Bearer {$this->serviceRoleKey}" 
                : ($userAuthHeader ?? "Bearer {$this->anonKey}");

            $endpoint = "{$this->url}/rest/v1/pedidos?id=eq." . urlencode($pedidoId) . "&select=id,cliente_id,valor_total,status,pago";

            $ch = curl_init($endpoint);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => [
                    "apikey: {$apiKey}",
                    "Authorization: {$authBearer}",
                    "Content-Type: application/json"
                ],
                CURLOPT_TIMEOUT => 6,
                CURLOPT_SSL_VERIFYPEER => true
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $err = curl_error($ch);
            curl_close($ch);

            if ($err || $httpCode < 200 || $httpCode >= 300) {
                log_message('warning', "[Supabase] Falha ao consultar pedido {$pedidoId}: {$err} (HTTP {$httpCode})");
                return null;
            }

            $data = json_decode($response, true);
            if (is_array($data) && count($data) > 0) {
                return $data[0];
            }

            return null;
        } catch (\Throwable $e) {
            log_message('error', '[Supabase] Erro ao consultar pedido: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Calcula o valor real e autoritativo do pedido a partir dos preços oficiais cadastrados em `produtos`
     * Previne qualquer manipulação de preço pelo frontend ou localStorage
     */
    public function calcularValorRealPedido(string $pedidoId, ?string $userAuthHeader = null): ?float
    {
        if (!$this->isValidPedidoId($pedidoId)) {
            return null;
        }

        try {
            $apiKey = !empty($this->serviceRoleKey) ? $this->serviceRoleKey : $this->anonKey;
            $authBearer = !empty($this->serviceRoleKey) 
                ? "Bearer {$this->serviceRoleKey}" 
                : ($userAuthHeader ?? "Bearer {$this->anonKey}");

            // 1. Busca os itens cadastrados no pedido
            $endpointItens = "{$this->url}/rest/v1/itens_pedido?pedido_id=eq." . urlencode($pedidoId) . "&select=produto_id,quantidade,preco";
            $ch = curl_init($endpointItens);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => [
                    "apikey: {$apiKey}",
                    "Authorization: {$authBearer}",
                    "Content-Type: application/json"
                ],
                CURLOPT_TIMEOUT => 6,
                CURLOPT_SSL_VERIFYPEER => true
            ]);
            $resItens = curl_exec($ch);
            $httpCodeItens = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCodeItens < 200 || $httpCodeItens >= 300) {
                return null;
            }

            $itens = json_decode($resItens, true);
            if (!is_array($itens) || empty($itens)) {
                return null;
            }

            // 2. Extrai IDs dos produtos
            $produtoIds = [];
            foreach ($itens as $item) {
                if (!empty($item['produto_id'])) {
                    $produtoIds[] = (string)$item['produto_id'];
                }
            }

            if (empty($produtoIds)) {
                return null;
            }

            // 3. Busca os preços oficiais no catálogo de produtos
            $idsParam = implode(',', array_map('urlencode', array_unique($produtoIds)));
            $endpointProds = "{$this->url}/rest/v1/produtos?id=in.({$idsParam})&select=id,preco";
            $ch = curl_init($endpointProds);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => [
                    "apikey: {$apiKey}",
                    "Authorization: {$authBearer}",
                    "Content-Type: application/json"
                ],
                CURLOPT_TIMEOUT => 6,
                CURLOPT_SSL_VERIFYPEER => true
            ]);
            $resProds = curl_exec($ch);
            $httpCodeProds = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            $precosOficiais = [];
            if ($httpCodeProds >= 200 && $httpCodeProds < 300) {
                $produtos = json_decode($resProds, true);
                if (is_array($produtos)) {
                    foreach ($produtos as $p) {
                        $precosOficiais[(string)$p['id']] = (float)$p['preco'];
                    }
                }
            }

            // 4. Calcula a soma autoritativa
            $totalAutoritativo = 0.0;
            foreach ($itens as $item) {
                $qtd = max(1, (int)($item['quantidade'] ?? 1));
                $pId = (string)($item['produto_id'] ?? '');
                $precoUnit = isset($precosOficiais[$pId]) ? $precosOficiais[$pId] : (float)($item['preco'] ?? 0);
                $totalAutoritativo += ($qtd * $precoUnit);
            }

            return round($totalAutoritativo, 2);
        } catch (\Throwable $e) {
            log_message('error', '[Supabase] Erro ao recalcular valor real do pedido: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Verifica perfil do usuário autenticado no Supabase
     */
    public function obterPerfilUsuario(string $userId, ?string $userAuthHeader = null): ?array
    {
        if (empty($userId)) return null;

        try {
            $apiKey = !empty($this->serviceRoleKey) ? $this->serviceRoleKey : $this->anonKey;
            $authBearer = !empty($this->serviceRoleKey) 
                ? "Bearer {$this->serviceRoleKey}" 
                : ($userAuthHeader ?? "Bearer {$this->anonKey}");

            $endpoint = "{$this->url}/rest/v1/perfis?id=eq." . urlencode($userId) . "&select=id,nome,role";
            $ch = curl_init($endpoint);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => [
                    "apikey: {$apiKey}",
                    "Authorization: {$authBearer}",
                    "Content-Type: application/json"
                ],
                CURLOPT_TIMEOUT => 6,
                CURLOPT_SSL_VERIFYPEER => true
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode >= 200 && $httpCode < 300) {
                $data = json_decode($response, true);
                if (is_array($data) && count($data) > 0) {
                    return $data[0];
                }
            }
            return null;
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * Atualiza dados de pagamento e status do pedido no Supabase
     */
    public function atualizarPedido(string $pedidoId, array $dados, ?string $userAuthHeader = null): bool
    {
        if (!$this->isValidPedidoId($pedidoId)) {
            return false;
        }

        try {
            $apiKey = !empty($this->serviceRoleKey) ? $this->serviceRoleKey : $this->anonKey;
            $authBearer = !empty($this->serviceRoleKey) 
                ? "Bearer {$this->serviceRoleKey}" 
                : ($userAuthHeader ?? "Bearer {$this->anonKey}");

            $endpoint = "{$this->url}/rest/v1/pedidos?id=eq." . urlencode($pedidoId);

            $ch = curl_init($endpoint);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_CUSTOMREQUEST => 'PATCH',
                CURLOPT_POSTFIELDS => json_encode($dados),
                CURLOPT_HTTPHEADER => [
                    "apikey: {$apiKey}",
                    "Authorization: {$authBearer}",
                    "Content-Type: application/json",
                    "Prefer: return=representation"
                ],
                CURLOPT_TIMEOUT => 6,
                CURLOPT_SSL_VERIFYPEER => true
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $err = curl_error($ch);
            curl_close($ch);

            if ($err || $httpCode < 200 || $httpCode >= 300) {
                log_message('warning', "[Supabase] Aviso ao atualizar pedido {$pedidoId}: {$err} (HTTP {$httpCode}) - {$response}");
                return false;
            }

            log_message('info', "[Supabase] Pedido {$pedidoId} atualizado com sucesso.");
            return true;
        } catch (\Throwable $e) {
            log_message('error', '[Supabase] Erro ao atualizar pedido: ' . $e->getMessage());
            return false;
        }
    }
}
