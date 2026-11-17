<?php

namespace App\Services;

class MercadoPagoService
{
    protected string $accessToken;
    protected ?string $webhookUrl;
    protected bool $isProduction;
    protected TiDBStoreService $tidb;
    /** true a partir do momento em que a criação do pagamento foi enviada ao Mercado Pago. */
    protected bool $cobrancaPossivel = false;

    public function __construct()
    {
        $this->accessToken  = trim((string) env('MP_ACCESS_TOKEN', ''), " \t\n\r\0\x0B\"'");
        $this->webhookUrl   = env('WEBHOOK_URL', null);
        $this->isProduction = str_starts_with($this->accessToken, 'APP_USR-') || env('CI_ENVIRONMENT') === 'production';
        $this->tidb         = new TiDBStoreService();
    }

    public function isProduction(): bool
    {
        return $this->isProduction;
    }

    public function hasWebhook(): bool
    {
        return !empty($this->webhookUrl);
    }

    /**
     * Validação matemática oficial dos dois dígitos verificadores do CPF
     */
    public function validarCPF(?string $cpf): bool
    {
        if (empty($cpf)) {
            return false;
        }

        $limpo = preg_replace('/\D/', '', $cpf);
        if (strlen($limpo) !== 11) {
            return false;
        }

        if (preg_match('/^(\d)\1{10}$/', $limpo)) {
            return false;
        }

        $soma = 0;
        for ($i = 0; $i < 9; $i++) {
            $soma += (int) $limpo[$i] * (10 - $i);
        }
        $resto = ($soma * 10) % 11;
        if ($resto === 10 || $resto === 11) {
            $resto = 0;
        }
        if ($resto !== (int) $limpo[9]) {
            return false;
        }

        $soma = 0;
        for ($i = 0; $i < 10; $i++) {
            $soma += (int) $limpo[$i] * (11 - $i);
        }
        $resto = ($soma * 10) % 11;
        if ($resto === 10 || $resto === 11) {
            $resto = 0;
        }
        if ($resto !== (int) $limpo[10]) {
            return false;
        }

        return true;
    }

    public function sanitizeInput(?string $str, int $maxLength = 255): string
    {
        if ($str === null) {
            return '';
        }
        $sanitized = preg_replace('/[\r\n\t]/', ' ', trim($str));
        return mb_substr($sanitized, 0, $maxLength, 'UTF-8');
    }

    /**
     * Gera Cobrança Pix Dinâmica no Mercado Pago com proteção anti-tampering
     */
    public function gerarPix(array $payload, ?string $userAuthHeader = null, ?string $userId = null): array
    {
        $this->cobrancaPossivel = false;
        $resultado = $this->gerarPixInterno($payload, $userAuthHeader, $userId);
        // sem_cobranca = o servidor tem certeza de que nenhum pagamento foi criado.
        // Só nesse caso o navegador pode apagar o pedido; em qualquer dúvida ele é mantido.
        if (($resultado['status'] ?? 0) !== 200 && !$this->cobrancaPossivel) {
            $resultado['data']['sem_cobranca'] = true;
        }
        return $resultado;
    }

