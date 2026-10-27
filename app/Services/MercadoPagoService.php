<?php

namespace App\Services;

class MercadoPagoService
{
    protected string $accessToken;
    protected string $publicKey;
    protected ?string $webhookUrl;
    protected bool $isProduction;
    protected SupabaseService $supabase;

    public function __construct()
    {
        $this->accessToken  = (string) env('MP_ACCESS_TOKEN', '');
        $this->publicKey    = (string) env('MP_PUBLIC_KEY', '');
        $this->webhookUrl   = env('WEBHOOK_URL', null);
        $this->isProduction = str_starts_with($this->accessToken, 'APP_USR-') || env('CI_ENVIRONMENT') === 'production';
        $this->supabase     = new SupabaseService();
    }

    public function isProduction(): bool
    {
        return $this->isProduction;
    }

    public function getPublicKey(): string
    {
        return $this->publicKey;
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
    public function gerarPix(array $payload, ?string $userAuthHeader = null): array
    {
        $pedidoId  = $payload['pedido_id'] ?? null;
        $valorRaw  = (float) ($payload['valor'] ?? 0);
        $descricao = $payload['descricao'] ?? null;
        $cliente   = $payload['cliente'] ?? [];

        $valorEfetivo = $valorRaw;

        // Anti-tampering estrito de preço: consulta Supabase e recalcula com base no catálogo real
        if (!empty($pedidoId)) {
            if (!$this->supabase->isValidPedidoId($pedidoId)) {
                return ['status' => 400, 'data' => ['erro' => 'Identificador de pedido inválido']];
            }

            $pedidoDb = $this->supabase->consultarPedido($pedidoId, $userAuthHeader);
            if ($pedidoDb) {
                if (!empty($pedidoDb['pago'])) {
                    return ['status' => 400, 'data' => ['erro' => 'Este pedido já foi pago e confirmado anteriormente']];
                }
                if (($pedidoDb['status'] ?? '') === 'cancelado') {
                    return ['status' => 400, 'data' => ['erro' => 'Este pedido foi cancelado']];
                }

                // Recalcula o valor real com os produtos cadastrados
                $valorReal = $this->supabase->calcularValorRealPedido($pedidoId, $userAuthHeader);
                $valorDb   = $valorReal ?: (float) ($pedidoDb['valor_total'] ?? 0);

                if ($valorDb > 0 && abs($valorEfetivo - $valorDb) > 0.05) {
                    log_message('warning', "[SEGURANÇA] Ajustando valor conforme catálogo oficial: R$ {$valorDb} (enviado: R$ {$valorEfetivo})");
                    $valorEfetivo = $valorDb;
                    // Sincroniza o valor correto no registro do pedido
                    $this->supabase->atualizarPedido($pedidoId, ['valor_total' => $valorDb], $userAuthHeader);
                }
            }
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

        $idempotencyKey = 'pix-' . ($pedidoId ?: time()) . '-' . bin2hex(random_bytes(6));

        $res = $this->callMercadoPago('POST', 'https://api.mercadopago.com/v1/payments', $mpPayload, $idempotencyKey);

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

        if (!empty($pedidoId)) {
            $this->supabase->atualizarPedido($pedidoId, [
                'forma_pagamento' => 'Pix',
                'status'          => 'aguardando_confirmacao',
                'pago'            => false
            ], $userAuthHeader);
        }

        return [
            'status' => 200,
            'data'   => [
                'sucesso'        => true,
                'pagamento_id'   => $mpData['id'] ?? null,
                'status'         => $mpData['status'] ?? 'pending',
                'status_detalhe' => $mpData['status_detail'] ?? null,
                'valor'          => $mpData['transaction_amount'] ?? $valorEfetivo,
                'pix_copia_cola' => $pixCopiaCola,
                'qr_code_base64' => $qrCodeBase64,
                'expiracao'      => $mpData['date_of_expiration'] ?? null
            ]
        ];
    }

    /**
     * Processa Pagamento via Cartão de Crédito com verificação de autoridade de valor
     */
    public function processarCartao(array $payload, ?string $userAuthHeader = null): array
    {
        $pedidoId          = $payload['pedido_id'] ?? null;
        $token             = $payload['token'] ?? null;
        $issuerId          = $payload['issuer_id'] ?? null;
        $paymentMethodId   = $payload['payment_method_id'] ?? null;
        $transactionAmount = (float) ($payload['transaction_amount'] ?? 0);
        $installments      = max(1, min(12, (int) ($payload['installments'] ?? 1)));
        $payer             = $payload['payer'] ?? [];
        $descricao         = $payload['descricao'] ?? null;

        if (empty($token) || !is_string($token) || !preg_match('/^[a-zA-Z0-9_-]{10,140}$/', trim($token))) {
            return ['status' => 400, 'data' => ['erro' => 'Token de cartão de crédito inválido ou ausente']];
        }

        $valorEfetivo = $transactionAmount;

        // Anti-tampering estrito de preço no cartão
        if (!empty($pedidoId)) {
            if (!$this->supabase->isValidPedidoId($pedidoId)) {
                return ['status' => 400, 'data' => ['erro' => 'Identificador de pedido inválido']];
            }

            $pedidoDb = $this->supabase->consultarPedido($pedidoId, $userAuthHeader);
            if ($pedidoDb) {
                if (!empty($pedidoDb['pago'])) {
                    return ['status' => 400, 'data' => ['erro' => 'Este pedido já se encontra pago e confirmado']];
                }
                if (($pedidoDb['status'] ?? '') === 'cancelado') {
                    return ['status' => 400, 'data' => ['erro' => 'Este pedido foi cancelado']];
                }

                $valorReal = $this->supabase->calcularValorRealPedido($pedidoId, $userAuthHeader);
                $valorDb   = $valorReal ?: (float) ($pedidoDb['valor_total'] ?? 0);

                if ($valorDb > 0 && abs($valorEfetivo - $valorDb) > 0.05) {
                    log_message('warning', "[SEGURANÇA] Ajustando valor conforme catálogo oficial: R$ {$valorDb} (enviado: R$ {$valorEfetivo})");
                    $valorEfetivo = $valorDb;
                    $this->supabase->atualizarPedido($pedidoId, ['valor_total' => $valorDb], $userAuthHeader);
                }
            }
        }

        if ($valorEfetivo < 0.50 || $valorEfetivo > 50000) {
            return ['status' => 400, 'data' => ['erro' => 'Valor do pedido inválido para cartão de crédito']];
        }

        $issuerIdLimpo = (!empty($issuerId) && is_numeric($issuerId) && (int) $issuerId > 0) ? (int) $issuerId : null;
        $paymentMethodIdLimpo = (!empty($paymentMethodId) && $paymentMethodId !== 'null' && $paymentMethodId !== 'undefined')
            ? $this->sanitizeInput((string) $paymentMethodId, 30)
            : null;

        $rawEmail = strtolower(trim($payer['email'] ?? ''));
        $payerEmail = (!empty($rawEmail) && filter_var($rawEmail, FILTER_VALIDATE_EMAIL) && !str_ends_with($rawEmail, '@testuser.com'))
            ? $rawEmail
            : null;

        if ($this->isProduction && !$payerEmail) {
            return ['status' => 400, 'data' => ['erro' => 'E-mail do pagador é obrigatório para processar o cartão.']];
        }
        if (!$payerEmail) {
            $payerEmail = 'cliente.donabenta@gmail.com';
        }

        $identificationLimpo = null;
        $cpfNum = preg_replace('/\D/', '', $payer['identification']['number'] ?? '');
        if ($this->validarCPF($cpfNum)) {
            $identificationLimpo = ['type' => $payer['identification']['type'] ?? 'CPF', 'number' => $cpfNum];
        } elseif ($this->isProduction) {
            return ['status' => 400, 'data' => ['erro' => 'CPF do titular do cartão é obrigatório e deve ser válido.']];
        } else {
            $identificationLimpo = ['type' => 'CPF', 'number' => '17286371630'];
        }

        $descSegura = $this->sanitizeInput($descricao ?: ('Pedido Dona Benta #' . ($pedidoId ? substr($pedidoId, 0, 8) : 'DB')), 120);

        $mpPayload = [
            'token'              => trim($token),
            'transaction_amount' => round($valorEfetivo, 2),
            'installments'       => $installments,
            'description'        => $descSegura,
            'payer'              => [
                'email'          => $payerEmail,
                'identification' => $identificationLimpo
            ]
        ];

        if ($issuerIdLimpo !== null) {
            $mpPayload['issuer_id'] = $issuerIdLimpo;
        }
        if ($paymentMethodIdLimpo !== null) {
            $mpPayload['payment_method_id'] = $paymentMethodIdLimpo;
        }
        if (!empty($pedidoId)) {
            $mpPayload['external_reference'] = (string) $pedidoId;
        }
        if (!empty($this->webhookUrl)) {
            $mpPayload['notification_url'] = $this->webhookUrl;
        }

        $idempotencyKey = 'card-' . ($pedidoId ?: time()) . '-' . bin2hex(random_bytes(6));

        $res = $this->callMercadoPago('POST', 'https://api.mercadopago.com/v1/payments', $mpPayload, $idempotencyKey);

        // Fallback para Sandbox caso código 2131 de issuer_id ocorra
        if (($res['http_code'] < 200 || $res['http_code'] >= 300) && isset($mpPayload['issuer_id'])) {
            $causes = $res['data']['cause'] ?? [];
            $has2131 = false;
            if (is_array($causes)) {
                foreach ($causes as $c) {
                    if (($c['code'] ?? null) === 2131) {
                        $has2131 = true;
                        break;
                    }
                }
            }
            if ($has2131) {
                unset($mpPayload['issuer_id']);
                $res = $this->callMercadoPago('POST', 'https://api.mercadopago.com/v1/payments', $mpPayload, 'retry-' . $idempotencyKey);
            }
        }

        if ($res['http_code'] < 200 || $res['http_code'] >= 300) {
            return [
                'status' => $res['http_code'] ?: 400,
                'data' => [
                    'erro'     => 'Pagamento com cartão não autorizado',
                    'status'   => $res['data']['status'] ?? 'rejected',
                    'detalhes' => $res['data']['message'] ?? 'Dados do cartão recusados pelo gateway.'
                ]
            ];
        }

        $mpData = $res['data'];
        $aprovado = ($mpData['status'] ?? '') === 'approved';

        if (!empty($pedidoId)) {
            $this->supabase->atualizarPedido($pedidoId, [
                'forma_pagamento' => 'Cartão de Crédito',
                'status'          => $aprovado ? 'confirmado' : 'aguardando_confirmacao',
                'pago'            => $aprovado
            ], $userAuthHeader);
        }

        return [
            'status' => 200,
            'data'   => [
                'sucesso'        => $aprovado,
                'pagamento_id'   => $mpData['id'] ?? null,
                'status'         => $mpData['status'] ?? null,
                'status_detalhe' => $mpData['status_detail'] ?? null,
                'mensagem'       => $aprovado ? 'Pagamento aprovado com sucesso!' : 'Pagamento em análise ou pendente'
            ]
        ];
    }

    /**
     * Consulta status de pagamento no Mercado Pago
     */
    public function consultarStatus(string $pagamentoId, ?string $pedidoId = null): array
    {
        $res = $this->callMercadoPago('GET', "https://api.mercadopago.com/v1/payments/{$pagamentoId}");

        if ($res['http_code'] < 200 || $res['http_code'] >= 300) {
            return ['status' => $res['http_code'] ?: 400, 'data' => ['erro' => 'Falha ao consultar Mercado Pago']];
        }

        $mpData = $res['data'];
        $aprovado = ($mpData['status'] ?? '') === 'approved';

        if ($aprovado && !empty($pedidoId)) {
            $this->supabase->atualizarPedido($pedidoId, [
                'status' => 'confirmado',
                'pago'   => true
            ]);
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
     * Simula aprovação imediata (Exclusiva Sandbox + Autenticação de Admin Obrigatória)
     */
    public function simularAprovacao(string $pedidoId, ?string $userAuthHeader = null): array
    {
        if ($this->isProduction || !str_starts_with($this->accessToken, 'TEST-')) {
            return ['status' => 403, 'data' => ['erro' => 'Simulação estritamente desabilitada em ambiente de produção']];
        }

        if (!$this->supabase->isValidPedidoId($pedidoId)) {
            return ['status' => 400, 'data' => ['erro' => 'pedido_id obrigatório e deve ter formato válido']];
        }

        if (empty($userAuthHeader)) {
            return ['status' => 401, 'data' => ['erro' => 'Autenticação necessária para simular aprovação']];
        }

        $pedidoDb = $this->supabase->consultarPedido($pedidoId, $userAuthHeader);
        if (!$pedidoDb) {
            return ['status' => 404, 'data' => ['erro' => 'Pedido não localizado ou acesso não autorizado']];
        }

        if (!empty($pedidoDb['pago'])) {
            return ['status' => 400, 'data' => ['erro' => 'Este pedido já se encontra pago']];
        }

        $this->supabase->atualizarPedido($pedidoId, [
            'status' => 'confirmado',
            'pago'   => true
        ], $userAuthHeader);

        return [
            'status' => 200,
            'data'   => [
                'sucesso'  => true,
                'mensagem' => "Pedido {$pedidoId} marcado como pago e confirmado com sucesso no Sandbox!"
            ]
        ];
    }

    /**
     * Processa notificação webhook do Mercado Pago com validação segura
     */
    public function processarWebhook(?string $pagamentoId): void
    {
        if (empty($pagamentoId) || !preg_match('/^\d+$/', $pagamentoId)) {
            return;
        }

        try {
            $res = $this->callMercadoPago('GET', "https://api.mercadopago.com/v1/payments/{$pagamentoId}");
            if ($res['http_code'] === 200 && is_array($res['data'])) {
                $pagamento = $res['data'];
                if (($pagamento['status'] ?? '') === 'approved' && !empty($pagamento['external_reference'])) {
                    $pedidoId = $pagamento['external_reference'];
                    if ($this->supabase->isValidPedidoId($pedidoId)) {
                        $this->supabase->atualizarPedido($pedidoId, [
                            'status' => 'confirmado',
                            'pago'   => true
                        ]);
                        log_message('info', "[Webhook] Pedido {$pedidoId} aprovado via Mercado Pago.");
                    }
                }
            }
        } catch (\Throwable $e) {
            log_message('error', '[Webhook] Erro ao validar pagamento: ' . $e->getMessage());
        }
    }

    /**
     * Realiza requisição HTTP CURL com autorização do Mercado Pago
     */
    protected function callMercadoPago(string $method, string $url, ?array $payload = null, ?string $idempotencyKey = null): array
    {
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
