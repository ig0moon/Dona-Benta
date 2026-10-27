<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Services\MercadoPagoService;
use CodeIgniter\HTTP\ResponseInterface;

class PagamentoController extends BaseController
{
    protected MercadoPagoService $mpService;

    public function __construct()
    {
        $this->mpService = new MercadoPagoService();
    }

    /**
     * GET /api/health
     */
    public function health(): ResponseInterface
    {
        $isProd = $this->mpService->isProduction();

        return $this->response->setJSON([
            'status'              => 'online',
            'servico'             => 'Dona Benta - API de Pagamentos CI4 MVC',
            'gateway'             => 'Mercado Pago',
            'ambiente'            => $isProd ? 'Produção' : 'Sandbox',
            'seguranca'           => 'Ativa (OWASP, Rate Limiting, CSP, Anti-Carding)',
            'webhook_configurado' => $this->mpService->hasWebhook()
        ]);
    }

    /**
     * GET /api/config
     */
    public function config(): ResponseInterface
    {
        $isProd = $this->mpService->isProduction();

        return $this->response->setJSON([
            'sucesso'            => true,
            'ambiente'           => $isProd ? 'producao' : 'sandbox',
            'publicKey'          => $this->mpService->getPublicKey(),
            'webhookConfigurado' => $this->mpService->hasWebhook()
        ]);
    }

    /**
     * POST /api/pagamento/pix
     */
    public function gerarPix(): ResponseInterface
    {
        $payload = $this->request->getJSON(true) ?: $this->request->getPost();
        if (empty($payload)) {
            return $this->response->setStatusCode(400)->setJSON(['erro' => 'Corpo da requisição JSON inválido ou vazio']);
        }

        $authHeader = $this->request->getHeaderLine('Authorization');
        $resultado = $this->mpService->gerarPix($payload, $authHeader);

        return $this->response->setStatusCode($resultado['status'])->setJSON($resultado['data']);
    }

    /**
     * POST /api/pagamento/cartao
     */
    public function processarCartao(): ResponseInterface
    {
        $payload = $this->request->getJSON(true) ?: $this->request->getPost();
        if (empty($payload)) {
            return $this->response->setStatusCode(400)->setJSON(['erro' => 'Corpo da requisição JSON inválido ou vazio']);
        }

        $authHeader = $this->request->getHeaderLine('Authorization');
        $resultado = $this->mpService->processarCartao($payload, $authHeader);

        return $this->response->setStatusCode($resultado['status'])->setJSON($resultado['data']);
    }

    /**
     * GET /api/pagamento/status
     */
    public function consultarStatus(): ResponseInterface
    {
        $pagamentoId = (string) $this->request->getGet('id');
        $pedidoId    = (string) $this->request->getGet('pedido_id');

        if (empty($pagamentoId) || !preg_match('/^\d+$/', trim($pagamentoId))) {
            return $this->response->setStatusCode(400)->setJSON(['erro' => 'ID de pagamento inválido ou ausente']);
        }

        $resultado = $this->mpService->consultarStatus(trim($pagamentoId), $pedidoId ?: null);

        return $this->response->setStatusCode($resultado['status'])->setJSON($resultado['data']);
    }

    /**
     * POST /api/pagamento/simular-aprovacao
     */
    public function simularAprovacao(): ResponseInterface
    {
        $payload = $this->request->getJSON(true) ?: $this->request->getPost();
        $pedidoId = $payload['pedido_id'] ?? null;

        if (empty($pedidoId)) {
            return $this->response->setStatusCode(400)->setJSON(['erro' => 'pedido_id é obrigatório']);
        }

        $authHeader = $this->request->getHeaderLine('Authorization');
        $resultado = $this->mpService->simularAprovacao($pedidoId, $authHeader);

        return $this->response->setStatusCode($resultado['status'])->setJSON($resultado['data']);
    }

    /**
     * POST /api/webhook/mercadopago
     */
    public function webhook(): ResponseInterface
    {
        $payload = $this->request->getJSON(true) ?: $this->request->getPost();
        $pagamentoId = $payload['data']['id'] ?? ($this->request->getGet('data.id') ?: $this->request->getGet('id'));

        if (!empty($pagamentoId)) {
            $this->mpService->processarWebhook((string) $pagamentoId);
        }

        return $this->response->setStatusCode(200)->setJSON(['recebido' => true]);
    }
}