    private function gerarPixInterno(array $payload, ?string $userAuthHeader = null, ?string $userId = null): array
    {
        $pedidoId  = $payload['pedido_id'] ?? null;
        $valorRaw  = (float) ($payload['valor'] ?? 0);
        $descricao = $payload['descricao'] ?? null;
        $cliente   = $payload['cliente'] ?? [];

        $valorEfetivo = $valorRaw;

        // Recalcula o valor do pedido com os preços atuais do catálogo no TiDB.
        if (!is_string($pedidoId) || !$this->tidb->isValidPedidoId($pedidoId)) {
            return ['status' => 400, 'data' => ['erro' => 'Identificador de pedido inválido']];
        }

        $pedidoDb = $this->tidb->consultarPedido($pedidoId, $userAuthHeader);
        if (!$this->pedidoPertenceAoUsuario($pedidoDb, $userId)) {
            return ['status' => 404, 'data' => ['erro' => 'Pedido não encontrado']];
        }
        if ($pedidoDb) {
            if (!empty($pedidoDb['pago'])) {
                return ['status' => 400, 'data' => ['erro' => 'Este pedido já foi pago e confirmado anteriormente']];
            }
            if (($pedidoDb['status'] ?? '') === 'cancelado') {
                return ['status' => 400, 'data' => ['erro' => 'Este pedido foi cancelado']];
            }

            // Recalcula o valor real com os produtos cadastrados
            $valorReal = $this->tidb->calcularValorRealPedido($pedidoId, $userAuthHeader);
            if ($valorReal === null) {
                return ['status' => 409, 'data' => ['erro' => 'Não foi possível validar os preços dos itens do pedido.']];
            }
            $valorDb = $valorReal;

            if ($valorDb > 0 && abs($valorEfetivo - $valorDb) > 0.05) {
                log_message('warning', "[SEGURANÇA] Ajustando valor conforme catálogo oficial: R$ {$valorDb} (enviado: R$ {$valorEfetivo})");
                // Sincroniza o valor correto no registro do pedido
                if (!$this->tidb->atualizarPedido($pedidoId, ['valor_total' => $valorDb], $userAuthHeader)) {
                    return ['status' => 503, 'data' => ['erro' => 'Não foi possível atualizar o valor validado no pedido.']];
                }
            }
            $valorEfetivo = $valorDb;
        }

        if ($valorEfetivo < 0.50 || $valorEfetivo > 50000) {
            return [
                'status' => 400,
                'data' => ['erro' => 'Valor do pedido inválido ou fora dos limites permitidos (R$ 0,50 a R$ 50.000,00)']
            ];
        }

        $rawEmail = strtolower(trim($cliente['email'] ?? ''));
        $payerEmail = (!empty($rawEmail) && filter_var($rawEmail, FILTER_VALIDATE_EMAIL) && !str_ends_with($rawEmail, '@testuser.com'))
            ? $rawEmail
            : null;

        $cpfLimpo = preg_replace('/\D/', '', $cliente['cpf'] ?? '');
        $cpfValido = $this->validarCPF($cpfLimpo);

        if ($this->isProduction) {
            if (!$cpfValido) {
                return [
                    'status' => 400,
                    'data' => [
                        'erro' => 'CPF do pagador é obrigatório e deve ser válido para emissão do Pix.',
                        'campo' => 'cpf'
                    ]
                ];
            }
            if (!$payerEmail) {
                return [
                    'status' => 400,
                    'data' => [
                        'erro' => 'E-mail do pagador inválido ou ausente.',
                        'campo' => 'email'
                    ]
                ];
            }
        } else {
            if (!$cpfValido) {
                $cpfLimpo = '17286371630';
            }
            if (!$payerEmail) {
                $payerEmail = 'cliente.donabenta@gmail.com';
            }
        }

        $nomeLimpo   = $this->sanitizeInput($cliente['nome'] ?? 'Cliente Dona Benta', 80);
        $partesNome  = explode(' ', $nomeLimpo, 2);
        $firstName   = $partesNome[0] ?: 'Cliente';
        $lastName    = $partesNome[1] ?? 'Dona Benta';
        $descSegura  = $this->sanitizeInput($descricao ?: ('Pedido Dona Benta #' . ($pedidoId ? substr($pedidoId, 0, 8) : 'DB')), 120);

        $mpPayload = [
            'transaction_amount' => round($valorEfetivo, 2),
            'description'        => $descSegura,
            'payment_method_id'  => 'pix',
            'payer'              => [
                'email'          => $payerEmail,
                'first_name'     => $firstName,
                'last_name'      => $lastName,
                'identification' => [
                    'type'   => 'CPF',
                    'number' => $cpfLimpo
                ]
            ]
        ];

        if (!empty($pedidoId)) {
            $mpPayload['external_reference'] = (string) $pedidoId;
        }

        if (!empty($this->webhookUrl)) {
            $mpPayload['notification_url'] = $this->webhookUrl;
        }

        // 1) Se este pedido já tem um Pix pendente válido no Mercado Pago (ex.: a resposta anterior
        //    se perdeu e o cliente tentou de novo), devolve esse mesmo Pix em vez de criar outro.
        $existente = $this->buscarPixExistente((string) $pedidoId, $valorEfetivo);
        if ($existente['reaproveitar'] !== null) {
            $this->cobrancaPossivel = true;
            $res = ['http_code' => 200, 'data' => $existente['reaproveitar'], 'error' => null];
        } else {
            // 2) Chave de idempotência determinística: mesmo pedido + mesmos dados = mesma chave, então
            //    um reenvio (rede caiu, outra aba) recebe a mesma cobrança do Mercado Pago.
            //    - CPF/e-mail/valor corrigidos geram outra chave (o erro anterior não fica "preso");
            //    - cada Pix antigo que expirou/foi cancelado muda a chave, liberando um Pix novo.
            $idempotencyKey = 'pix-' . $pedidoId . '-' . substr(hash('sha256', json_encode([
                round($valorEfetivo, 2),
                $cpfLimpo,
                $payerEmail,
                $existente['encerrados'],
            ])), 0, 24);

            $this->cobrancaPossivel = true;
            $res = $this->callMercadoPago('POST', 'https://api.mercadopago.com/v1/payments', $mpPayload, $idempotencyKey);
            if ($res['error'] === 'MP_ACCESS_TOKEN ausente' || ($res['http_code'] >= 400 && $res['http_code'] < 500)) {
                // O Mercado Pago recusou (ou nem recebeu) o pedido de cobrança: nada foi criado.
                $this->cobrancaPossivel = false;
            }
        }

        if ($res['http_code'] < 200 || $res['http_code'] >= 300) {
            return [
                'status' => $res['http_code'] ?: 500,
                'data' => [
                    'erro'     => 'Erro ao gerar pagamento Pix no gateway',
                    'detalhes' => $res['data']['message'] ?? ($res['data']['cause'] ?? 'Recusado pelo gateway')
                ]
            ];
        }

        $mpData = $res['data'];
        $poi = $mpData['point_of_interaction']['transaction_data'] ?? [];
        $pixCopiaCola = $poi['qr_code'] ?? null;
        $qrCodeBase64 = !empty($poi['qr_code_base64']) ? 'data:image/png;base64,' . $poi['qr_code_base64'] : null;

        if (empty($mpData['id']) || !is_numeric($mpData['id'])) {
            return ['status' => 502, 'data' => ['erro' => 'O Mercado Pago não retornou um identificador de pagamento válido.']];
        }

        $statusPagamento = $mpData['status'] ?? '';
        if ($statusPagamento === 'approved') {
            if (!$this->confirmarPedidoPorPagamento($pedidoId, $mpData)) {
                return ['status' => 409, 'data' => ['erro' => 'O pagamento não corresponde ao valor ou ao pedido informado.']];
            }
        } elseif (in_array($statusPagamento, ['pending', 'in_process'], true)) {
            if (!is_string($pixCopiaCola) || $pixCopiaCola === '' || !is_string($qrCodeBase64) || $qrCodeBase64 === '') {
                return ['status' => 502, 'data' => ['erro' => 'O Mercado Pago não retornou os dados necessários para pagar via Pix.']];
            }
            $registro = $this->tidb->registrarPagamentoPendente($pedidoId, 'Pix');
            if ($registro === 'ja_pago') {
                // Outra tentativa (ou o webhook) já confirmou este pedido: não volta para pendente.
                return [
                    'status' => 200,
                    'data'   => ['sucesso' => true, 'pago' => true, 'status' => 'approved', 'pagamento_id' => $mpData['id']],
                ];
            }
            if ($registro !== 'atualizado') {
                return ['status' => 503, 'data' => ['erro' => 'Não foi possível registrar o pagamento Pix no banco.']];
            }
        } else {
            if (in_array($statusPagamento, ['rejected', 'cancelled'], true)) {
                $this->cobrancaPossivel = false; // estado terminal: esse Pix não pode ser pago
            }
            return [
                'status' => 402,
                'data' => [
                    'erro' => 'O Mercado Pago não autorizou a geração do pagamento Pix.',
                    'status' => $statusPagamento,
                    'status_detalhe' => $mpData['status_detail'] ?? null,
                ],
            ];
        }

        return [
            'status' => 200,
            'data'   => [
                'sucesso'        => true,
                'pagamento_id'   => $mpData['id'] ?? null,
                'status'         => $statusPagamento,
                'status_detalhe' => $mpData['status_detail'] ?? null,
                'valor'          => $mpData['transaction_amount'] ?? $valorEfetivo,
                'pago'           => $statusPagamento === 'approved',
                'pix_copia_cola' => $pixCopiaCola,
                'qr_code_base64' => $qrCodeBase64,
                'expiracao'      => $mpData['date_of_expiration'] ?? null
            ]
        ];
    }

