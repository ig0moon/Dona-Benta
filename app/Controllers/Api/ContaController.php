<?php

namespace App\Controllers\Api;

use App\Services\PrivacidadeService;
use App\Services\TiDBAuthService;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

/**
 * Direitos do titular pela própria conta (LGPD, art. 18): baixar uma cópia dos dados e excluir a conta.
 */
class ContaController extends FrontendController
{
    private TiDBAuthService $auth;
    private PrivacidadeService $privacidade;

    public function __construct()
    {
        $this->auth = new TiDBAuthService();
        $this->privacidade = new PrivacidadeService();
    }

    /**
     * GET /api/conta/meus-dados — baixa um arquivo JSON com os dados da conta e os pedidos.
     */
    public function meusDados(): ResponseInterface
    {
        $this->liberarSessao();
        $user = $this->auth->currentUser();
        if ($user === null) {
            return $this->response->setStatusCode(401)->setJSON(['data' => null, 'error' => ['message' => 'Entre na sua conta para continuar.']]);
        }

        try {
            $dados = $this->rewriteStorageUrls($this->privacidade->exportarDados($user));
        } catch (Throwable $exception) {
            log_message('error', 'Falha ao exportar dados do titular ({exception}).', ['exception' => $exception::class]);
            return $this->response->setStatusCode(503)->setJSON(['data' => null, 'error' => ['message' => 'Não foi possível gerar o arquivo agora.']]);
        }

        return $this->response
            ->setHeader('Cache-Control', 'no-store')
            ->setHeader('Content-Disposition', 'attachment; filename="meus-dados-dona-benta.json"')
            ->setContentType('application/json', 'UTF-8')
            ->setBody(json_encode($dados, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    /**
     * POST /api/conta/excluir — { "senha": "...", "confirmacao": "EXCLUIR" }
     */
    public function excluir(): ResponseInterface
    {
        if ($blocked = $this->rejectCrossOrigin()) {
            return $blocked;
        }
        $user = $this->auth->currentUser();
        if ($user === null) {
            return $this->response->setStatusCode(401)->setJSON(['data' => null, 'error' => ['message' => 'Entre na sua conta para continuar.']]);
        }

        $payload = $this->request->getJSON(true);
        $senha = is_array($payload) ? (string) ($payload['senha'] ?? '') : '';
        $confirmacao = is_array($payload) ? strtoupper(trim((string) ($payload['confirmacao'] ?? ''))) : '';
        if ($senha === '' || $confirmacao !== 'EXCLUIR') {
            return $this->response->setStatusCode(400)->setJSON(['data' => null, 'error' => ['message' => 'Informe sua senha e digite EXCLUIR para confirmar.']]);
        }

        try {
            $resultado = $this->privacidade->excluirConta($user, $senha);
        } catch (Throwable $exception) {
            log_message('error', 'Falha ao excluir conta ({exception}).', ['exception' => $exception::class]);
            return $this->response->setStatusCode(503)->setJSON(['data' => null, 'error' => ['message' => 'Não foi possível excluir a conta agora.']]);
        }
        if ($resultado['status'] !== 200) {
            return $this->response->setStatusCode($resultado['status'])->setJSON(['data' => null, 'error' => ['message' => $resultado['erro']]]);
        }

        $this->auth->logout();
        return $this->response->setJSON(['data' => true, 'error' => null]);
    }
}
