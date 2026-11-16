<?php

namespace App\Controllers\Api;

use App\Services\MercadoPagoService;
use App\Services\TiDBAuthService;
use CodeIgniter\HTTP\ResponseInterface;

class PagamentoController extends FrontendController
{
    protected MercadoPagoService $mpService;
    protected TiDBAuthService $authService;

    public function __construct()
    {
        $this->mpService = new MercadoPagoService();
        $this->authService = new TiDBAuthService();
    }

    /**
     * GET /api/health
     */
    public function health(): ResponseInterface
    {
        // Resposta mínima: usada só para checagem de saúde do serviço.
        return $this->response->setJSON(['status' => 'online']);
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
            'webhookConfigurado' => $this->mpService->hasWebhook()
        ]);
    }

    /**
     * POST /api/pagamento/pix
     */
    public function gerarPix(): ResponseInterface
    {
        if ($blocked = $this->rejectCrossOrigin()) {
            return $blocked;
        }

        $payload = $this->request->getJSON(true) ?: $this->request->getPost();
        if (!is_array($payload) || empty($payload)) {
            return $this->response->setStatusCode(400)->setJSON(['erro' => 'Corpo da requisição JSON inválido ou vazio']);
        }

        $user = $this->authService->currentUser();
        if ($user === null) {
            return $this->response->setStatusCode(401)->setJSON(['erro' => 'Entre na sua conta para pagar.']);
        }
        if (!isset($payload['cliente']) || !is_array($payload['cliente'])) {
            $payload['cliente'] = [];
        }
        $payload['cliente']['email'] = $user['email'] ?? ($payload['cliente']['email'] ?? '');
        $resultado = $this->mpService->gerarPix($payload, null, (string) $user['id']);

        return $this->response->setStatusCode($resultado['status'])->setJSON($resultado['data']);
    }

    /**
     * POST /api/pagamento/cartao
     */
    public function processarCartao(): ResponseInterface
    {
        if ($blocked = $this->rejectCrossOrigin()) {
            return $blocked;
        }

        $payload = $this->request->getJSON(true) ?: $this->request->getPost();
        if (!is_array($payload) || empty($payload)) {
            return $this->response->setStatusCode(400)->setJSON(['erro' => 'Corpo da requisição JSON inválido ou vazio']);
        }

        $user = $this->authService->currentUser();
        if ($user === null) {
            return $this->response->setStatusCode(401)->setJSON(['erro' => 'Entre na sua conta para pagar.']);
        }
        $payload['email'] = $user['email'] ?? ($payload['email'] ?? '');
        $resultado = $this->mpService->processarCartao($payload, null, (string) $user['id']);

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

        $user = $this->authService->currentUser();
        if ($user === null) {
            return $this->response->setStatusCode(401)->setJSON(['erro' => 'Autenticação necessária.']);
        }
        if ($pedidoId === '' || !preg_match('/^[0-9a-fA-F-]{8,45}$/', trim($pedidoId))) {
            return $this->response->setStatusCode(400)->setJSON(['erro' => 'Pedido inválido ou ausente.']);
        }

        $resultado = $this->mpService->consultarStatus(trim($pagamentoId), $pedidoId, null, (string) $user['id']);

        return $this->response->setStatusCode($resultado['status'])->setJSON($resultado['data']);
    }

    /**
     * GET /api/pagamento/checkout/status
     */
    public function consultarStatusCheckout(): ResponseInterface
    {
        $pedidoId = trim((string) $this->request->getGet('pedido_id'));
        $user = $this->authService->currentUser();
        if ($user === null) {
            return $this->response->setStatusCode(401)->setJSON(['erro' => 'Autenticação necessária.']);
        }

        $resultado = $this->mpService->consultarStatusCheckout($pedidoId, (string) $user['id']);
        return $this->response->setStatusCode($resultado['status'])->setJSON($resultado['data']);
    }

    /**
     * POST /api/pagamento/simular-aprovacao
     */
    public function simularAprovacao(): ResponseInterface
    {
        if ($blocked = $this->rejectCrossOrigin()) {
            return $blocked;
        }

        $payload = $this->request->getJSON(true) ?: $this->request->getPost();
        if (!is_array($payload)) {
            return $this->response->setStatusCode(400)->setJSON(['erro' => 'Corpo da requisição JSON inválido']);
        }
        $pedidoId = $payload['pedido_id'] ?? null;

        if (empty($pedidoId)) {
            return $this->response->setStatusCode(400)->setJSON(['erro' => 'pedido_id é obrigatório']);
        }

        $user = $this->authService->currentUser();
        if ($user === null) {
            return $this->response->setStatusCode(401)->setJSON(['erro' => 'Autenticação necessária.']);
        }
        if (($user['user_metadata']['role'] ?? '') !== 'admin') {
            return $this->response->setStatusCode(403)->setJSON(['erro' => 'Apenas administradores podem simular pagamentos.']);
        }
        $resultado = $this->mpService->simularAprovacao($pedidoId, null, (string) $user['id']);

        return $this->response->setStatusCode($resultado['status'])->setJSON($resultado['data']);
    }

    /**
     * Valida a assinatura (x-signature) do webhook do Mercado Pago.
     * MP_WEBHOOK_SECRET é obrigatório: sem ele, toda notificação é recusada
     * (o retorno do checkout continua consultando o pagamento no Mercado Pago).
     */
    private function assinaturaWebhookValida(string $dataId): bool
    {
        $secret = trim((string) env('MP_WEBHOOK_SECRET', ''));
        if ($secret === '') {
            log_message('error', '[Webhook] MP_WEBHOOK_SECRET não configurado: notificação recusada.');
            return false;
        }

        $ts = '';
        $v1 = '';
        foreach (explode(',', $this->request->getHeaderLine('X-Signature')) as $parte) {
            [$chave, $valor] = array_pad(explode('=', trim($parte), 2), 2, '');
            if ($chave === 'ts') {
                $ts = $valor;
            } elseif ($chave === 'v1') {
                $v1 = strtolower($valor);
            }
        }
        if ($ts === '' || $v1 === '') {
            return false;
        }

        $manifesto = 'id:' . (ctype_alnum($dataId) ? strtolower($dataId) : $dataId) . ';';
        $requestId = $this->request->getHeaderLine('X-Request-Id');
        if ($requestId !== '') {
            $manifesto .= 'request-id:' . $requestId . ';';
        }
        $manifesto .= 'ts:' . $ts . ';';

        return hash_equals(hash_hmac('sha256', $manifesto, $secret), $v1);
    }

    /**
     * POST /api/webhook/mercadopago
     */
    public function webhook(): ResponseInterface
    {
        $payload = $this->request->getJSON(true) ?: $this->request->getPost();
        $pagamentoId = $payload['data']['id'] ?? ($this->request->getGet('data.id') ?: $this->request->getGet('id'));

        if (!empty($pagamentoId)) {
            if (!$this->assinaturaWebhookValida((string) $pagamentoId)) {
                return $this->response->setStatusCode(401)->setJSON(['erro' => 'Assinatura inválida.']);
            }
            if (!$this->mpService->processarWebhook((string) $pagamentoId)) {
                return $this->response->setStatusCode(503)->setJSON(['erro' => 'Pagamento indisponível no momento.']);
            }
        }

        return $this->response->setStatusCode(200)->setJSON(['recebido' => true]);
    }
}