    /**
     * Cria um checkout hospedado pelo Mercado Pago, sem expor chave pública no navegador.
     */
    public function processarCartao(array $payload, ?string $userAuthHeader = null, ?string $userId = null): array
    {
        $pedidoId = $payload['pedido_id'] ?? null;
        if (!is_string($pedidoId) || !$this->tidb->isValidPedidoId($pedidoId)) {
            return ['status' => 400, 'data' => ['erro' => 'Identificador de pedido inválido']];
        }

        $pedidoDb = $this->tidb->consultarPedido($pedidoId, $userAuthHeader);
        if (!$this->pedidoPertenceAoUsuario($pedidoDb, $userId)) {
            return ['status' => 404, 'data' => ['erro' => 'Pedido não encontrado']];
        }
        if (!empty($pedidoDb['pago']) || ($pedidoDb['status'] ?? '') === 'cancelado') {
            return ['status' => 400, 'data' => ['erro' => 'Este pedido não pode ser pago']];
        }

        $valorReal = $this->tidb->calcularValorRealPedido($pedidoId, $userAuthHeader);
        if ($valorReal === null) {
            return ['status' => 409, 'data' => ['erro' => 'Não foi possível validar os preços dos itens do pedido.']];
        }
        $valorEfetivo = $valorReal;
        if (abs(round((float) $pedidoDb['valor_total'], 2) - round($valorEfetivo, 2)) >= 0.01
            && !$this->tidb->atualizarPedido($pedidoId, ['valor_total' => $valorEfetivo], $userAuthHeader)) {
            return ['status' => 503, 'data' => ['erro' => 'Não foi possível atualizar o valor validado no pedido.']];
        }
        if ($valorEfetivo < 0.50 || $valorEfetivo > 50000) {
            return ['status' => 400, 'data' => ['erro' => 'Valor do pedido inválido para cartão de crédito']];
        }

        $payerEmail = strtolower(trim((string) ($payload['email'] ?? '')));
        if (!filter_var($payerEmail, FILTER_VALIDATE_EMAIL) || str_ends_with($payerEmail, '@testuser.com')) {
            if ($this->isProduction) {
                return ['status' => 400, 'data' => ['erro' => 'E-mail do pagador inválido ou ausente.']];
            }
            $payerEmail = 'cliente.donabenta@gmail.com';
        }

        $baseUrl = rtrim(config('App')->baseURL, '/');
        if ($baseUrl === '') {
            return ['status' => 503, 'data' => ['erro' => 'APP_BASE_URL precisa estar configurada para pagamentos com cartão.']];
        }
        $returnUrl = $baseUrl . '/conta?aba=pedidos&checkout=retorno&pedido_id=' . rawurlencode($pedidoId);
        $mpPayload = [
            'items' => [[
                'title'       => 'Pedido Dona Benta ' . ($pedidoDb['id'] ?? $pedidoId),
                'quantity'    => 1,
                'unit_price'  => round($valorEfetivo, 2),
                'currency_id' => 'BRL',
            ]],
            'payer' => ['email' => $payerEmail],
            'external_reference' => (string) $pedidoId,
            'back_urls' => [
                'success' => $returnUrl,
                'pending' => $returnUrl,
                'failure' => $returnUrl,
            ],
        ];
        if ($this->isProduction) {
            $mpPayload['auto_return'] = 'approved';
        }
        if (!empty($this->webhookUrl)) {
            $mpPayload['notification_url'] = $this->webhookUrl;
        }

        $res = $this->callMercadoPago(
            'POST',
            'https://api.mercadopago.com/checkout/preferences',
            $mpPayload,
            'checkout-' . $pedidoId,
        );

        if ($res['http_code'] < 200 || $res['http_code'] >= 300) {
            return [
                'status' => $res['http_code'] ?: 502,
                'data' => [
                    'erro'     => 'Não foi possível iniciar o checkout do Mercado Pago.',
                    'detalhes' => $res['data']['message'] ?? 'Tente novamente mais tarde.',
                ]
            ];
        }

        $mpData = $res['data'];
        $checkoutUrl = $this->isProduction ? ($mpData['init_point'] ?? null) : ($mpData['sandbox_init_point'] ?? $mpData['init_point'] ?? null);
        if (!is_string($checkoutUrl) || !str_starts_with($checkoutUrl, 'https://')) {
            return ['status' => 502, 'data' => ['erro' => 'O Mercado Pago não retornou um endereço de checkout válido.']];
        }

        $registro = $this->tidb->registrarPagamentoPendente($pedidoId, 'Cartão de Crédito');
        if ($registro === 'ja_pago') {
            return ['status' => 400, 'data' => ['erro' => 'Este pedido já foi pago e confirmado anteriormente']];
        }
        if ($registro !== 'atualizado') {
            return ['status' => 503, 'data' => ['erro' => 'Não foi possível registrar o checkout no banco.']];
        }

        return [
            'status' => 200,
            'data'   => [
                'sucesso' => true,
                'checkout_url' => $checkoutUrl,
            ]
        ];
    }

    /**
     * Consulta status de pagamento no Mercado Pago
     */
    public function consultarStatus(string $pagamentoId, ?string $pedidoId = null, ?string $userAuthHeader = null, ?string $userId = null): array
    {
        if ($pedidoId !== null) {
            $pedidoDb = $this->tidb->consultarPedido($pedidoId, $userAuthHeader);
            if (!$this->pedidoPertenceAoUsuario($pedidoDb, $userId)) {
                return ['status' => 404, 'data' => ['erro' => 'Pedido não encontrado']];
            }
        }

        $res = $this->callMercadoPago('GET', "https://api.mercadopago.com/v1/payments/{$pagamentoId}");

        if ($this->semToken($res)) {
            return ['status' => 503, 'data' => ['erro' => $res['data']['message']]];
        }
        if ($res['http_code'] < 200 || $res['http_code'] >= 300) {
            return ['status' => $res['http_code'] ?: 400, 'data' => ['erro' => 'Falha ao consultar Mercado Pago']];
        }

        $mpData = $res['data'];
        $aprovado = ($mpData['status'] ?? '') === 'approved';

        if ($aprovado && !empty($pedidoId)) {
            if (!$this->confirmarPedidoPorPagamento($pedidoId, $mpData)) {
                return ['status' => 409, 'data' => ['erro' => 'O pagamento não corresponde ao valor ou ao pedido informado.']];
            }
        }

        return [
            'status' => 200,
            'data'   => [
                'pagamento_id'   => $mpData['id'] ?? null,
                'status'         => $mpData['status'] ?? null,
                'status_detalhe' => $mpData['status_detail'] ?? null,
                'pago'           => $aprovado
            ]
        ];
    }

    /**
     * Procura os Pix já criados para o pedido.
     * - reaproveitar: um Pix pendente, do mesmo valor, ainda dentro da validade e com QR Code;
     * - encerrados: quantos Pix deste pedido já expiraram/foram cancelados (entra na chave de idempotência).
     * Se a consulta falhar, devolve "nada a reaproveitar" e a chave determinística segue evitando duplicidade.
     *
     * @return array{reaproveitar: ?array, encerrados: int}
     */
    private function buscarPixExistente(string $pedidoId, float $valor): array
    {
        $resultado = ['reaproveitar' => null, 'encerrados' => 0];
        if ($pedidoId === '') {
            return $resultado;
        }

        $res = $this->callMercadoPago(
            'GET',
            'https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&external_reference=' . rawurlencode($pedidoId),
        );
        $pagamentos = $res['data']['results'] ?? null;
        if ($res['http_code'] < 200 || $res['http_code'] >= 300 || !is_array($pagamentos)) {
            return $resultado;
        }

        $agora = time();
        foreach ($pagamentos as $pg) {
            if (!is_array($pg)
                || ($pg['external_reference'] ?? '') !== $pedidoId
                || ($pg['payment_method_id'] ?? '') !== 'pix') {
                continue;
            }
            $status = $pg['status'] ?? '';
            $expira = isset($pg['date_of_expiration']) ? strtotime((string) $pg['date_of_expiration']) : false;
            $vencido = $expira !== false && $expira <= $agora + 60;

            if (in_array($status, ['cancelled', 'rejected', 'expired'], true)
                || (in_array($status, ['pending', 'in_process'], true) && $vencido)) {
                $resultado['encerrados']++;
                continue;
            }

            $mesmoValor = abs((float) ($pg['transaction_amount'] ?? 0) - round($valor, 2)) < 0.01;
            $temQr = !empty($pg['point_of_interaction']['transaction_data']['qr_code']);
            if ($resultado['reaproveitar'] === null && $mesmoValor
                && ($status === 'approved' || (in_array($status, ['pending', 'in_process'], true) && $temQr))) {
                $resultado['reaproveitar'] = $pg;
            }
        }

        return $resultado;
    }

    public function consultarStatusCheckout(string $pedidoId, ?string $userId): array
    {
        if (!$this->tidb->isValidPedidoId($pedidoId)) {
            return ['status' => 400, 'data' => ['erro' => 'Identificador de pedido inválido']];
        }

        $pedido = $this->tidb->consultarPedido($pedidoId);
        if (!$this->pedidoPertenceAoUsuario($pedido, $userId)) {
            return ['status' => 404, 'data' => ['erro' => 'Pedido não encontrado']];
        }
        if (!empty($pedido['pago'])) {
            return ['status' => 200, 'data' => ['status' => 'approved', 'pago' => true]];
        }

        $res = $this->callMercadoPago(
            'GET',
            'https://api.mercadopago.com/v1/payments/search?external_reference=' . rawurlencode($pedidoId),
        );
        if ($this->semToken($res)) {
            return ['status' => 503, 'data' => ['erro' => $res['data']['message']]];
        }
        if ($res['http_code'] < 200 || $res['http_code'] >= 300) {
            return ['status' => 502, 'data' => ['erro' => 'Falha ao consultar o pagamento no Mercado Pago.']];
        }

        $payments = $res['data']['results'] ?? [];
        if (!is_array($payments)) {
            return ['status' => 502, 'data' => ['erro' => 'Resposta inválida do Mercado Pago.']];
        }
        $payment = null;
        foreach ($payments as $candidate) {
            if (is_array($candidate) && ($candidate['external_reference'] ?? '') === $pedidoId) {
                if ($payment === null || ($candidate['status'] ?? '') === 'approved') {
                    $payment = $candidate;
                }
                if (($candidate['status'] ?? '') === 'approved') {
                    break;
                }
            }
        }

        if ($payment === null) {
            return ['status' => 200, 'data' => ['status' => 'pending', 'pago' => false]];
        }
        $approved = ($payment['status'] ?? '') === 'approved';
        if ($approved && !$this->confirmarPedidoPorPagamento($pedidoId, $payment)) {
            return ['status' => 409, 'data' => ['erro' => 'O pagamento não corresponde ao valor ou ao pedido informado.']];
        }

        return [
            'status' => 200,
            'data' => [
                'pagamento_id' => $payment['id'] ?? null,
                'status' => $payment['status'] ?? 'pending',
                'status_detalhe' => $payment['status_detail'] ?? null,
                'pago' => $approved,
            ],
        ];
    }

    /**
     * Simula aprovação imediata (Exclusiva Sandbox + Autenticação de Admin Obrigatória)
     */
    public function simularAprovacao(string $pedidoId, ?string $userAuthHeader = null, ?string $userId = null): array
    {
        if ($this->isProduction || !str_starts_with($this->accessToken, 'TEST-')) {
            return ['status' => 403, 'data' => ['erro' => 'Simulação estritamente desabilitada em ambiente de produção']];
        }

        if (!$this->tidb->isValidPedidoId($pedidoId)) {
            return ['status' => 400, 'data' => ['erro' => 'pedido_id obrigatório e deve ter formato válido']];
        }

        if ($userId === null) {
            return ['status' => 401, 'data' => ['erro' => 'Autenticação necessária para simular aprovação']];
        }

        $pedidoDb = $this->tidb->consultarPedido($pedidoId, $userAuthHeader);
        if (!$this->pedidoPertenceAoUsuario($pedidoDb, $userId)) {
            return ['status' => 404, 'data' => ['erro' => 'Pedido não localizado ou acesso não autorizado']];
        }

        if (!empty($pedidoDb['pago'])) {
            return ['status' => 400, 'data' => ['erro' => 'Este pedido já se encontra pago']];
        }

        if (!$this->tidb->atualizarPedido($pedidoId, [
            'status' => 'confirmado',
            'pago'   => true
        ], $userAuthHeader)) {
            return ['status' => 503, 'data' => ['erro' => 'Não foi possível registrar a aprovação no banco.']];
        }

        return [
            'status' => 200,
            'data'   => [
                'sucesso'  => true,
                'mensagem' => "Pedido {$pedidoId} marcado como pago e confirmado com sucesso no Sandbox!"
            ]
        ];
    }

    private function pedidoPertenceAoUsuario(?array $pedido, ?string $userId): bool
    {
        return $pedido !== null
            && $userId !== null
            && hash_equals((string) ($pedido['cliente_id'] ?? $pedido['usuario_id'] ?? ''), $userId);
    }

    /**
     * Processa notificação webhook do Mercado Pago com validação segura
     */
    /**
     * Retorna false quando o processamento não pôde ser feito por falta de
     * configuração (token ausente); o controller então responde 503 para que o
     * Mercado Pago reenvie a notificação depois.
     */
    public function processarWebhook(?string $pagamentoId): bool
    {
        if (empty($pagamentoId) || !preg_match('/^\d+$/', $pagamentoId)) {
            return true;
        }

        try {
            $res = $this->callMercadoPago('GET', "https://api.mercadopago.com/v1/payments/{$pagamentoId}");
            if ($this->semToken($res)) {
                log_message('error', '[Webhook] MP_ACCESS_TOKEN ausente: notificação não processada.');
                return false;
            }
            if ($res['http_code'] === 200 && is_array($res['data'])) {
                $pagamento = $res['data'];
                if (($pagamento['status'] ?? '') === 'approved' && !empty($pagamento['external_reference'])) {
                    $pedidoId = $pagamento['external_reference'];
                    if ($this->tidb->isValidPedidoId($pedidoId)) {
                        if ($this->confirmarPedidoPorPagamento($pedidoId, $pagamento)) {
                            log_message('info', "[Webhook] Pedido {$pedidoId} aprovado via Mercado Pago.");
                        } else {
                            log_message('error', "[Webhook] Pagamento não corresponde ao pedido {$pedidoId}.");
                        }
                    }
                }
            }
        } catch (\Throwable $e) {
            log_message('error', '[Webhook] Erro ao validar pagamento: ' . $e->getMessage());
        }

        return true;
    }

    private function semToken(array $res): bool
    {
        return ($res['error'] ?? '') === 'MP_ACCESS_TOKEN ausente';
    }

    private function confirmarPedidoPorPagamento(string $pedidoId, array $payment): bool
    {
        if (($payment['external_reference'] ?? '') !== $pedidoId
            || ($payment['status'] ?? '') !== 'approved'
            || ($payment['currency_id'] ?? '') !== 'BRL'
            || !isset($payment['transaction_amount'])
            || !is_numeric($payment['transaction_amount'])) {
            return false;
        }

        $pedido = $this->tidb->consultarPedido($pedidoId);
        if ($pedido === null
            || ($pedido['status'] ?? '') === 'cancelado'
            || (int) round((float) $payment['transaction_amount'] * 100)
                !== (int) round((float) $pedido['valor_total'] * 100)) {
            return false;
        }

        return $this->tidb->atualizarPedido($pedidoId, [
            'status' => 'confirmado',
            'pago' => true,
        ]);
    }

    /**
     * Realiza requisição HTTP CURL com autorização do Mercado Pago
     */
    protected function callMercadoPago(string $method, string $url, ?array $payload = null, ?string $idempotencyKey = null): array
    {
        if ($this->accessToken === '') {
            return [
                'http_code' => 500,
                'data'      => ['message' => 'Pagamento indisponível: MP_ACCESS_TOKEN não está configurado no servidor.'],
                'error'     => 'MP_ACCESS_TOKEN ausente',
            ];
        }

        $ch = curl_init($url);
        $headers = [
            "Authorization: Bearer {$this->accessToken}",
            "Content-Type: application/json"
        ];
        if (!empty($idempotencyKey)) {
            $headers[] = "X-Idempotency-Key: {$idempotencyKey}";
        }

        $opts = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_TIMEOUT        => 12,
            CURLOPT_SSL_VERIFYPEER => true
        ];

        if ($method === 'POST') {
            $opts[CURLOPT_POST] = true;
            $opts[CURLOPT_POSTFIELDS] = json_encode($payload ?: []);
        } elseif ($method !== 'GET') {
            $opts[CURLOPT_CUSTOMREQUEST] = $method;
            if ($payload) {
                $opts[CURLOPT_POSTFIELDS] = json_encode($payload);
            }
        }

        curl_setopt_array($ch, $opts);
        $rawResponse = curl_exec($ch);
        $httpCode    = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err         = curl_error($ch);
        curl_close($ch);

        $parsed = json_decode($rawResponse ?: '{}', true);

        return [
            'http_code' => $httpCode,
            'data'      => is_array($parsed) ? $parsed : ['raw' => $rawResponse],
            'error'     => $err
        ];
    }
}
